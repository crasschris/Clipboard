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

// New buttons
const editBtn = document.getElementById('editBtn');
const bulkAddBtn = document.getElementById('bulkAddBtn');

// New dialogs & fields
const editDialog = document.getElementById('editDialog');
const editLabel = document.getElementById('editLabel');
const editValue = document.getElementById('editValue');
const editCategory = document.getElementById('editCategory');

const bulkDialog = document.getElementById('bulkDialog');
const bulkText = document.getElementById('bulkText');
const bulkCategory = document.getElementById('bulkCategory');

// Cancel buttons for new dialogs
const editCancelBtn = document.getElementById('editCancel');
if (editCancelBtn) editCancelBtn.addEventListener('click', () => editDialog.close('cancel'));

const bulkCancelBtn = document.getElementById('bulkCancel');
if (bulkCancelBtn) bulkCancelBtn.addEventListener('click', () => bulkDialog.close('cancel'));

const autoClose = document.getElementById('autoClose');

// Refresh button (optional)
const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => refreshFromRemote(true));
}

/* ========= Add Text dialog: cancel wiring ========= */

// Grab the Cancel button from the dialog
const dlgCancelBtn = document.getElementById('dlgCancel');
if (dlgCancelBtn) {
  dlgCancelBtn.addEventListener('click', () => {
    // Simply close the dialog; do not submit the form
    addTextDialog.close('cancel');

    // (optional) clear the fields so next open starts fresh
    dlgLabel.value = '';
    dlgValue.value = '';
    dlgCategory.value = '';
  });
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
  if (editBtn) editBtn.disabled = !(selectedIndices.size === 1); 
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

// === Edit (enable only when exactly one item is selected) ===
function openEditDialog(){
  const list = filteredItems();
  if (selectedIndices.size !== 1) return;
  const idx = [...selectedIndices][0];
  const it = list[idx];

  // Pre-fill fields
  editLabel.value = it.label;
  editValue.value = it.value || '';
  editCategory.value = (it.category && it.category.trim()) || 'Uncategorised';

  editDialog.showModal();
}

function confirmEdit(){
  const list = filteredItems();
  if (selectedIndices.size !== 1) return;
  const idx = [...selectedIndices][0];
  const it = list[idx];

  // Update the same object (list refs point into items array)
  it.label = editLabel.value.trim();
  it.value = editValue.value;
  it.category = (editCategory.value && editCategory.value.trim()) || 'Uncategorised';

  saveItemsLocal();               // persist local edits
  editDialog.close('ok');
  renderList(); renderCategories();
  status.textContent = 'Saved changes.';
}

// Wire Edit buttons
if (editBtn) {
  editBtn.addEventListener('click', () => openEditDialog());
}
const editOkBtn = document.getElementById('editOk');
if (editOkBtn) {
  editOkBtn.addEventListener('click', (e) => {
    e.preventDefault();
    confirmEdit();
  });
}

// === Bulk Add ===
function openBulkDialog(){
  bulkText.value = '';
  bulkCategory.value = '';
  bulkDialog.showModal();
}

function confirmBulkAdd(){
  const lines = bulkText.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const cat = (bulkCategory.value && bulkCategory.value.trim()) || 'Uncategorised';
  let added = 0;

  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq > -1) {
      const label = line.slice(0, eq).trim();
      const value = line.slice(eq+1).trim();
      if (label && value) { items.unshift({ label, value, category: cat }); added++; }
    } else {
      items.unshift({ label: line, value: line, category: cat });
      added++;
    }
  }

  saveItemsLocal();               // persist
  bulkDialog.close('ok');
  renderList(); renderCategories();
  status.textContent = `Added ${added} item(s).`;
}

// Wire Bulk buttons
if (bulkAddBtn) {
  bulkAddBtn.addEventListener('click', () => openBulkDialog());
}
const bulkOkBtn = document.getElementById('bulkOk');
if (bulkOkBtn) {
  bulkOkBtn.addEventListener('click', (e) => {
    e.preventDefault();
    confirmBulkAdd();
  });
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

// ===== Export / Import (uses existing `items` + helpers) =====

// Export the current in-memory items as JSON
function exportItems() {
  try {
    // If you later add categories as a separate array, include them here.
    const payload = {
      format: 'quick-clipboard/v1',
      exportedAt: new Date().toISOString(),
      items: items   // <-- your current array
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quick-clipboard-export-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
    status.textContent = 'Exported clipboard items.';
  } catch (err) {
    console.error('Export failed:', err);
    alert('Export failed. Check console for details.');
  }
}

// Trigger the hidden file input
function openImportPicker() {
  const input = document.getElementById('importFile');
  if (!input) {
    alert('Import control not found.');
    return;
  }
  input.value = ''; // allow re-selecting the same file
  input.click();
}

// Handle file selection + merge (or replace) strategy
function handleImportChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);

      // Accept either { items: [...] } or a raw array [...]
      const imported = Array.isArray(parsed) ? parsed
                     : (parsed && Array.isArray(parsed.items) ? parsed.items : null);

      if (!imported) throw new Error('Invalid file format. Expected an array or { items: [...] }.');

      // Basic schema: need label + value at minimum
      const valid = imported.filter(x => x && typeof x.label === 'string' && typeof x.value === 'string');

      // Choose one strategy:
      // A) Replace everything:
      // items = valid;

      // B) Merge (default): append new items, naïve de-dupe by label+value
      const key = o => `${o.label}__${o.value}`;
      const map = new Map(items.map(o => [key(o), o]));
      for (const it of valid) if (!map.has(key(it))) map.set(key(it), it);
      items = Array.from(map.values());

      // Persist + re-render
      saveItemsLocal();
      renderCategories();
      renderList();

      status.textContent = `Imported ${valid.length} item(s).`;
      alert(`Imported ${valid.length} item(s).`);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed: ' + err.message);
    } finally {
      e.target.value = ''; // reset so same file can be picked again
    }
  };
  reader.onerror = () => {
    console.error('File read error:', reader.error);
    alert('Could not read the selected file.');
    e.target.value = '';
  };
  reader.readAsText(file, 'utf-8');
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
  if (addTextDialog.returnValue === 'ok') {
    confirmAddText();
  } else {
    // Reset fields on cancel
    dlgLabel.value = '';
    dlgValue.value = '';
    dlgCategory.value = '';
  }
});

// Export / Import buttons
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) exportBtn.addEventListener('click', exportItems);

const importBtn = document.getElementById('importBtn');
if (importBtn) importBtn.addEventListener('click', openImportPicker);

const importFile = document.getElementById('importFile');
if (importFile) importFile.addEventListener('change', handleImportChange);

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

// ===== Quick Clipboard: Export / Import wiring =====

// --- Configuration: change these if you already use specific storage keys ---
const QC_STORAGE_KEY = 'qcState'; // Everything saved under a single key
// If you already store items differently (e.g. 'clipboardItems'), update below.

// --- Helpers to get/set the app state (items + categories) ---

function getState() {
  // 1) Prefer an in-memory variable if you already keep one
  if (window.qcState && Array.isArray(window.qcState.items)) {
    return window.qcState;
  }

  // 2) Try a single JSON blob in localStorage (our default)
  try {
    const raw = localStorage.getItem(QC_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) return parsed;
    }
  } catch (e) {
    console.warn('Could not parse state from localStorage:', e);
  }

  // 3) Try common legacy keys (adjust if needed)
  try {
    const items = JSON.parse(localStorage.getItem('clipboardItems') || '[]');
    const categories = JSON.parse(localStorage.getItem('clipboardCategories') || '[]');
    if (Array.isArray(items)) {
      return { items, categories, meta: { source: 'legacyKeys' } };
    }
  } catch { /* ignore */ }

  // 4) Fallback: scrape minimal data from DOM (best-effort)
  const domItems = Array.from(document.querySelectorAll('#itemList li')).map(li => ({
    id: li.dataset.id || crypto.randomUUID(),
    label: li.dataset.label || li.innerText.trim(),
    value: li.dataset.value || li.innerText.trim(),
    category: li.dataset.category || '',
    created: Date.now(),
    modified: Date.now()
  }));
  return { items: domItems, categories: [], meta: { source: 'dom' } };
}

function setState(next) {
  // If you already keep a global state + render function, update & render:
  window.qcState = next;
  try {
    localStorage.setItem(QC_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('Could not save state to localStorage:', e);
  }

  // If you have a function that redraws the UI, call it here:
  if (typeof window.renderItems === 'function') {
    window.renderItems(next.items);
  } else if (typeof window.render === 'function') {
    window.render(next);
  }
}

// --- Export: download current state as JSON ---

function exportState() {
  try {
    const state = getState();
    const payload = {
      format: 'quick-clipboard/v1',
      exportedAt: new Date().toISOString(),
      items: state.items || [],
      categories: state.categories || [],
      meta: state.meta || {}
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quick-clipboard-export-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
    setStatus('Exported clipboard items.');
  } catch (err) {
    console.error('Export failed:', err);
    alert('Export failed. Open the console for details.');
  }
}

// --- Import: choose file, then merge or replace ---

function requestImportFile() {
  const input = document.getElementById('importFile');
  if (!input) return alert('Import control not found.');
  input.value = '';       // allow selecting the same file twice
  input.click();
}

function handleImportFileChange(evt) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.items)) {
        throw new Error('Invalid file format (missing items array).');
      }

      // Optional: schema check
      const areValid = parsed.items.every(i => typeof i?.label === 'string' && typeof i?.value === 'string');
      if (!areValid) {
        throw new Error('Some items are invalid (need at least label & value).');
      }

      // Decide merge vs replace. Choose one of the two options:

      const current = getState();

      // Option A) Replace everything
      // const next = {
      //   items: parsed.items,
      //   categories: parsed.categories || [],
      //   meta: { ...current.meta, importedAt: Date.now(), format: parsed.format || 'unknown' }
      // };

      // Option B) Merge (default): append new items; naive de-dupe by label+value
      const key = i => `${i.label}__${i.value}`;
      const existingMap = new Map(current.items.map(i => [key(i), i]));
      for (const it of parsed.items) {
        if (!existingMap.has(key(it))) existingMap.set(key(it), it);
      }
      const next = {
        items: Array.from(existingMap.values()),
        categories: Array.from(new Set([...(current.categories || []), ...(parsed.categories || [])])),
        meta: { ...current.meta, importedAt: Date.now(), format: parsed.format || 'unknown' }
      };

      setState(next);
      setStatus(`Imported ${parsed.items.length} items.`);
      alert(`Imported ${parsed.items.length} item(s).`);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed: ' + err.message);
    } finally {
      evt.target.value = ''; // reset
    }
  };
  reader.onerror = () => {
    console.error('File read error:', reader.error);
    alert('Could not read the selected file.');
    evt.target.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

// --- Wire up buttons once DOM is ready (defer already helps, but be safe) ---
function wireExportImport() {
  const btnExport = document.getElementById('exportBtn');
  const btnImport = document.getElementById('importBtn');
  const inputFile = document.getElementById('importFile');

  btnExport?.addEventListener('click', exportState);
  btnImport?.addEventListener('click', requestImportFile);
  inputFile?.addEventListener('change', handleImportFileChange);
}

// Optional: simple status helper (writes to <span id="status">)
function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}

// If your file is `defer`-loaded, DOM is ready; still guard for safety.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireExportImport);
} else {
  wireExportImport();
}

// Global typing autofocus (for super-fast workflow)
window.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return; // don't steal focus in dialogs

  // Only printable keys
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    setTimeout(() => searchBox.focus(), 10);
  }
});




