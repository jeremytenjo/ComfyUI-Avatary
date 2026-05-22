// @ts-nocheck
import { app } from '/scripts/app.js';
import { createTextfield } from '../components/textfield.js';
import { createToggle, ensureToggleStyles } from '../components/toggle.js';

const NODE_CLASS = 'AvatarySwitch';
const STATE_KEY = 'switchState';
const HIDDEN_INPUT_NAME = 'SwitchState';
const MAX_INPUTS = 32;
const DEFAULT_W = 340;
const PANEL_HEIGHT = 220;
const STYLE_ID = 'avatary-switch-panel-styles';
const TOGGLE_STYLE_ID_FALLBACK = 'avatary-switch-toggle-styles-fallback';

function ensureToggleStylesFallback() {
  if (document.getElementById(TOGGLE_STYLE_ID_FALLBACK)) return;
  const style = document.createElement('style');
  style.id = TOGGLE_STYLE_ID_FALLBACK;
  style.textContent = `
    .avatary-switch-toggle {
      flex: 0 0 auto;
      width: 44px;
      height: 24px;
      border-radius: 999px;
      border: 1px solid #555d71;
      background: #2e3442;
      position: relative;
      cursor: pointer;
      box-sizing: border-box;
      transition: background .15s ease, border-color .15s ease;
    }
    .avatary-switch-toggle .knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #f1f3f7;
      box-shadow: 0 1px 2px rgba(0,0,0,.35);
      transition: left .15s ease;
    }
    .avatary-switch-toggle.active {
      background: var(--p-primary-color, #60A5FA);
      border-color: var(--p-primary-color, #60A5FA);
    }
    .avatary-switch-toggle.active .knob { left: 22px; }
    .avatary-switch-toggle.disabled {
      opacity: .4;
      cursor: default;
    }
  `;
  document.head.appendChild(style);
}

function createToggleFallback({ active, disabled, title, onToggle }) {
  const toggle = document.createElement('div');
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', active ? 'true' : 'false');
  if (title) toggle.title = title;
  toggle.className = 'avatary-switch-toggle';
  if (active) toggle.classList.add('active');
  if (disabled) toggle.classList.add('disabled');

  const knob = document.createElement('span');
  knob.className = 'knob';
  toggle.appendChild(knob);

  toggle.addEventListener('click', () => {
    if (disabled) return;
    onToggle?.();
  });

  return toggle;
}

const _toggleApi = {
  ensureToggleStyles: ensureToggleStyles || ensureToggleStylesFallback,
  createToggle: createToggle || createToggleFallback,
};

function rowName(i) {
  return `input_${i}`;
}

function getState(node) {
  if (!node.properties) node.properties = {};
  if (!node.properties[STATE_KEY]) {
    node.properties[STATE_KEY] = {
      activeIndex: 1,
      labels: {},
      visibleCount: 1,
    };
  }
  return node.properties[STATE_KEY];
}

function _iterGraphLinks(graph) {
  const links = graph?.links;
  if (!links) return [];
  if (typeof links.values === 'function') {
    return Array.from(links.values());
  }
  return Object.values(links);
}

function isInputConnected(node, slotIdx0) {
  const slot = node.inputs?.[slotIdx0];
  if (slot && slot.link != null) return true;

  const nodeId = node?.id;
  if (nodeId == null) return false;
  for (const link of _iterGraphLinks(node.graph)) {
    if (!link) continue;
    // target_slot is 0-based input index on target node.
    if (link.target_id === nodeId && link.target_slot === slotIdx0) return true;
  }
  return false;
}

function connectedCount(node) {
  let n = 0;
  const inputs = node.inputs || [];
  for (let i = 0; i < inputs.length; i++) {
    if (isInputConnected(node, i)) n += 1;
  }
  return n;
}

function connectionSignature(node) {
  const parts = [];
  const inputs = node.inputs || [];
  for (let i = 0; i < inputs.length; i++) {
    const link = inputs[i]?.link;
    parts.push(`${i + 1}:${link == null ? 'x' : String(link)}`);
  }
  return parts.join('|');
}

function forEachSwitchNode(fn) {
  const seen = new Set();
  const visit = (graph) => {
    if (!graph || seen.has(graph)) return;
    seen.add(graph);
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (n.comfyClass === NODE_CLASS || n.type === NODE_CLASS) fn(n);
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app.graph);
}

function normalizeInputs(node) {
  if (!node.inputs) node.inputs = [];
  const state = getState(node);
  const connected = connectedCount(node);
  const target = Math.min(
    Math.max(connected + (connected < MAX_INPUTS ? 1 : 0), 1),
    MAX_INPUTS,
  );

  while (node.inputs.length > target) {
    const lastIdx = node.inputs.length - 1;
    if (isInputConnected(node, lastIdx)) break;
    node.removeInput(node.inputs.length - 1);
  }
  while (node.inputs.length < target) {
    node.addInput(rowName(node.inputs.length + 1), '*');
  }

  for (let i = 0; i < node.inputs.length; i++) {
    const slot = node.inputs[i];
    slot.name = rowName(i + 1);
    slot.type = '*';
    slot.label = '\u200b';
  }

  state.visibleCount = node.inputs.length;
  if (state.activeIndex < 1 || state.activeIndex > node.inputs.length) {
    const firstConnected = (node.inputs || []).findIndex((_, idx) =>
      isInputConnected(node, idx),
    );
    state.activeIndex = firstConnected >= 0 ? firstConnected + 1 : 1;
  }

  for (const key of Object.keys(state.labels || {})) {
    const idx = Number(key);
    if (!Number.isFinite(idx) || idx < 1 || idx > node.inputs.length)
      delete state.labels[key];
  }
}

function upstreamType(node, idx1) {
  const slot = node.inputs?.[idx1 - 1];
  const linkId = slot?.link;
  if (linkId == null) return '';

  let link = node.graph?.links?.[linkId];
  if (!link && typeof node.graph?.links?.get === 'function')
    link = node.graph.links.get(linkId);
  if (!link) return '';

  const up = node.graph?.getNodeById?.(link.origin_id);
  return up?.outputs?.[link.origin_slot]?.type || '';
}

function getRows(node) {
  const state = getState(node);
  const rows = [];
  for (let i = 1; i <= (node.inputs?.length || 0); i++) {
    const connected = isInputConnected(node, i - 1);
    const trailing = !connected && i === node.inputs.length;
    const upType = upstreamType(node, i) || '';
    if (trailing) continue;
    rows.push({
      i,
      connected,
      trailing,
      active: state.activeIndex === i,
      label: state.labels[i] || '',
      type: upType,
    });
  }
  return rows;
}

function ensurePanelWidget(node) {
  // Guard: reuse the existing panel if it was already added to node.widgets.
  // We cannot rely on panel.isConnected here — a freshly-created element that
  // hasn't been rendered to the canvas yet has isConnected===false, which
  // would cause a new duplicate DOM widget to be added on every refreshNode
  // call during the onNodeCreated→onConfigure→timeout restore sequence.
  if (
    node._avatarySwitchPanel &&
    node.widgets?.some((w) => w?._avatarySwitchPanelWidget)
  ) {
    return node._avatarySwitchPanel;
  }

  // Remove any stale panel widgets before adding a fresh one.
  if (node.widgets) {
    node.widgets = node.widgets.filter((w) => !w?._avatarySwitchPanelWidget);
  }
  node._avatarySwitchPanel = null;

  const panel = document.createElement('div');
  panel.className = 'avatary-switch-panel';
  panel.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'gap:8px',
    'padding:1px',
    'height:100%',
    'overflow:auto',
    'box-sizing:border-box',
    'font:12px Inter, system-ui, sans-serif',
  ].join(';');

  node._avatarySwitchPanel = panel;

  if (typeof node.addDOMWidget === 'function') {
    const w = node.addDOMWidget('Switch', 'switch_panel', panel, {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => PANEL_HEIGHT,
    });
    if (w) {
      // Keep DOM panel widget persistent across refreshes.
      // Legacy cleanup only removes widgets explicitly marked legacy.
      w._avatarySwitchPanelWidget = true;
      w.serialize = false;
      node._avatarySwitchUsesDom = true;
      return panel;
    }
  }

  node._avatarySwitchUsesDom = false;
  return null;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .avatary-switch-panel { font-family: Inter, system-ui, sans-serif; }
    .avatary-switch-row { display:flex; align-items:center; gap:10px; margin-bottom:0px; }
    .avatary-switch-input {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 30px;
      height: 30px;
      border-radius: 10px;
      font-size: 12px;
      letter-spacing: 0;
      text-transform: none;
      padding: 0 10px;
    }
  `;
  document.head.appendChild(style);
}

function renderPanel(node) {
  const state = getState(node);
  ensureStyles();
  _toggleApi.ensureToggleStyles();
  const panel = ensurePanelWidget(node);

  const rows = getRows(node);
  if (!panel) {
    renderFallbackWidgets(node, rows, state);
    return;
  }

  clearFallbackWidgets(node);
  panel.innerHTML = '';

  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'Connect an input to start';
    empty.style.cssText =
      'color:#8d95a8;font-size:12px;padding:6px 2px;user-select:none;';
    panel.appendChild(empty);
    return;
  }

  for (const row of rows) {
    const wrap = document.createElement('div');
    wrap.className = 'avatary-switch-row';

    const input = createTextfield({
      value: row.label,
      placeholder: row.type || 'Label',
      disabled: row.trailing,
      className: 'avatary-switch-input',
      onChange: (nextValue) => {
        const v = String(nextValue || '').trim();
        if (!v) delete state.labels[row.i];
        else state.labels[row.i] = v;
        app.graph?.setDirtyCanvas?.(true, true);
        renderPanel(node);
      },
    });

    const disabled = row.trailing || !row.connected;
    const toggle = _toggleApi.createToggle({
      active: row.active,
      disabled,
      title: row.label || row.type || `Row ${row.i}`,
      onToggle: () => {
        state.activeIndex = row.i;
        app.graph?.setDirtyCanvas?.(true, true);
        renderPanel(node);
      },
    });

    wrap.appendChild(input);
    wrap.appendChild(toggle);
    panel.appendChild(wrap);
  }
}

function clearFallbackWidgets(node) {
  if (!node.widgets) return;
  node.widgets = node.widgets.filter((w) => !w?._avatarySwitchFallbackWidget);
}

function renderFallbackWidgets(node, rows, state) {
  clearFallbackWidgets(node);
  for (const row of rows) {
    const disabled = row.trailing || !row.connected;
    const label = node.addWidget(
      'text',
      `Label ${row.i}`,
      row.label || '',
      (v) => {
        const s = String(v || '').trim();
        if (!s) delete state.labels[row.i];
        else state.labels[row.i] = s;
      },
      { placeholder: row.type || 'Label', disabled },
    );
    label._avatarySwitchFallbackWidget = true;
    label.serialize = false;

    const btnText = disabled
      ? 'Waiting'
      : state.activeIndex === row.i
        ? 'ON'
        : 'OFF';
    const btn = node.addWidget(
      'button',
      `Switch ${row.i}: ${btnText}`,
      null,
      () => {
        if (disabled) return;
        state.activeIndex = row.i;
        renderPanel(node);
      },
    );
    btn._avatarySwitchFallbackWidget = true;
    btn.serialize = false;
  }
}

function clearLegacySwitchWidgets(node) {
  if (!node.widgets) return;
  node.widgets = node.widgets.filter(
    (w) => !w?._avatarySwitchLegacyWidget && !w?._avatarySwitchFallbackWidget,
  );
}

function refreshNode(node) {
  normalizeInputs(node);
  clearLegacySwitchWidgets(node);
  renderPanel(node);
  node.size[0] = Math.max(node.size?.[0] || 0, DEFAULT_W);
  node.size[1] = Math.max(node.size?.[1] || 0, PANEL_HEIGHT + 90);
  node._avatarySwitchConnSig = connectionSignature(node);
  app.graph?.setDirtyCanvas?.(true, true);
}

app.registerExtension({
  name: 'Avatary.Switch.Nodes2CustomPanel',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS) return;

    const _origCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function (...args) {
      _origCreated?.apply(this, args);
      refreshNode(this);
      // Some builds restore links after node creation; refresh again shortly.
      setTimeout(() => {
        try {
          refreshNode(this);
        } catch (_e) {}
      }, 0);
      setTimeout(() => {
        try {
          refreshNode(this);
        } catch (_e) {}
      }, 200);
    };

    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (...args) {
      const r = _origConfigure?.apply(this, args);
      refreshNode(this);
      return r;
    };

    const _origConn = nodeType.prototype.onConnectionsChange;
    nodeType.prototype.onConnectionsChange = function (...args) {
      const r = _origConn?.apply(this, args);
      refreshNode(this);
      return r;
    };

    // Fallback watcher: if a Comfy build skips onConnectionsChange for this
    // node type, detect connection changes during draw and refresh.
    const _origDraw = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (...args) {
      const r = _origDraw?.apply(this, args);
      const sig = connectionSignature(this);
      if (sig !== this._avatarySwitchConnSig) {
        try {
          refreshNode(this);
        } catch (_e) {}
      }
      return r;
    };

    const _origRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function (...args) {
      if (this._avatarySwitchPanel?.isConnected)
        this._avatarySwitchPanel.remove();
      this._avatarySwitchPanel = null;
      // Clear the panel widget from node.widgets so the guard in
      // ensurePanelWidget creates a fresh widget if this node is re-added.
      if (this.widgets) {
        this.widgets = this.widgets.filter(
          (w) => !w?._avatarySwitchPanelWidget,
        );
      }
      return _origRemoved?.apply(this, args);
    };
  },
});

// Some Nodes 2.0 builds restore links after node configure callbacks.
// Re-sync all Switch nodes after graph load settles so panel rows appear on reload.
if (app?.loadGraphData && !app._avatarySwitchLoadGraphWrapped) {
  app._avatarySwitchLoadGraphWrapped = true;
  const _origLoadGraphData = app.loadGraphData.bind(app);
  app.loadGraphData = (...args) => {
    const result = _origLoadGraphData(...args);
    Promise.resolve(result).finally(() => {
      setTimeout(() => {
        forEachSwitchNode((node) => {
          try {
            refreshNode(node);
          } catch (_e) {}
        });
      }, 250);
      setTimeout(() => {
        forEachSwitchNode((node) => {
          try {
            refreshNode(node);
          } catch (_e) {}
        });
      }, 900);
    });
    return result;
  };
}

function buildNodeIndex() {
  const map = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (n.comfyClass === NODE_CLASS || n.type === NODE_CLASS)
        map.set(String(n.id), n);
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
    const state = node?.properties?.[STATE_KEY];
    entry.inputs = entry.inputs || {};
    entry.inputs[HIDDEN_INPUT_NAME] = String(state?.activeIndex || 1);
  }
  return result;
};
