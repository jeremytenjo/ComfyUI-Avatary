// @ts-nocheck
import { app } from '/scripts/app.js';
import { bindTextareaAutosize } from './components/textarea.js';

const NODE_CLASS = 'ComfyUI-Prompts';
const AUTO_SIZE_WIDGETS = ['text', 'prompt_positive_prefix'];

function isTargetNodeDef(nodeData) {
  return String(nodeData?.name || '') === NODE_CLASS;
}

function isTargetNodeInstance(node) {
  const candidates = [node?.type, node?.comfyClass, node?.constructor?.type].map((v) => String(v || ''));
  return candidates.includes(NODE_CLASS);
}

function findWidgetTextarea(node, widgetName) {
  const widget = (node.widgets || []).find((w) => w?.name === widgetName);
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

function autosizePromptFields(node) {
  let boundAny = false;
  const apply = () => {
    node.setSize([node.size[0], node.computeSize()[1]]);
    app.graph?.setDirtyCanvas?.(true, true);
  };

  for (const widgetName of AUTO_SIZE_WIDGETS) {
    const textarea = findWidgetTextarea(node, widgetName);
    if (!textarea) continue;
    bindTextareaAutosize(textarea, { minHeight: 30 });
    const bindKey = `__avataryPromptResizeBound_${widgetName}`;
    if (!textarea[bindKey]) {
      textarea[bindKey] = true;
      textarea.addEventListener('input', apply);
      textarea.addEventListener('change', apply);
    }
    boundAny = true;
  }

  if (boundAny) apply();
}

app.registerExtension({
  name: 'Avatary.PromptList.AutoHeight',

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (!isTargetNodeDef(nodeData)) return;

    const origCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function (...args) {
      const r = origCreated?.apply(this, args);
      requestAnimationFrame(() => autosizePromptFields(this));
      setTimeout(() => autosizePromptFields(this), 80);
      return r;
    };

    const origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (...args) {
      const r = origConfigure?.apply(this, args);
      requestAnimationFrame(() => autosizePromptFields(this));
      return r;
    };
  },

  loadedGraphNode(node) {
    if (!isTargetNodeInstance(node)) return;
    requestAnimationFrame(() => autosizePromptFields(node));
    setTimeout(() => autosizePromptFields(node), 80);
  },
});
