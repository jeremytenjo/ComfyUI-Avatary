// @ts-nocheck
import { app } from '/scripts/app.js';

const NODE_CLASS = 'AvataryLoadImageBatch';
const STATE_KEY = 'avataryLoadImageBatch';
const HIDDEN_INPUT_NAME = 'UploadState';
const MANAGED_SUBFOLDER = 'avatary_load_image_batch';
const PANEL_HEIGHT = 260;
const VIEWER_ID = 'avatary-lb-viewer';

function ensureStyles() {
  if (document.getElementById('avatary-load-image-batch-styles')) return;
  const style = document.createElement('style');
  style.id = 'avatary-load-image-batch-styles';
  style.textContent = `
    .avatary-lb-panel { display:flex; flex-direction:column; gap:8px; font:12px 'Segoe UI',sans-serif; height:100%; }
    .avatary-lb-actions { display:flex; gap:8px; }
    .avatary-lb-btn { flex:1; min-height:30px; border-radius:10px; border:1px solid var(--border-color,#434958); background:var(--comfy-input-bg,#232831); color:var(--input-text,#e6e9ef); cursor:pointer; }
    .avatary-lb-btn.secondary { flex:0 0 auto; padding:0 10px; }
    .avatary-lb-list { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; overflow:auto; padding-right:2px; }
    .avatary-lb-item { border:1px solid var(--border-color,#434958); border-radius:10px; padding:6px; background:var(--comfy-menu-bg,#16191f); display:flex; flex-direction:column; gap:4px; }
    .avatary-lb-thumb { width:100%; height:auto; object-fit:contain; border-radius:6px; background:#0f1116; display:block; }
    .avatary-lb-meta { display:flex; align-items:center; justify-content:space-between; gap:6px; }
    .avatary-lb-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--input-text,#d0d6e2); }
    .avatary-lb-remove { border:none; background:transparent; color:#ff8f9d; cursor:pointer; font-size:11px; }
    .avatary-lb-empty { color:#8f97a6; padding:8px 2px; }
    .avatary-lb-viewer {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.86);
      cursor: zoom-out;
      padding: 16px;
      box-sizing: border-box;
    }
    .avatary-lb-viewer img {
      max-width: min(96vw, 1800px);
      max-height: 96vh;
      width: auto;
      height: auto;
      object-fit: contain;
      border-radius: 10px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    }
  `;
  document.head.appendChild(style);
}

function getState(node) {
  if (!node.properties) node.properties = {};
  if (!node.properties[STATE_KEY]) {
    node.properties[STATE_KEY] = {
      subfolder: MANAGED_SUBFOLDER,
      files: [],
      isUploading: false,
      uploadDone: 0,
      uploadTotal: 0,
    };
  }
  const state = node.properties[STATE_KEY];
  if (!Array.isArray(state.files)) state.files = [];
  if (!state.subfolder) state.subfolder = MANAGED_SUBFOLDER;
  if (typeof state.isUploading !== 'boolean') state.isUploading = false;
  if (!Number.isFinite(state.uploadDone)) state.uploadDone = 0;
  if (!Number.isFinite(state.uploadTotal)) state.uploadTotal = 0;
  return state;
}

function getHiddenWidget(node) {
  return node.widgets?.find((w) => w.name === HIDDEN_INPUT_NAME) || null;
}

function syncUploadState(node) {
  const state = getState(node);
  const hidden = getHiddenWidget(node);
  if (hidden) hidden.value = JSON.stringify({ subfolder: state.subfolder, files: state.files });
}

function previewUrl(fileName, subfolder) {
  const params = new URLSearchParams({ filename: fileName, type: 'input', subfolder });
  return `/view?${params.toString()}`;
}

function ensurePanelWidget(node) {
  if (node._avataryLbPanel && node.widgets?.some((w) => w?._avataryLbPanelWidget)) return node._avataryLbPanel;

  if (node.widgets) node.widgets = node.widgets.filter((w) => !w?._avataryLbPanelWidget);
  node._avataryLbPanel = null;

  const panel = document.createElement('div');
  panel.className = 'avatary-lb-panel';
  node._avataryLbPanel = panel;

  if (typeof node.addDOMWidget === 'function') {
    const w = node.addDOMWidget('Uploads', 'upload_panel', panel, {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => PANEL_HEIGHT,
    });
    if (w) {
      w._avataryLbPanelWidget = true;
      w.serialize = false;
      return panel;
    }
  }

  return null;
}

async function uploadSingle(file) {
  const body = new FormData();
  body.append('image', file);
  body.append('type', 'input');
  body.append('subfolder', MANAGED_SUBFOLDER);
  body.append('overwrite', 'true');

  const response = await fetch('/upload/image', {
    method: 'POST',
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Upload failed (${response.status})`);
  }
  return await response.json();
}

async function deleteFilesFromDisk(files) {
  if (!Array.isArray(files) || files.length === 0) return { deleted: [], errors: [] };
  const response = await fetch('/avatary/load-images/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Delete failed (${response.status})`);
  }
  return await response.json();
}

async function handleUpload(node) {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.png,.jpg,.jpeg,.webp,image/*';
  picker.multiple = true;

  picker.onchange = async () => {
    const files = Array.from(picker.files || []);
    if (!files.length) return;

    const state = getState(node);
    state.isUploading = true;
    state.uploadDone = 0;
    state.uploadTotal = files.length;
    renderPanel(node);
    app.graph?.setDirtyCanvas?.(true, true);

    try {
      for (const file of files) {
        const uploaded = await uploadSingle(file);
        const name = uploaded?.name || uploaded?.filename || file.name;
        if (!state.files.includes(name)) state.files.push(name);
        state.uploadDone += 1;
        renderPanel(node);
      }
    } finally {
      state.isUploading = false;
      state.uploadDone = 0;
      state.uploadTotal = 0;
    }

    syncUploadState(node);
    renderPanel(node);
    app.graph?.setDirtyCanvas?.(true, true);
  };

  picker.click();
}

async function removeFile(node, name) {
  const state = getState(node);
  if (state.isUploading) return;
  try {
    await deleteFilesFromDisk([name]);
  } catch (err) {
    console.error('[AvataryLoadImageBatch] delete failed', err);
  }
  state.files = state.files.filter((file) => file !== name);
  syncUploadState(node);
  renderPanel(node);
  app.graph?.setDirtyCanvas?.(true, true);
}

async function clearAll(node) {
  const state = getState(node);
  if (state.isUploading) return;
  const filesToDelete = [...state.files];
  try {
    await deleteFilesFromDisk(filesToDelete);
  } catch (err) {
    console.error('[AvataryLoadImageBatch] clear delete failed', err);
  }
  state.files = [];
  syncUploadState(node);
  renderPanel(node);
  app.graph?.setDirtyCanvas?.(true, true);
}

function applyOverflowAfterSix(list, count) {
  if (!list) return;
  if (count <= 4) {
    list.style.maxHeight = '';
    list.style.overflowY = '';
    return;
  }

  const cards = Array.from(list.querySelectorAll('.avatary-lb-item'));
  const rowHeights = [0, 0];
  for (let i = 0; i < Math.min(4, cards.length); i++) {
    const row = Math.floor(i / 2);
    rowHeights[row] = Math.max(rowHeights[row], cards[i].offsetHeight || 0);
  }

  const gapPx = 8;
  const maxHeight = rowHeights.reduce((sum, h) => sum + h, 0) + gapPx;
  if (maxHeight > 0) {
    list.style.maxHeight = `${maxHeight}px`;
    list.style.overflowY = 'auto';
  }
}

function applyGridColumns(list, count) {
  if (!list) return;
  list.style.gridTemplateColumns = count === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))';
}

function closeViewer() {
  const existing = document.getElementById(VIEWER_ID);
  if (existing) existing.remove();
}

function openViewer(src, alt = '') {
  closeViewer();
  const overlay = document.createElement('div');
  overlay.id = VIEWER_ID;
  overlay.className = 'avatary-lb-viewer';

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;

  overlay.onclick = () => closeViewer();
  overlay.appendChild(img);
  document.body.appendChild(overlay);

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeViewer();
      window.removeEventListener('keydown', escHandler, true);
    }
  };
  window.addEventListener('keydown', escHandler, true);
}

function renderPanel(node) {
  ensureStyles();
  const panel = ensurePanelWidget(node);
  if (!panel) return;

  const state = getState(node);
  panel.innerHTML = '';

  const actions = document.createElement('div');
  actions.className = 'avatary-lb-actions';

  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'avatary-lb-btn';
  uploadBtn.textContent = state.isUploading
    ? `Uploading ${Math.min(state.uploadDone, state.uploadTotal)}/${state.uploadTotal || 0}...`
    : 'Upload Images';
  uploadBtn.disabled = state.isUploading;
  uploadBtn.onclick = async () => {
    if (state.isUploading) return;
    try {
      await handleUpload(node);
    } catch (err) {
      console.error('[AvataryLoadImageBatch] upload failed', err);
    }
  };

  const clearBtn = document.createElement('button');
  clearBtn.className = 'avatary-lb-btn secondary';
  clearBtn.textContent = 'Clear';
  clearBtn.disabled = state.files.length === 0 || state.isUploading;
  clearBtn.onclick = async () => clearAll(node);

  actions.appendChild(uploadBtn);
  actions.appendChild(clearBtn);
  panel.appendChild(actions);

  if (state.isUploading) {
    const loading = document.createElement('div');
    loading.className = 'avatary-lb-empty';
    loading.textContent = `Uploading ${Math.min(state.uploadDone, state.uploadTotal)}/${state.uploadTotal || 0} images...`;
    panel.appendChild(loading);
  }

  const list = document.createElement('div');
  list.className = 'avatary-lb-list';
  applyGridColumns(list, state.files.length);

  if (!state.files.length) {
    const empty = document.createElement('div');
    empty.className = 'avatary-lb-empty';
    empty.textContent = 'Upload one or more images to preview and batch load.';
    panel.appendChild(empty);
  } else {
    for (const name of state.files) {
      const item = document.createElement('div');
      item.className = 'avatary-lb-item';

      const img = document.createElement('img');
      img.className = 'avatary-lb-thumb';
      img.loading = 'lazy';
      img.src = previewUrl(name, state.subfolder);
      img.alt = name;
      img.onload = () => applyOverflowAfterSix(list, state.files.length);
      img.ondblclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openViewer(img.src, name);
      };

      const meta = document.createElement('div');
      meta.className = 'avatary-lb-meta';

      const label = document.createElement('div');
      label.className = 'avatary-lb-name';
      label.title = name;
      label.textContent = name;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'avatary-lb-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.disabled = state.isUploading;
      removeBtn.onclick = async () => removeFile(node, name);

      meta.appendChild(label);
      meta.appendChild(removeBtn);
      item.appendChild(img);
      item.appendChild(meta);
      item.ondblclick = (e) => {
        if (e.target === removeBtn) return;
        openViewer(img.src, name);
      };
      list.appendChild(item);
    }
    panel.appendChild(list);
    requestAnimationFrame(() => applyOverflowAfterSix(list, state.files.length));
  }

  syncUploadState(node);
  node.size[0] = Math.max(node.size?.[0] || 0, 340);
  node.size[1] = Math.max(node.size?.[1] || 0, 380);
}

app.registerExtension({
  name: 'Avatary.LoadImageBatch.MultiUploadPreview',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS) return;

    const origCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function (...args) {
      const r = origCreated?.apply(this, args);
      renderPanel(this);
      setTimeout(() => {
        try {
          renderPanel(this);
        } catch (_err) {}
      }, 60);
      return r;
    };

    const origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (...args) {
      const r = origConfigure?.apply(this, args);
      renderPanel(this);
      return r;
    };

    const origRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function (...args) {
      if (this._avataryLbPanel?.isConnected) this._avataryLbPanel.remove();
      if (this.widgets) this.widgets = this.widgets.filter((w) => !w?._avataryLbPanelWidget);
      return origRemoved?.apply(this, args);
    };
  },

  loadedGraphNode(node) {
    const isTarget =
      node?.comfyClass === NODE_CLASS ||
      node?.type === NODE_CLASS ||
      node?.constructor?.type === NODE_CLASS;
    if (!isTarget) return;
    renderPanel(node);
  },
});
