import { app } from "/scripts/app.js";
import { ROW_H, TOP_PAD } from "./render.mjs";

export const STATE_PROP = "switchState";
export const MAX_INPUTS = 32;

const SLOT_NAME = (i) => `input_${i}`;
const BOT_PAD = 8;
const DEFAULT_W = 260;
const MIN_BODY_H = 60;

function defaultState() {
  return { activeIndex: 0, labels: {}, visibleCount: 1 };
}

export function readState(node) {
  if (!node.properties) node.properties = {};
  if (!node.properties[STATE_PROP]) {
    node.properties[STATE_PROP] = defaultState();
  }
  return node.properties[STATE_PROP];
}

function clearNativeInputs(node) {
  if (!node.inputs) return;
  for (let i = node.inputs.length - 1; i >= 0; i--) {
    node.removeInput(i);
  }
}

export function normalizeSlots(node) {
  if (!node.inputs) return;
  const state = readState(node);
  const beforeLen = node.inputs.length;

  let connected = 0;
  for (const s of node.inputs) {
    if (s.link != null) connected++;
  }

  const target = Math.min(Math.max(connected + (connected < MAX_INPUTS ? 1 : 0), 1), MAX_INPUTS);

  while ((node.inputs.length || 0) > target) {
    const last = node.inputs[node.inputs.length - 1];
    if (last && last.link != null) break;
    node.removeInput(node.inputs.length - 1);
  }

  while ((node.inputs.length || 0) < target) {
    addInputSlot(node, node.inputs.length + 1);
  }

  for (let i = 0; i < node.inputs.length; i++) {
    const nm = SLOT_NAME(i + 1);
    if (node.inputs[i].name !== nm) node.inputs[i].name = nm;
    if (node.inputs[i].label !== "​") node.inputs[i].label = "​";
  }

  if (state.visibleCount !== node.inputs.length) state.visibleCount = node.inputs.length;
  const w = Math.max(node.size[0] || 0, DEFAULT_W);
  if (node.size[0] !== w) node.size[0] = w;
  if (node.inputs.length !== beforeLen) {
    const h = computeNodeHeight(node.inputs.length);
    if (node.size[1] !== h) node.size[1] = h;
  }

  if (state.labels) {
    for (const key in state.labels) {
      const k = parseInt(key, 10);
      if (!Number.isFinite(k) || k < 1 || k > node.inputs.length) {
        delete state.labels[key];
      }
    }
  }

  const currentActive = state.activeIndex;
  const inRange = currentActive >= 1 && currentActive <= node.inputs.length;
  if (!inRange) {
    let firstConnected = 0;
    for (let i = 0; i < node.inputs.length; i++) {
      if (node.inputs[i]?.link != null) {
        firstConnected = i + 1;
        break;
      }
    }
    state.activeIndex = firstConnected;
  }

  updateOutputType(node);
  app.graph?.setDirtyCanvas?.(true, true);
}

function addInputSlot(node, idx1) {
  const slot = node.addInput(SLOT_NAME(idx1), "*");
  slot.label = "​";
  return slot;
}

function computeNodeHeight(slotCount) {
  return TOP_PAD + slotCount * ROW_H + BOT_PAD;
}

export function setupNode(node) {
  clearNativeInputs(node);
  normalizeSlots(node);
  node.size[1] = Math.max(node.size[1], MIN_BODY_H);
}

export function restoreFromProperties(node) {
  normalizeSlots(node);
}

export function getUpstreamType(node, slotIdx1) {
  const slot = node.inputs?.[slotIdx1 - 1];
  const linkId = slot?.link;
  if (linkId == null) return null;
  let link = node.graph?.links?.[linkId];
  if (!link && typeof node.graph?.links?.get === "function") {
    link = node.graph.links.get(linkId);
  }
  if (!link) return null;
  const upstream = node.graph?.getNodeById?.(link.origin_id);
  const upType = upstream?.outputs?.[link.origin_slot]?.type;
  return upType || null;
}

export function updateOutputType(node) {
  const state = readState(node);
  const out = node.outputs?.[0];
  if (!out) return;
  const hasActiveLink = state.activeIndex >= 1 && node.inputs?.[state.activeIndex - 1]?.link != null;
  const upType = hasActiveLink ? getUpstreamType(node, state.activeIndex) : null;
  if (upType) {
    if (out.type !== upType) out.type = upType;
  } else if (!hasActiveLink) {
    if (out.type !== "*") out.type = "*";
  }
}

export function handleConnect(node, slotIdx1) {
  const state = readState(node);

  let wasReplace = false;
  if (node._pendingDisconnects?.has(slotIdx1)) {
    clearTimeout(node._pendingDisconnects.get(slotIdx1));
    node._pendingDisconnects.delete(slotIdx1);
    wasReplace = true;
  }

  state.activeIndex = slotIdx1;

  if (!wasReplace) {
    const isLast = slotIdx1 === (node.inputs?.length || 0);
    if (isLast && (node.inputs?.length || 0) < MAX_INPUTS) {
      addInputSlot(node, (node.inputs?.length || 0) + 1);
      state.visibleCount = node.inputs.length;
      node.size[1] = computeNodeHeight(state.visibleCount);
    }
  }

  updateOutputType(node);
  app.graph?.setDirtyCanvas?.(true, true);
}

export function handleDisconnect(node, slotIdx) {
  if (!node._pendingDisconnects) node._pendingDisconnects = new Map();
  if (node._pendingDisconnects.has(slotIdx)) {
    clearTimeout(node._pendingDisconnects.get(slotIdx));
  }
  const timer = setTimeout(() => {
    node._pendingDisconnects.delete(slotIdx);
    actuallyDisconnect(node, slotIdx);
  }, 0);
  node._pendingDisconnects.set(slotIdx, timer);
}

function actuallyDisconnect(node, slotIdx) {
  if (!node.graph) return;

  const state = readState(node);
  const wasActive = state.activeIndex === slotIdx;
  const slotCount = node.inputs?.length || 0;

  if (slotIdx >= 1 && slotIdx <= slotCount) {
    node.removeInput(slotIdx - 1);
  }

  if (node.inputs) {
    for (let i = 0; i < node.inputs.length; i++) {
      node.inputs[i].name = `input_${i + 1}`;
      node.inputs[i].label = "​";
    }
  }

  const oldLabels = state.labels || {};
  const newLabels = {};
  for (const key in oldLabels) {
    const k = parseInt(key, 10);
    if (!Number.isFinite(k)) continue;
    if (k < slotIdx) newLabels[k] = oldLabels[key];
    else if (k > slotIdx) newLabels[k - 1] = oldLabels[key];
  }
  state.labels = newLabels;

  const inputs = node.inputs || [];
  if (wasActive) {
    const above = slotIdx - 1;
    const below = slotIdx;
    if (above >= 1 && inputs[above - 1]?.link != null) {
      state.activeIndex = above;
    } else if (below >= 1 && below <= inputs.length && inputs[below - 1]?.link != null) {
      state.activeIndex = below;
    } else {
      state.activeIndex = 0;
    }
  } else if (state.activeIndex > slotIdx) {
    state.activeIndex -= 1;
  }

  const last = inputs[inputs.length - 1];
  if (inputs.length === 0) {
    addInputSlot(node, 1);
  } else if (last && last.link != null && inputs.length < MAX_INPUTS) {
    addInputSlot(node, inputs.length + 1);
  }

  state.visibleCount = node.inputs?.length || 1;
  node.size[1] = computeNodeHeight(state.visibleCount);

  updateOutputType(node);
  node.graph?.setDirtyCanvas?.(true, true);
}
