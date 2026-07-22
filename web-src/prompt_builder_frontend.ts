// @ts-nocheck
import { app } from '/scripts/app.js';
import { createTextfield } from './components/textfield.js';
import { createTextarea } from './components/textarea.js';

const NODE_CLASS = 'AvataryPromptBuilder';
const STATE_INPUT = 'PromptBuilderState';
const STATE_KEY = 'prompt_builder_avatary_sections';
const INPUT_PREFIX = 'section_';
const MAX_SECTIONS = 64;
const DEFAULT_W = 460;
const STYLE_ID = 'avatary-prompt-builder-styles';
const PANEL_PADDING_Y = 2;
const PANEL_GAP = 8;
const ROW_HEIGHT = 106;
const ROW_GAP = 8;
const TEXTAREA_DEFAULT_HEIGHT = 72;
const TEXTAREA_MIN_HEIGHT = 72;
const TEXTAREA_MAX_HEIGHT = 720;
const ROW_NON_TEXT_HEIGHT = ROW_HEIGHT - TEXTAREA_DEFAULT_HEIGHT;
const EMPTY_HEIGHT = 34;
const ADD_BUTTON_HEIGHT = 28;
const NODE_VERTICAL_CHROME = 95;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
		.avatary-prompt-builder-panel {
			box-sizing: border-box;
			display: flex;
			flex-direction: column;
			gap: 8px;
			height: 100%;
			overflow: visible;
			padding: 1px;
		}
		.avatary-prompt-builder-button {
			align-items: center;
			border: 0;
			border-radius: 6px;
			background: var(--component-node-widget-background);
			color: var(--component-node-foreground);
			cursor: pointer;
			display: inline-flex;
			font-size: 12px;
			height: 28px;
			justify-content: center;
			padding: 0 10px;
		}
		.avatary-prompt-builder-button:hover {
			background: var(--component-node-widget-background-hovered);
		}
		.avatary-prompt-builder-button:disabled {
			cursor: default;
			opacity: 0.55;
		}
		.avatary-prompt-builder-add {
			gap: 8px;
			width: 100%;
		}
		.avatary-prompt-builder-add svg,
		.avatary-prompt-builder-remove svg {
			height: 16px;
			width: 16px;
			stroke: currentColor;
		}
		.avatary-prompt-builder-list {
			display: flex;
			flex: 1 1 auto;
			flex-direction: column;
			gap: 8px;
			min-height: 0;
			overflow: visible;
		}
		.avatary-prompt-builder-row {
			align-items: start;
			box-sizing: border-box;
			display: grid;
			column-gap: 10px;
			grid-template-columns: 22px minmax(0, 1fr) 30px;
			min-height: 106px;
			padding: 0;
			position: relative;
		}
		.avatary-prompt-builder-row.dragging {
			opacity: 0.55;
		}
		.avatary-prompt-builder-row.drop-before::before,
		.avatary-prompt-builder-row.drop-after::after {
			background: var(--p-primary-color, #60a5fa);
			border-radius: 999px;
			box-shadow: 0 0 0 1px var(--component-node-widget-background-highlighted, #4b5563);
			content: "";
			height: 3px;
			left: 0;
			pointer-events: none;
			position: absolute;
			right: 0;
			z-index: 2;
		}
		.avatary-prompt-builder-row.drop-before::before {
			top: -5px;
		}
		.avatary-prompt-builder-row.drop-after::after {
			bottom: -5px;
		}
		.avatary-prompt-builder-handle {
			align-items: center;
			background: var(--component-node-widget-background);
			border-radius: 6px;
			color: color-mix(in srgb, var(--component-node-foreground-secondary) 78%, white);
			cursor: grab;
			display: flex;
			font-size: 16px;
			height: 28px;
			justify-content: center;
			user-select: none;
		}
		.avatary-prompt-builder-fields {
			display: flex;
			flex-direction: column;
			gap: 6px;
			min-width: 0;
		}
		.avatary-prompt-builder-text {
			box-sizing: border-box;
			min-height: 72px;
			resize: vertical;
		}
		.avatary-prompt-builder-remove {
			color: color-mix(in srgb, var(--component-node-foreground-secondary) 78%, white);
			padding: 0;
			width: 30px;
		}
		.avatary-prompt-builder-empty {
			color: var(--component-node-foreground-secondary);
			font-size: 12px;
			padding: 8px 2px;
		}
	`;
  document.head.appendChild(style);
}

function isTargetNode(node) {
  return (
    node?.comfyClass === NODE_CLASS ||
    node?.type === NODE_CLASS ||
    node?.constructor?.type === NODE_CLASS
  );
}

function findWidget(node, name) {
  return (node.widgets || []).find((widget) => widget?.name === name);
}

function inputKeyForIndex(index) {
  return `${INPUT_PREFIX}${index}`;
}

function isSectionInputName(name) {
  const match = String(name || '').match(/^section_(\d+)$/);
  return Boolean(match && Number(match[1]) >= 1 && Number(match[1]) <= MAX_SECTIONS);
}

function coerceTextHeight(value) {
  const height = Number(value);
  if (!Number.isFinite(height) || height <= 0) {
    return TEXTAREA_DEFAULT_HEIGHT;
  }
  return Math.max(TEXTAREA_MIN_HEIGHT, Math.min(TEXTAREA_MAX_HEIGHT, Math.round(height)));
}

function normalizeRow(row, fallbackIndex = 0, usedKeys = new Set()) {
  let inputKey = String(row?.input_key || '').trim();
  if (!isSectionInputName(inputKey) || usedKeys.has(inputKey)) {
    for (let index = 1; index <= MAX_SECTIONS; index += 1) {
      const candidate = inputKeyForIndex(index);
      if (!usedKeys.has(candidate)) {
        inputKey = candidate;
        break;
      }
    }
  }
  usedKeys.add(inputKey);
  return {
    name: String(row?.name || '').trim() || `Section ${fallbackIndex + 1}`,
    text: String(row?.text || ''),
    text_height: coerceTextHeight(row?.text_height),
    input_key: inputKey,
  };
}

function normalizeRows(rows) {
  const usedKeys = new Set();
  return (Array.isArray(rows) ? rows : [])
    .slice(0, MAX_SECTIONS)
    .map((row, index) => normalizeRow(row, index, usedKeys))
    .filter((row) => row.input_key);
}

function readRows(node) {
  if (!node) return [];
  const propertyRows = node.properties?.[STATE_KEY];
  if (Array.isArray(propertyRows)) {
    return normalizeRows(propertyRows);
  }
  const widget = findWidget(node, STATE_INPUT);
  try {
    const parsed = JSON.parse(String(widget?.value || '[]'));
    return normalizeRows(parsed);
  } catch (_error) {
    return [];
  }
}

function writeRows(node, rows) {
  if (!node.properties || typeof node.properties !== 'object') {
    node.properties = {};
  }
  node.properties[STATE_KEY] = normalizeRows(rows);
  syncInputs(node);
  node.setDirtyCanvas?.(true, true);
}

function writeRowTextHeight(node, index, height) {
  const next = readRows(node);
  if (!next[index]) return;
  const nextHeight = coerceTextHeight(height);
  if (next[index].text_height === nextHeight) return;
  next[index].text_height = nextHeight;
  writeRows(node, next);
  scheduleFitNodeHeight(node);
}

function bindTextareaHeightPersistence(node, index, textarea) {
  let pointerStartedInTextarea = false;
  const saveHeight = () => {
    if (!pointerStartedInTextarea) return;
    pointerStartedInTextarea = false;
    writeRowTextHeight(node, index, textarea.offsetHeight);
  };

  textarea.addEventListener('pointerdown', () => {
    pointerStartedInTextarea = true;
  });
  textarea.addEventListener('mouseup', saveHeight);
  window.addEventListener('pointerup', saveHeight, { capture: true });
}

function inputDisplayName(row, index) {
  const name = String(row?.name || '').trim();
  return name || `Section ${index + 1}`;
}

function clearDropIndicators(list) {
  for (const row of list.querySelectorAll('.avatary-prompt-builder-row')) {
    row.classList.remove('drop-before', 'drop-after');
    delete row.dataset.dropPosition;
  }
}

function moveRowToInsertIndex(rows, fromIndex, insertIndex) {
  if (fromIndex < 0 || insertIndex < 0) return rows;
  const next = rows.slice();
  const [item] = next.splice(fromIndex, 1);
  const adjustedIndex = fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
  next.splice(Math.max(0, Math.min(next.length, adjustedIndex)), 0, item);
  return next;
}

function syncInputs(node) {
  if (!node) return;
  const rows = readRows(node);
  const existing = Array.isArray(node.inputs) ? node.inputs : [];
  const claimedInputs = new Set();

  const findExistingInput = (row, index) => {
    const displayName = inputDisplayName(row, index);
    const matchers = [
      (input) => (input?._avataryPromptBuilderInputKey || '') === row.input_key,
      (input) => String(input?.name || '') === row.input_key,
      (input) => String(input?.name || '') === displayName,
    ];
    for (const matcher of matchers) {
      const input = existing.find(
        (candidate) => !claimedInputs.has(candidate) && matcher(candidate),
      );
      if (input) {
        claimedInputs.add(input);
        return input;
      }
    }
    return null;
  };

  for (let index = existing.length - 1; index >= 0; index -= 1) {
    const input = existing[index];
    const key = input?._avataryPromptBuilderInputKey || input?.name;
    const stillNeeded = rows.some((row, rowIndex) => {
      const displayName = inputDisplayName(row, rowIndex);
      return key === row.input_key || input?.name === row.input_key || input?.name === displayName;
    });
    if (!stillNeeded && typeof node.removeInput === 'function') {
      try {
        node.removeInput(index);
      } catch (_error) {
        // The final assignment below is the source of truth for visible sockets.
      }
    }
  }

  const orderedSectionInputs = rows.map((row, index) => {
    const displayName = inputDisplayName(row, index);
    const input = findExistingInput(row, index) || {
      name: displayName,
      type: 'STRING',
      link: null,
    };
    input.name = displayName;
    input.type = 'STRING';
    input._avataryPromptBuilderInputKey = row.input_key;
    input._avataryPromptBuilderSectionInput = true;
    return input;
  });
  node.inputs = orderedSectionInputs;
  node.graph?.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas?.(true, true);
}

function migrateWidgets(node) {
  if (!node) return;
  if (node.widgets) {
    node.widgets = node.widgets.filter((widget) => widget?.name !== STATE_INPUT);
  }
}

function ensurePanelWidget(node) {
  if (
    node._avataryPromptBuilderPanel &&
    node.widgets?.some((widget) => widget?._avataryPromptBuilderPanelWidget)
  ) {
    return node._avataryPromptBuilderPanel;
  }

  if (node.widgets) {
    node.widgets = node.widgets.filter(
      (widget) => !widget?._avataryPromptBuilderPanelWidget,
    );
  }

  ensureStyles();
  const panel = document.createElement('div');
  panel.className = 'avatary-prompt-builder-panel';
  node._avataryPromptBuilderPanel = panel;

  if (typeof node.addDOMWidget === 'function') {
    const widget = node.addDOMWidget('Sections', 'prompt_builder_panel', panel, {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => getPanelHeight(node),
    });
    if (widget) {
      widget._avataryPromptBuilderPanelWidget = true;
      widget.serialize = false;
      return panel;
    }
  }
  return null;
}

function getPanelHeight(node) {
  const rows = readRows(node);
  const listHeight = rows.length
    ? rows.reduce(
        (total, row) => total + ROW_NON_TEXT_HEIGHT + coerceTextHeight(row.text_height),
        0,
      ) + Math.max(0, rows.length - 1) * ROW_GAP
    : EMPTY_HEIGHT;
  return PANEL_PADDING_Y + listHeight + PANEL_GAP + ADD_BUTTON_HEIGHT;
}

function fitNodeHeight(node) {
  const width = Math.max(node.size?.[0] || 0, DEFAULT_W);
  const height = Math.max(150, getPanelHeight(node) + NODE_VERTICAL_CHROME);
  if (typeof node.setSize === 'function') {
    node.setSize([width, height]);
  } else if (Array.isArray(node.size)) {
    node.size[0] = width;
    node.size[1] = height;
  }
  node.graph?.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas?.(true, true);
}

function scheduleFitNodeHeight(node) {
  requestAnimationFrame(() => fitNodeHeight(node));
}

function renderPanel(node) {
  migrateWidgets(node);
  const panel = ensurePanelWidget(node);
  if (!panel) return;

  syncInputs(node);
  const rows = readRows(node);
  panel.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'avatary-prompt-builder-list';
  list.addEventListener('dragleave', (event) => {
    if (!list.contains(event.relatedTarget)) {
      clearDropIndicators(list);
    }
  });

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'avatary-prompt-builder-empty';
    empty.textContent = 'Add sections to build a prompt.';
    list.appendChild(empty);
  }

  for (const [index, row] of rows.entries()) {
    const item = document.createElement('div');
    item.className = 'avatary-prompt-builder-row';
    item.draggable = true;
    item.dataset.index = String(index);

    item.addEventListener('dragstart', (event) => {
      item.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const rect = item.getBoundingClientRect();
      const position =
        event.clientY > rect.top + rect.height * 0.5 ? 'after' : 'before';
      clearDropIndicators(list);
      item.dataset.dropPosition = position;
      item.classList.add(position === 'after' ? 'drop-after' : 'drop-before');
    });
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      const fromIndex = Number(event.dataTransfer.getData('text/plain'));
      const toIndex = Number(item.dataset.index);
      if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
      const insertIndex =
        item.dataset.dropPosition === 'after' ? toIndex + 1 : toIndex;
      clearDropIndicators(list);
      writeRows(
        node,
        moveRowToInsertIndex(readRows(node), fromIndex, insertIndex),
      );
      renderPanel(node);
    });

    const handle = document.createElement('div');
    handle.className = 'avatary-prompt-builder-handle';
    handle.title = 'Drag to reorder';
    handle.textContent = '::';

    const fields = document.createElement('div');
    fields.className = 'avatary-prompt-builder-fields';

    const name = createTextfield({
      value: row.name,
      placeholder: `Section ${index + 1}`,
      title: 'Section name',
      onInput: (value) => {
        const next = readRows(node);
        next[index].name = value;
        writeRows(node, next);
      },
    });

    const text = createTextarea({
      value: row.text,
      placeholder: 'Default string',
      title: 'Default string',
      className: 'avatary-prompt-builder-text',
      onInput: (value) => {
        const next = readRows(node);
        next[index].text = value;
        writeRows(node, next);
      },
    });
    text.style.height = `${coerceTextHeight(row.text_height)}px`;
    bindTextareaHeightPersistence(node, index, text);

    fields.append(name, text);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'avatary-prompt-builder-button avatary-prompt-builder-remove';
    remove.title = 'Remove';
    remove.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M3 6h18"></path>
				<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
				<path d="M19 6l-1 14c0 1-1 2-2 2H8c-1 0-2-1-2-2L5 6"></path>
				<path d="M10 11v6"></path>
				<path d="M14 11v6"></path>
			</svg>
		`;
    remove.addEventListener('click', () => {
      const next = readRows(node);
      next.splice(index, 1);
      writeRows(node, next);
      renderPanel(node);
    });

    item.append(handle, fields, remove);
    list.appendChild(item);
  }

  panel.appendChild(list);

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'avatary-prompt-builder-button avatary-prompt-builder-add';
  addButton.disabled = rows.length >= MAX_SECTIONS;
  addButton.innerHTML = rows.length >= MAX_SECTIONS
    ? '<span>Maximum sections reached</span>'
    : `
			<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M5 12h14"></path>
				<path d="M12 5v14"></path>
			</svg>
			<span>Add Section</span>
		`;
  addButton.addEventListener('click', () => {
    const next = readRows(node);
    if (next.length >= MAX_SECTIONS) return;
    writeRows(node, [
      ...next,
      normalizeRow(
        {
          name: `Section ${next.length + 1}`,
          text: '',
          input_key: '',
        },
        next.length,
        new Set(next.map((row) => row.input_key)),
      ),
    ]);
    renderPanel(node);
  });
  panel.appendChild(addButton);

  fitNodeHeight(node);
  scheduleFitNodeHeight(node);
}

function bindNode(node) {
  if (!isTargetNode(node)) return;
  renderPanel(node);
  setTimeout(() => renderPanel(node), 80);
}

app.registerExtension({
  name: 'Avatary.PromptBuilder',
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

    const originalOnRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function (...args) {
      if (this._avataryPromptBuilderPanel?.isConnected) {
        this._avataryPromptBuilderPanel.remove();
      }
      this._avataryPromptBuilderPanel = null;
      if (this.widgets) {
        this.widgets = this.widgets.filter(
          (widget) => !widget?._avataryPromptBuilderPanelWidget,
        );
      }
      return originalOnRemoved?.apply(this, args);
    };
  },

  loadedGraphNode(node) {
    bindNode(node);
  },
});

function buildNodeIndex() {
  const map = new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (isTargetNode(n)) {
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
    const rows = readRows(node);
    entry.inputs = entry.inputs || {};
    entry.inputs[STATE_INPUT] = JSON.stringify(rows);

    for (let sectionIndex = 1; sectionIndex <= MAX_SECTIONS; sectionIndex += 1) {
      delete entry.inputs[inputKeyForIndex(sectionIndex)];
    }

    for (const [rowIndex, row] of rows.entries()) {
      const input = node?.inputs?.[rowIndex];
      if (!input || input.link == null) continue;
      const linkedValue = entry.inputs[input.name];
      delete entry.inputs[input.name];
      if (linkedValue !== undefined) {
        entry.inputs[row.input_key] = linkedValue;
      }
    }
  }
  return result;
};
