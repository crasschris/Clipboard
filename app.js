// --- Initial demo data (non-secret phrases only) ---
const defaultItems = [
  { label: 'Next week Awaiting response.', value: 'Next week Awaiting response.', category: 'Phrases' },
  { label: 'Next week Resolve if no reply received within 7 days.', value: 'Next week Resolve if no reply received within 7 days.', category: 'Phrases' },
  { label: 'Please let me know when it might be convenient for me to call you.', value: 'Please let me know when it might be convenient for me to call you.', category: 'Phrases' },

  { label: 'azuread\\Chris.Jones.Admin@LGADigital.onmicrosoft.com', value: 'azuread\\Chris.Jones.Admin@LGADigital.onmicrosoft.com', category: 'UPNs' },
  { label: 'azuread\\Chris.Jones.Admin@southwark.onmicrosoft.com', value: 'azuread\\Chris.Jones.Admin@southwark.onmicrosoft.com', category: 'UPNs' },
  { label: 'azuread\\Chris.Jones.Admin@LewishamCouncil.onmicrosoft.com', value: 'azuread\\Chris.Jones.Admin@LewishamCouncil.onmicrosoft.com', category: 'UPNs' },
  { label: 'azuread\\Chris.Jones.Admin@lbdigitalservices.onmicrosoft.com', value: 'azuread\\Chris.Jones.Admin@lbdigitalservices.onmicrosoft.com', category: 'UPNs' }
];

// --- State (in-memory only for now) ---
let items = [...defaultItems];
let activeCategory = 'All';

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

let selectedIndices = new Set();

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
searchBox.addEventListener('input', () => { renderList(); });

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

// Keyboard shortcuts on list
itemList.addEventListener('keydown', async (e) => {
  // Enter or Ctrl+C to copy
  if (e.key === 'Enter' || (e.ctrlKey && e.key.toLowerCase() === 'c')) {
    await doCopy();
    if (autoClose.checked) window.close();
  }
  if (e.key === 'Delete') {
    doRemoveSelected();
  }
});

// Initial render
renderCategories();
renderList();

// Focus search at load for quick typing
window.addEventListener('load', () => searchBox.focus());
