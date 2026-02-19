// ===== Remote data source (edit the JSON file in GitHub, not the code) =====
const REMOTE_ITEMS_URL = './data/items.json';

// In-memory state (start empty; we'll load remote or local below)
let items = [];
let activeCategory = 'All';
let selectedIndices = new Set();

// Storage keys for local persistence (for offline use and your local edits)
const STORAGE = {
  items: 'qc.items.v1',
  settings: 'qc.settings.v1'
};

function sanitizeItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(x => ({
    label: String(x.label || '').trim(),
    value: String(x.value || ''),
    category: (x.category && String(x.category).trim()) || 'Uncategorised'
  })).filter(x => x.label && x.value);
}

function loadItemsLocal() {
  try {
    const raw = localStorage.getItem(STORAGE.items);
    if (!raw) return [];
    return sanitizeItems(JSON.parse(raw));
  } catch { return []; }
}

function saveItemsLocal() {
  localStorage.setItem(STORAGE.items, JSON.stringify(items));
}

// Always fetch the latest JSON from the network (bypass caches)
async function fetchRemoteItems() {
  const url = REMOTE_ITEMS_URL + '?v=' + Date.now(); // cache-buster
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return sanitizeItems(data);
}

// Try remote first → if it fails, fall back to local
async function refreshFromRemote(showStatus = true) {
  try {
    if (showStatus) status.textContent = 'Refreshing from cloud…';
  } catch {}
  try {
    const remote = await fetchRemoteItems();
    items = remote;
    saveItemsLocal();           // cache for offline
    renderCategories();
    renderList();
    if (showStatus) status.textContent = `Loaded ${items.length} item(s) from cloud.`;
  } catch (e) {
    // Fall back to local storage
    items = loadItemsLocal();
    renderCategories();
    renderList();
    if (showStatus) status.textContent = `Cloud fetch failed; using local data (${items.length}).`;
  }
}

// --- Elements ---
const searchBox = document.getElementById('searchBox');
const itemList = document.getElementById('itemList');
const copyBtn = document.getElementById('copyBtn');
const copyCloseBtn = document.getElementById('copyCloseBtn');
const removeSelectedBtn = document.getElementById('removeSelectedBtn');
const addTextBtn = document.getElementById('addTextBtn');
const countLabel = document.getElementById('countLabel');
const status = document.getElementById('status');

const categoryList = document.getElementById('categoryList');
const addTextDialog = document.getElementById('addTextDialog');
const dlgLabel = document.getElementById('dlgLabel');
const dlgValue = document.getElementById('dlgValue');
const dlgCategory = document.getElementById('dlgCategory');

const autoClose = document.getElementById('autoClose');

// Refresh button (optional)
const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => refreshFromRemote(true));
}


// --- Helpers ---
function unique(arr){ return [...new Set(arr)]; }

function computeCategories(){
  const cats = items.map(x => x.category || 'Uncategorised');
  return ['All', ...unique(cats)].sort((a,b) => (a==='All'? -1 : a.localeCompare(b)));
}

function renderCategories(){
  const cats = computeCategories();
  categoryList.innerHTML = '';
  cats.forEach(cat => {
    const li = document.createElement('li');
    li.textContent = cat;
    if (cat === activeCategory) li.classList.add('active');
    li.addEventListener('click', () => { activeCategory = cat; renderList(); renderCategories(); });
    categoryList.appendChild(li);
  });
}

function filteredItems(){
  const q = searchBox.value.trim().toLowerCase();
  return items.filter(it => {
    const inCat = (activeCategory === 'All') || ((it.category || 'Uncategorised') === activeCategory);
    if (!inCat) return false;
    if (!q) return true;
    return (it.label.toLowerCase().includes(q) || (it.value || '').toLowerCase().includes(q));
  });
}

function renderList(){
  const list = filteredItems();
  itemList.innerHTML = '';
  list.forEach((it, idx) => {
    const li = document.createElement('li');
    li.className = 'item';
    li.tabIndex = 0;

    const content = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = it.label;
    const value = document.createElement('div');
    value.className = 'value';
    value.textContent = it.value || '';

    content.appendChild(label);
    content.appendChild(value);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const cat = document.createElement('span');
    cat.textContent = it.category || 'Uncategorised';
    meta.appendChild(cat);

    li.appendChild(content);
    li.appendChild(meta);

    // selection behavior
    li.addEventListener('click', (ev) => {
      if (ev.ctrlKey) {
        // toggle
        if (selectedIndices.has(idx)) selectedIndices.delete(idx); else selectedIndices.add(idx);
      } else {
        // single select
        selectedIndices.clear(); selectedIndices.add(idx);
      }
      updateButtons();
      renderSelection();
    });

    li.addEventListener('dblclick', async () => {
      selectedIndices.clear(); selectedIndices.add(idx);
      updateButtons();
      renderSelection();
      await doCopy();
      if (autoClose.checked) window.close();
    });

    itemList.appendChild(li);
  });

  countLabel.textContent = `${list.length} item${list.length===1?'':'s'}`;
  selectedIndices.clear();
  updateButtons();
}

function renderSelection(){
  // add visual selection (simple)
  const children = itemList.querySelectorAll('.item');
  children.forEach((el, i) => {
    if (selectedIndices.has(i)) {
      el.style.outline = '2px solid #3b82f6';
      el.style.outlineOffset = '-2px';
    } else {
      el.style.outline = 'none';
    }
  });
}

function updateButtons(){
  const hasSel = selectedIndices.size > 0;
  copyBtn.disabled = !hasSel;
  copyCloseBtn.disabled = !hasSel;
  removeSelectedBtn.disabled = !hasSel;
}

// Copy selected (joins with newlines)
async function doCopy(){
  const list = filteredItems();
  const selected = [...selectedIndices].map(i => list[i]).filter(Boolean);
  if (selected.length === 0) return;

  const text = selected.map(x => x.value || '').join('\n');
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = `Copied ${selected.length} item(s) to clipboard.`;
  } catch (err) {
    status.textContent = `Copy failed: ${String(err)}`;
  }
}

// Remove selected (from in-memory list only for now)
function doRemoveSelected(){
  const list = filteredItems();
  const selected = [...selectedIndices].map(i => list[i]).filter(Boolean);
  // Remove by reference
  items = items.filter(it => !selected.includes(it));
  selectedIndices.clear();
  renderList(); renderCategories();
  status.textContent = `Removed ${selected.length} item(s).`;
}

// Add text dialog
function openAddTextDialog(){
  dlgLabel.value = '';
  dlgValue.value = '';
  dlgCategory.value = '';
  addTextDialog.showModal();
}
function confirmAddText(){
  const label = dlgLabel.value.trim();
  const value = dlgValue.value;
  const category = dlgCategory.value.trim() || 'Uncategorised';
  if (!label || !value) return;

  items.unshift({ label, value, category });
  addTextDialog.close('ok');
  renderList(); renderCategories();
  status.textContent = `Added "${label}".`;
}

// --- Wire up ---

searchBox.addEventListener('input', () => {
  renderList();

  // auto-select first item
  const list = filteredItems();
  if (list.length > 0) {
    selectedIndices.clear();
    selectedIndices.add(0);
    renderSelection();
    updateButtons();
  }
});


copyBtn.addEventListener('click', async () => {
  await doCopy();
  if (autoClose.checked) window.close();
});
copyCloseBtn.addEventListener('click', async () => {
  await doCopy();
  window.close();
});
removeSelectedBtn.addEventListener('click', () => doRemoveSelected());
addTextBtn.addEventListener('click', () => openAddTextDialog());

addTextDialog.addEventListener('close', () => {
  if (addTextDialog.returnValue === 'ok') confirmAddText();
});

// Keyboard shortcuts on list (navigation + copy)
itemList.addEventListener('keydown', async (e) => {
  const list = filteredItems();
  const max = list.length - 1;

  // --- Navigation ---
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (selectedIndices.size === 0) {
      selectedIndices.add(0);
    } else {
      const idx = Math.max(...selectedIndices);
      selectedIndices.clear();
      selectedIndices.add(Math.min(idx + 1, max));
    }
    renderSelection();
    updateButtons();
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (selectedIndices.size === 0) {
      selectedIndices.add(0);
    } else {
      const idx = Math.min(...selectedIndices);
      selectedIndices.clear();
      selectedIndices.add(Math.max(idx - 1, 0));
    }
    renderSelection();
    updateButtons();
    return;
  }

  if (e.key === 'Home') {
    e.preventDefault();
    selectedIndices.clear();
    selectedIndices.add(0);
    renderSelection();
    updateButtons();
    return;
  }

  if (e.key === 'End') {
    e.preventDefault();
    selectedIndices.clear();
    selectedIndices.add(max);
    renderSelection();
    updateButtons();
    return;
  }

  // --- Copy ---
  if (e.key === 'Enter' || (e.ctrlKey && e.key.toLowerCase() === 'c')) {
    await doCopy();
    if (autoClose.checked && window.matchMedia('(display-mode: standalone)').matches) {
      window.close();
    }
    return;
  }

  // --- Delete ---
  if (e.key === 'Delete') {
    e.preventDefault();
    doRemoveSelected();
    return;
  }
});

// Initial load: try cloud → fallback to local
(async () => {
  await refreshFromRemote(false);
})();

// Focus search at load for quick typing
window.addEventListener('load', () => searchBox.focus());

// Always refocus search after a short delay if user starts typing
window.addEventListener('keydown', (e) => {
  // Don’t override shortcuts inside dialogs
  if (document.querySelector('dialog[open]')) return;

  const isCharacter = e.key.length === 1;
  if (isCharacter && !e.ctrlKey && !e.metaKey && !e.altKey) {
    setTimeout(() => searchBox.focus(), 10);
  }
});


// Global typing autofocus (for super-fast workflow)
window.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return; // don't steal focus in dialogs

  // Only printable keys
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    setTimeout(() => searchBox.focus(), 10);
  }
});




