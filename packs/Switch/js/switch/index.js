import { app } from "/scripts/app.js";
import {
  setupNode,
  restoreFromProperties,
  readState,
  handleConnect,
  handleDisconnect,
  updateOutputType,
  STATE_PROP,
} from "./core.mjs";
import { drawSwitchRows, hitToggle, hitLabel, labelScreenRect } from "./render.mjs";
import { openLabelEditor, cancelEditorForNode } from "./editor.mjs";

const HIDDEN_INPUT_NAME = "SwitchState";

let _loadingGraph = false;
if (app && app.loadGraphData && !app._comfySwitchLoadWrapped) {
  app._comfySwitchLoadWrapped = true;
  const _origLoadGraphData = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    _loadingGraph = true;
    let r;
    try {
      r = _origLoadGraphData(...args);
    } finally {
      Promise.resolve(r).finally(() => setTimeout(() => { _loadingGraph = false; }, 300));
    }
    return r;
  };
}

app.registerExtension({
  name: "ComfySwitch",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "ComfySwitch") return;

    const _origCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      _origCreated?.apply(this, arguments);
      setupNode(this);
      queueMicrotask(() => restoreFromProperties(this));
    };

    const _origRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function () {
      cancelEditorForNode(this);
      if (this._pendingDisconnects?.size) {
        for (const timerId of this._pendingDisconnects.values()) {
          clearTimeout(timerId);
        }
        this._pendingDisconnects.clear();
      }
      return _origRemoved?.apply(this, arguments);
    };

    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      this._switchConfiguring = true;
      try {
        const r = _origConfigure?.apply(this, arguments);
        restoreFromProperties(this);
        return r;
      } finally {
        this._switchConfiguring = false;
      }
    };

    const _origOnConnectionsChange = nodeType.prototype.onConnectionsChange;
    nodeType.prototype.onConnectionsChange = function (type, slotIndex, isConnected) {
      if (type === 1 && !this._switchConfiguring && !_loadingGraph) {
        if (isConnected) handleConnect(this, slotIndex + 1);
        else handleDisconnect(this, slotIndex + 1);
      }
      return _origOnConnectionsChange?.apply(this, arguments);
    };

    const _origDraw = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (ctx) {
      if (_origDraw) _origDraw.call(this, ctx);
      if (this.flags?.collapsed) return;
      drawSwitchRows(this, ctx);
    };

    const _origDown = nodeType.prototype.onMouseDown;
    nodeType.prototype.onMouseDown = function (e, pos) {
      if (!this.flags?.collapsed) {
        const inputs = this.inputs;
        if (inputs) {
          const w = this.size[0];
          for (let i = 0; i < inputs.length; i++) {
            if (hitToggle(pos, w, i)) {
              const slotIdx1 = i + 1;
              const slot = inputs[i];
              const connected = slot != null && slot.link != null;
              const isTrailing = !connected && slotIdx1 === inputs.length;
              if (connected && !isTrailing) {
                const state = readState(this);
                if (state.activeIndex !== slotIdx1) {
                  state.activeIndex = slotIdx1;
                  updateOutputType(this);
                  app.graph?.setDirtyCanvas?.(true, true);
                }
              }
              return true;
            }
          }

          for (let i = 0; i < inputs.length; i++) {
            if (hitLabel(pos, w, i)) {
              const rect = labelScreenRect(this, i + 1);
              openLabelEditor(this, i + 1, rect);
              return true;
            }
          }
        }
      }
      if (_origDown) return _origDown.call(this, e, pos);
    };
  },
});

function buildNodeIndex() {
  const index = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (n.comfyClass === "ComfySwitch" || n.type === "ComfySwitch") {
        index.set(String(n.id), n);
      }
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app.graph);
  return index;
}

function findNode(index, promptId) {
  const sId = String(promptId);
  if (index.has(sId)) return index.get(sId);
  const tail = sId.includes(":") ? sId.slice(sId.lastIndexOf(":") + 1) : null;
  if (tail && index.has(tail)) return index.get(tail);
  return null;
}

const _origGraphToPrompt = app.graphToPrompt.bind(app);
app.graphToPrompt = async function (...args) {
  const result = await _origGraphToPrompt(...args);
  const out = result?.output;
  if (out) {
    let index = null;
    for (const id in out) {
      const entry = out[id];
      if (!entry || entry.class_type !== "ComfySwitch") continue;
      if (!index) index = buildNodeIndex();
      const node = findNode(index, id);
      const state = node?.properties?.[STATE_PROP];
      const activeIdx = state?.activeIndex || 1;
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = String(activeIdx);
    }
  }
  return result;
};
