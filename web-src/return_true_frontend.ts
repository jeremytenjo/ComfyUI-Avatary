// @ts-nocheck
import { app } from '/scripts/app.js';

const NODE_CLASS = 'AvataryReturnTrue';
const INPUT_PREFIX = 'arg_';
const MAX_INPUTS = 64;
const DEFAULT_W = 320;
const NODE_VERTICAL_CHROME = 92;

function isTargetNode(node) {
  return (
    node?.comfyClass === NODE_CLASS ||
    node?.type === NODE_CLASS ||
    node?.constructor?.type === NODE_CLASS
  );
}

function inputKeyForIndex(index) {
  return `${INPUT_PREFIX}${index}`;
}

function indexFromInputName(name) {
  const match = String(name || '').match(/^arg_(\d+)$/);
  if (!match) return 0;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 1 && index <= MAX_INPUTS ? index : 0;
}

function getLinkForInput(input) {
  if (!input) return null;
  if (input.link != null) return input.link;
  if (Array.isArray(input.links) && input.links.length) return input.links[0];
  return null;
}

function isInputConnected(input) {
  return getLinkForInput(input) != null;
}

function visibleCountForExistingInputs(inputs) {
  let highestConnected = 0;
  for (const input of inputs || []) {
    const index = indexFromInputName(input?._avataryReturnTrueInputKey || input?.name);
    if (!index || !isInputConnected(input)) continue;
    highestConnected = Math.max(highestConnected, index);
  }
  return Math.min(MAX_INPUTS, highestConnected + 1 || 1);
}

function syncInputs(node) {
  if (!node) return;
  const existing = Array.isArray(node.inputs) ? node.inputs : [];
  const visibleCount = visibleCountForExistingInputs(existing);
  const existingByIndex = new Map();

  for (const input of existing) {
    const index = indexFromInputName(input?._avataryReturnTrueInputKey || input?.name);
    if (!index) continue;
    const current = existingByIndex.get(index);
    if (!current || isInputConnected(input)) {
      existingByIndex.set(index, input);
    }
  }

  const dynamicInputs = [];
  for (let index = 1; index <= visibleCount; index += 1) {
    const inputKey = inputKeyForIndex(index);
    const input = existingByIndex.get(index) || {
      name: inputKey,
      type: '*',
      link: null,
    };
    input.name = inputKey;
    input.type = '*';
    input._avataryReturnTrueInputKey = inputKey;
    dynamicInputs.push(input);
  }

  node.inputs = dynamicInputs;
  node.graph?.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas?.(true, true);
}

function fitNodeHeight(node) {
  const width = Math.max(node.size?.[0] || 0, DEFAULT_W);
  const inputCount = Math.max(1, node.inputs?.length || 1);
  const height = Math.max(120, inputCount * 26 + NODE_VERTICAL_CHROME);
  if (typeof node.setSize === 'function') {
    node.setSize([width, height]);
  } else if (Array.isArray(node.size)) {
    node.size[0] = width;
    node.size[1] = height;
  }
  node.graph?.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas?.(true, true);
}

function refreshNode(node) {
  if (!isTargetNode(node)) return;
  syncInputs(node);
  fitNodeHeight(node);
}

function bindNode(node) {
  refreshNode(node);
  setTimeout(() => refreshNode(node), 80);
}

app.registerExtension({
  name: 'Avatary.ReturnTrue',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS) return;

    const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function (...args) {
      const result = originalOnNodeCreated?.apply(this, args);
      bindNode(this);
      return result;
    };

    const originalOnConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (...args) {
      const result = originalOnConfigure?.apply(this, args);
      bindNode(this);
      return result;
    };

    const originalOnConnectionsChange = nodeType.prototype.onConnectionsChange;
    nodeType.prototype.onConnectionsChange = function (...args) {
      const result = originalOnConnectionsChange?.apply(this, args);
      requestAnimationFrame(() => refreshNode(this));
      return result;
    };
  },

  loadedGraphNode(node) {
    bindNode(node);
  },
});
