// @ts-nocheck
import { app } from '/scripts/app.js';

const NODE_CLASS = 'AvataryLoadImageBatch';
const STATE_KEY = 'avataryLoadImageBatch';
const HIDDEN_INPUT_NAME = 'UploadState';
const MANAGED_SUBFOLDER = 'avatary_load_image_batch';
const PANEL_HEIGHT = 260;
const VIEWER_ID = 'avatary-lb-viewer';
const ACCEPTED_TYPES = ['.png', '.jpg', '.jpeg', '.webp', 'image/*'];
const FIXED_NODE_WIDTH = 340;
const FIXED_NODE_HEIGHT = 380;

function ensureStyles() {
  if (document.getElementById('avatary-load-image-batch-styles')) return;
  const style = document.createElement('style');
  style.id = 'avatary-load-image-batch-styles';
  style.textContent = `
    .avatary-lb-panel { display:flex; flex-direction:column; gap:8px; font:12px 'Segoe UI',sans-serif; height:100%; min-height:0; }
    .avatary-lb-panel.drag-hover {
      outline: 2px dashed #7ab8ff;
      outline-offset: -2px;
      border-radius: 10px;
      background: rgba(90, 140, 210, 0.08);
    }
    .avatary-lb-panel.drag-hover .avatary-lb-list {
      box-shadow: inset 0 0 0 1px rgba(122, 184, 255, 0.45);
      border-radius: 10px;
    }
    .avatary-lb-actions { display:flex; gap:8px; }
    .avatary-lb-btn { flex:1; min-height:30px; border-radius:10px; border:1px solid var(--border-color,#434958); background:var(--comfy-input-bg,#232831); color:var(--input-text,#e6e9ef); cursor:pointer; }
    .avatary-lb-btn.secondary { flex:0 0 auto; padding:0 10px; }
    .avatary-lb-list { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; overflow:auto; padding-right:2px; flex:1 1 auto; min-height:0; align-content:start; }
    .avatary-lb-item { border:1px solid var(--border-color,#434958); border-radius:10px; padding:6px; background:var(--comfy-menu-bg,#16191f); display:flex; flex-direction:column; gap:4px; }
    .avatary-lb-thumb-wrap { position: relative; }
    .avatary-lb-thumb { width:100%; height:auto; object-fit:contain; border-radius:6px; background:#0f1116; display:block; }
    .avatary-lb-replace {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      border: 1px solid var(--border-color,#434958);
      background: rgba(20, 24, 31, 0.88);
      color: var(--input-text,#e6e9ef);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.9;
    }
    .avatary-lb-replace:hover { opacity: 1; background: rgba(30, 36, 46, 0.96); }
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
      uploadedAt: {},
      isUploading: false,
      uploadDone: 0,
      uploadTotal: 0,
    };
  }
  const state = node.properties[STATE_KEY];
  if (!Array.isArray(state.files)) state.files = [];
  if (!state.uploadedAt || typeof state.uploadedAt !== 'object') state.uploadedAt = {};
  if (!state.subfolder) state.subfolder = MANAGED_SUBFOLDER;
  if (typeof state.isUploading !== 'boolean') state.isUploading = false;
  if (!Number.isFinite(state.uploadDone)) state.uploadDone = 0;
  if (!Number.isFinite(state.uploadTotal)) state.uploadTotal = 0;
  return state;
}

function getFilesLatestFirst(state) {
  return [...state.files].sort((a, b) => {
    const tsA = Number(state.uploadedAt?.[a] || 0);
    const tsB = Number(state.uploadedAt?.[b] || 0);
    if (tsA !== tsB) return tsB - tsA;
    return String(a).localeCompare(String(b));
  });
}

function getHiddenWidget(node) {
  return node.widgets?.find((w) => w.name === HIDDEN_INPUT_NAME) || null;
}

function syncUploadState(node) {
  const state = getState(node);
  const hidden = getHiddenWidget(node);
  state.files = getFilesLatestFirst(state);
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

function filterImageFiles(files) {
  return Array.from(files || []).filter((file) => file?.type?.startsWith('image/'));
}

async function uploadFiles(node, files) {
  const selectedFiles = filterImageFiles(files);
  if (!selectedFiles.length) return;

  const state = getState(node);
  if (state.isUploading) return;
  state.isUploading = true;
  state.uploadDone = 0;
  state.uploadTotal = selectedFiles.length;
  renderPanel(node);
  app.graph?.setDirtyCanvas?.(true, true);

  try {
    for (const file of selectedFiles) {
      const uploaded = await uploadSingle(file);
      const name = uploaded?.name || uploaded?.filename || file.name;
      if (state.files.includes(name)) {
        state.files = state.files.filter((existing) => existing !== name);
      }
      state.uploadedAt[name] = Date.now();
      state.files.unshift(name);
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
}

async function handleUpload(node) {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = ACCEPTED_TYPES.join(',');
  picker.multiple = true;

  picker.onchange = async () => {
    await uploadFiles(node, picker.files);
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
  if (state.uploadedAt && Object.prototype.hasOwnProperty.call(state.uploadedAt, name)) {
    delete state.uploadedAt[name];
  }
  syncUploadState(node);
  renderPanel(node);
  app.graph?.setDirtyCanvas?.(true, true);
}

async function replaceFile(node, oldName) {
  const state = getState(node);
  if (state.isUploading) return;

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = ACCEPTED_TYPES.join(',');
  picker.multiple = false;

  picker.onchange = async () => {
    const picked = filterImageFiles(picker.files);
    if (!picked.length) return;

    state.isUploading = true;
    state.uploadDone = 0;
    state.uploadTotal = 1;
    renderPanel(node);
    app.graph?.setDirtyCanvas?.(true, true);

    try {
      const uploaded = await uploadSingle(picked[0]);
      const newName = uploaded?.name || uploaded?.filename || picked[0].name;

      if (newName !== oldName) {
        try {
          await deleteFilesFromDisk([oldName]);
        } catch (err) {
          console.error('[AvataryLoadImageBatch] replace delete failed', err);
        }
      }

      state.files = state.files.filter((file) => file !== oldName && file !== newName);
      if (state.uploadedAt && Object.prototype.hasOwnProperty.call(state.uploadedAt, oldName)) {
        delete state.uploadedAt[oldName];
      }
      state.uploadedAt[newName] = Date.now();
      state.files.unshift(newName);
      state.uploadDone = 1;
    } catch (err) {
      console.error('[AvataryLoadImageBatch] replace upload failed', err);
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
  state.uploadedAt = {};
  syncUploadState(node);
  renderPanel(node);
  app.graph?.setDirtyCanvas?.(true, true);
}

function applyGridColumns(list, count) {
  if (!list) return;
  list.style.gridTemplateColumns = count === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))';
}

function applyOverflowAfterFour(list, count) {
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

function lockNodeSize(node) {
  if (!node) return;
  node.resizable = false;
  node.flags = { ...(node.flags || {}), no_resize: true };
  node.size = [FIXED_NODE_WIDTH, FIXED_NODE_HEIGHT];
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
  state.files = getFilesLatestFirst(state);
  panel.innerHTML = '';

  const actions = document.createElement('div');
  actions.className = 'avatary-lb-actions';

  const setDragHover = (isActive) => {
    panel.classList.toggle('drag-hover', isActive);
  };

  panel.ondragenter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(true);
  };
  panel.ondragover = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(true);
  };
  panel.ondragleave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!panel.contains(e.relatedTarget)) setDragHover(false);
  };
  panel.ondrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(false);
    const droppedFiles = e?.dataTransfer?.files;
    if (!droppedFiles?.length) return;
    try {
      await uploadFiles(node, droppedFiles);
    } catch (err) {
      console.error('[AvataryLoadImageBatch] drop upload failed', err);
    }
  };

  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'avatary-lb-btn';
  uploadBtn.textContent = 'Upload Images';
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

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'avatary-lb-thumb-wrap';

      const img = document.createElement('img');
      img.className = 'avatary-lb-thumb';
      img.loading = 'lazy';
      img.src = previewUrl(name, state.subfolder);
      img.alt = name;
      img.onload = () => applyOverflowAfterFour(list, state.files.length);
      img.ondblclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openViewer(img.src, name);
      };

      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'avatary-lb-replace';
      replaceBtn.textContent = '↻';
      replaceBtn.title = 'Replace image';
      replaceBtn.disabled = state.isUploading;
      replaceBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await replaceFile(node, name);
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
      thumbWrap.appendChild(img);
      thumbWrap.appendChild(replaceBtn);
      item.appendChild(thumbWrap);
      item.appendChild(meta);
      item.ondblclick = (e) => {
        if (e.target === removeBtn || e.target === replaceBtn) return;
        openViewer(img.src, name);
      };
      list.appendChild(item);
    }
    panel.appendChild(list);
    requestAnimationFrame(() => applyOverflowAfterFour(list, state.files.length));
  }

  syncUploadState(node);
  lockNodeSize(node);
}

app.registerExtension({
  name: 'Avatary.LoadImageBatch.MultiUploadPreview',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS) return;

    const origCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function (...args) {
      const r = origCreated?.apply(this, args);
      lockNodeSize(this);
      renderPanel(this);
      setTimeout(() => {
        try {
          lockNodeSize(this);
          renderPanel(this);
        } catch (_err) {}
      }, 60);
      return r;
    };

    const origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (...args) {
      const r = origConfigure?.apply(this, args);
      lockNodeSize(this);
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
    lockNodeSize(node);
    renderPanel(node);
  },
});

function buildNodeIndex() {
  const map = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (n.comfyClass === NODE_CLASS || n.type === NODE_CLASS) {
        map.set(String(n.id), n);
      }
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app.graph);
  return map;
}

function resolveNode(map, promptId) {
  const id = String(promptId);
  if (map.has(id)) return map.get(id);
  const tail = id.includes(':') ? id.slice(id.lastIndexOf(':') + 1) : null;
  if (tail && map.has(tail)) return map.get(tail);
  return null;
}

if (!app._avataryLoadImagesGraphToPromptWrapped) {
  app._avataryLoadImagesGraphToPromptWrapped = true;
  const _origGraphToPrompt = app.graphToPrompt.bind(app);
  app.graphToPrompt = async (...args) => {
    const result = await _origGraphToPrompt(...args);
    const out = result?.output;
    if (!out) return result;

    let index = null;
    for (const id in out) {
      const entry = out[id];
      if (!entry || entry.class_type !== NODE_CLASS) continue;
      if (!index) index = buildNodeIndex();
      const node = resolveNode(index, id);
      const state = node?.properties?.[STATE_KEY] || {};
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify({
        subfolder: state.subfolder || MANAGED_SUBFOLDER,
        files: Array.isArray(state.files) ? state.files : [],
      });
    }
    return result;
  };
}
