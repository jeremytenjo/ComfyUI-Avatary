import { app } from "/scripts/app.js";

const NODE_CLASS = "AvatarySwitch";
const STATE_KEY = "switchState";
const HIDDEN_INPUT_NAME = "SwitchState";
const MAX_INPUTS = 32;
const DEFAULT_W = 340;
const PANEL_HEIGHT = 220;

function rowName(i) {
  return `input_${i}`;
}

function getState(node) {
  if (!node.properties) node.properties = {};
  if (!node.properties[STATE_KEY]) {
    node.properties[STATE_KEY] = { activeIndex: 1, labels: {}, visibleCount: 1 };
  }
  return node.properties[STATE_KEY];
}

function isConnected(slot) {
  return !!(slot && slot.link != null);
}

function connectedCount(node) {
  let n = 0;
  for (const s of node.inputs || []) if (isConnected(s)) n += 1;
  return n;
}

function normalizeInputs(node) {
  if (!node.inputs) node.inputs = [];
  const state = getState(node);
  const connected = connectedCount(node);
  const target = Math.min(Math.max(connected + (connected < MAX_INPUTS ? 1 : 0), 1), MAX_INPUTS);

  while (node.inputs.length > target) {
    const last = node.inputs[node.inputs.length - 1];
    if (isConnected(last)) break;
    node.removeInput(node.inputs.length - 1);
  }
  while (node.inputs.length < target) {
    node.addInput(rowName(node.inputs.length + 1), "*");
  }

  for (let i = 0; i < node.inputs.length; i++) {
    const slot = node.inputs[i];
    slot.name = rowName(i + 1);
    slot.type = "*";
    slot.label = "\u200b";
  }

  state.visibleCount = node.inputs.length;
  if (state.activeIndex < 1 || state.activeIndex > node.inputs.length) {
    const firstConnected = (node.inputs || []).findIndex((s) => isConnected(s));
    state.activeIndex = firstConnected >= 0 ? firstConnected + 1 : 1;
  }

  for (const key of Object.keys(state.labels || {})) {
    const idx = Number(key);
    if (!Number.isFinite(idx) || idx < 1 || idx > node.inputs.length) delete state.labels[key];
  }
}

function upstreamType(node, idx1) {
  const slot = node.inputs?.[idx1 - 1];
  const linkId = slot?.link;
  if (linkId == null) return "";

  let link = node.graph?.links?.[linkId];
  if (!link && typeof node.graph?.links?.get === "function") link = node.graph.links.get(linkId);
  if (!link) return "";

  const up = node.graph?.getNodeById?.(link.origin_id);
  return up?.outputs?.[link.origin_slot]?.type || "";
}

function getRows(node) {
  const state = getState(node);
  const rows = [];
  for (let i = 1; i <= (node.inputs?.length || 0); i++) {
    const connected = isConnected(node.inputs[i - 1]);
    const trailing = !connected && i === node.inputs.length;
    const upType = upstreamType(node, i) || "";
    if (trailing) continue;
    rows.push({
      i,
      connected,
      trailing,
      active: state.activeIndex === i,
      label: state.labels[i] || "",
      type: upType,
    });
  }
  return rows;
}

function ensurePanelWidget(node) {
  if (node._avatarySwitchPanel?.isConnected) return node._avatarySwitchPanel;

  const panel = document.createElement("div");
  panel.className = "avatary-switch-panel";
  panel.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "gap:8px",
    "padding:8px",
    "height:100%",
    "overflow:auto",
    "box-sizing:border-box",
    "font:12px Inter, system-ui, sans-serif",
  ].join(";");

  node._avatarySwitchPanel = panel;

  if (typeof node.addDOMWidget === "function") {
    const w = node.addDOMWidget("Switch", "switch_panel", panel, {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => PANEL_HEIGHT,
    });
    if (w) {
      w._avatarySwitchWidget = true;
      w.serialize = false;
    }
  }

  return panel;
}

function renderPanel(node) {
  const state = getState(node);
  const panel = ensurePanelWidget(node);
  if (!panel) return;

  const rows = getRows(node);
  panel.innerHTML = "";

  for (const row of rows) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;";

    const input = document.createElement("input");
    input.type = "text";
    input.value = row.label;
    input.placeholder = row.type || "Label";
    input.disabled = row.trailing;
    input.style.cssText = "height:28px;border-radius:8px;border:1px solid #4b4f5a;background:#2a2d35;color:#d8d8d8;padding:0 10px;";
    input.addEventListener("change", () => {
      const v = String(input.value || "").trim();
      if (!v) delete state.labels[row.i];
      else state.labels[row.i] = v;
      app.graph?.setDirtyCanvas?.(true, true);
      renderPanel(node);
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.disabled = row.trailing || !row.connected;
    const name = row.label || row.type || `Row ${row.i}`;
    btn.textContent = row.trailing ? "Waiting" : row.active ? `ON · ${name}` : `OFF · ${name}`;
    btn.style.cssText = [
      "height:28px",
      "min-width:100px",
      "border-radius:8px",
      "border:1px solid #4b4f5a",
      row.active ? "background:#f66744;color:#fff;" : "background:#30333b;color:#d8d8d8;",
      "padding:0 10px",
      "cursor:pointer",
    ].join("");
    btn.addEventListener("click", () => {
      if (row.trailing || !row.connected) return;
      state.activeIndex = row.i;
      app.graph?.setDirtyCanvas?.(true, true);
      renderPanel(node);
    });

    wrap.appendChild(input);
    wrap.appendChild(btn);
    panel.appendChild(wrap);
  }
}

function clearLegacySwitchWidgets(node) {
  if (!node.widgets) return;
  node.widgets = node.widgets.filter((w) => !w?._avatarySwitchWidget);
}

function refreshNode(node) {
  normalizeInputs(node);
  clearLegacySwitchWidgets(node);
  renderPanel(node);
  node.size[0] = Math.max(node.size?.[0] || 0, DEFAULT_W);
  node.size[1] = Math.max(node.size?.[1] || 0, PANEL_HEIGHT + 90);
  app.graph?.setDirtyCanvas?.(true, true);
}

app.registerExtension({
  name: "Avatary.Switch.Nodes2CustomPanel",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS) return;

    const _origCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      _origCreated?.apply(this, arguments);
      refreshNode(this);
    };

    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const r = _origConfigure?.apply(this, arguments);
      refreshNode(this);
      return r;
    };

    const _origConn = nodeType.prototype.onConnectionsChange;
    nodeType.prototype.onConnectionsChange = function () {
      const r = _origConn?.apply(this, arguments);
      refreshNode(this);
      return r;
    };

    const _origRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function () {
      if (this._avatarySwitchPanel?.isConnected) this._avatarySwitchPanel.remove();
      this._avatarySwitchPanel = null;
      return _origRemoved?.apply(this, arguments);
    };
  },
});

function buildNodeIndex() {
  const map = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (n.comfyClass === NODE_CLASS || n.type === NODE_CLASS) map.set(String(n.id), n);
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
  const tail = id.includes(":") ? id.slice(id.lastIndexOf(":") + 1) : null;
  if (tail && map.has(tail)) return map.get(tail);
  return null;
}

const _origGraphToPrompt = app.graphToPrompt.bind(app);
app.graphToPrompt = async function (...args) {
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
