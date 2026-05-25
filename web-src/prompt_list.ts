// @ts-nocheck
import { app } from '/scripts/app.js';
import { bindTextareaAutosize } from './components/textarea.js';

const NODE_CLASS = 'ComfyUI-Prompts';
const PREFIX_WIDGET = 'prompt_positive_prefix';

function isTargetNodeDef(nodeData) {
  return String(nodeData?.name || '') === NODE_CLASS;
}

function isTargetNodeInstance(node) {
  const candidates = [node?.type, node?.comfyClass, node?.constructor?.type].map((v) => String(v || ''));
  return candidates.includes(NODE_CLASS);
}

function findPrefixTextarea(node) {
  const widget = (node.widgets || []).find((w) => w?.name === PREFIX_WIDGET);
  if (!widget) return null;

  const direct = widget.inputEl || widget.element || widget.el;
  if (direct?.tagName === 'TEXTAREA') return direct;

  if (direct && typeof direct.querySelector === 'function') {
    const nested = direct.querySelector('textarea');
    if (nested) return nested;
  }

  if (typeof widget.querySelector === 'function') {
    const nested = widget.querySelector('textarea');
    if (nested) return nested;
  }

  return null;
}

function autosizePrefix(node) {
  const textarea = findPrefixTextarea(node);
  if (!textarea) return;
  bindTextareaAutosize(textarea, { minHeight: 30 });
  const apply = () => {
    node.setSize([node.size[0], node.computeSize()[1]]);
    app.graph?.setDirtyCanvas?.(true, true);
  };

  if (!textarea.__avataryPromptPrefixResizeBound) {
    textarea.__avataryPromptPrefixResizeBound = true;
    textarea.addEventListener('input', apply);
    textarea.addEventListener('change', apply);
  }

  apply();
}

app.registerExtension({
  name: 'Avatary.PromptList.AutoHeight',

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (!isTargetNodeDef(nodeData)) return;

    const origCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function (...args) {
      const r = origCreated?.apply(this, args);
      requestAnimationFrame(() => autosizePrefix(this));
      setTimeout(() => autosizePrefix(this), 80);
      return r;
    };

    const origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (...args) {
      const r = origConfigure?.apply(this, args);
      requestAnimationFrame(() => autosizePrefix(this));
      return r;
    };
  },

  loadedGraphNode(node) {
    if (!isTargetNodeInstance(node)) return;
    requestAnimationFrame(() => autosizePrefix(node));
    setTimeout(() => autosizePrefix(node), 80);
  },
});
