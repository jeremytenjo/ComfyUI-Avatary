// @ts-nocheck
import { app } from "/scripts/app.js";
import { createSelect } from "./components/select.js";
import { createToggle, ensureToggleStyles } from "./components/toggle.js";

const NODE_CLASS = "AvataryLoraStack";
const STATE_INPUT = "LoraStackState";
const CATALOG_INPUT = "LoraCatalog";
const LEGACY_JSON_WIDGET = "lora_stack_json";
const LEGACY_CATALOG_WIDGET = "lora_catalog";
const STATE_KEY = "lora_stack_avatary_rows";
const DEFAULT_W = 420;
const STYLE_ID = "avatary-lora-stack-styles";
const NONE_LORA = "None";
const PANEL_PADDING_Y = 2;
const PANEL_GAP = 8;
const ROW_HEIGHT = 34;
const ROW_GAP = 6;
const EMPTY_HEIGHT = 34;
const ADD_BUTTON_HEIGHT = 28;
const NODE_VERTICAL_CHROME = 95;

function ensureStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
		.avatary-lora-stack-panel {
			box-sizing: border-box;
			display: flex;
			flex-direction: column;
			gap: 8px;
			height: 100%;
			overflow: hidden;
			padding: 1px;
		}
		.avatary-lora-stack-number {
			min-width: 0;
			border: 0;
			border-radius: 6px;
			background: var(--component-node-widget-background);
			color: var(--component-node-foreground);
			font-size: 12px;
			height: 28px;
			padding: 0 8px;
			box-sizing: border-box;
		}
		.avatary-lora-stack-number:hover,
		.avatary-lora-stack-number:focus {
			background: var(--component-node-widget-background-hovered);
			outline: none;
		}
		.avatary-lora-stack-button {
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
		.avatary-lora-stack-button:hover {
			background: var(--component-node-widget-background-hovered);
		}
		.avatary-lora-stack-add {
			gap: 8px;
			width: 100%;
		}
		.avatary-lora-stack-add svg {
			height: 16px;
			width: 16px;
			stroke: currentColor;
		}
		.avatary-lora-stack-list {
			display: flex;
			flex: 1 1 auto;
			flex-direction: column;
			gap: 6px;
			min-height: 0;
			overflow: auto;
		}
		.avatary-lora-stack-row {
			align-items: center;
			box-sizing: border-box;
			display: grid;
			column-gap: 12px;
			grid-template-columns: 22px 38px minmax(0, 1fr) 72px 30px;
			min-height: 34px;
			padding: 0;
		}
		.avatary-lora-stack-row.dragging {
			opacity: 0.55;
		}
		.avatary-lora-stack-handle {
			align-items: center;
			background: var(--component-node-widget-background);
			border-radius: 6px;
			color: var(--component-node-foreground-secondary);
			cursor: grab;
			display: flex;
			font-size: 16px;
			height: 28px;
			justify-content: center;
			user-select: none;
		}
		.avatary-lora-stack-remove {
			padding: 0;
			width: 30px;
		}
		.avatary-lora-stack-remove svg {
			height: 16px;
			width: 16px;
			stroke: currentColor;
		}
		.avatary-lora-stack-empty {
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

function extractValuesFromInputSpec(inputSpec) {
	const rawValues = Array.isArray(inputSpec) ? inputSpec[0] : inputSpec;
	const values = Array.isArray(rawValues) ? rawValues : [];
	return values.map((value) => String(value)).filter((value) => value && value !== NONE_LORA);
}

function getCatalog(node) {
	const fromNodeData = node.constructor?.__avataryLoraCatalog || [];
	if (fromNodeData.length) return fromNodeData;

	const widget = findWidget(node, CATALOG_INPUT);
	const rawValues =
		widget?.options?.values ||
		widget?.options ||
		widget?.values ||
		widget?.type ||
		[];
	const values = Array.isArray(rawValues) ? rawValues : [];
	return values
		.map((value) => String(value))
		.filter((value) => value && value !== NONE_LORA);
}

function normalizeRow(row) {
	const name = String(row?.name || "").trim();
	const fallbackStrength =
		typeof row?.strength_model === "number"
			? row.strength_model
			: Number(row?.strength_model ?? 1);
	const strength =
		typeof row?.strength === "number"
			? row.strength
			: Number(row?.strength ?? fallbackStrength);
	return {
		name,
		enabled: row?.enabled !== false,
		strength: Number.isFinite(strength) ? strength : 1,
	};
}

function readRows(node) {
	if (!node) return [];
	const propertyRows = node.properties?.[STATE_KEY];
	if (Array.isArray(propertyRows)) {
		return propertyRows.map(normalizeRow).filter((row) => row.name);
	}
	const widget = findWidget(node, STATE_INPUT);
	try {
		const parsed = JSON.parse(String(widget?.value || "[]"));
		return Array.isArray(parsed)
			? parsed.map(normalizeRow).filter((row) => row.name)
			: [];
	} catch (_error) {
		return [];
	}
}

function writeRows(node, rows) {
	if (!node.properties || typeof node.properties !== "object") {
		node.properties = {};
	}
	node.properties[STATE_KEY] = rows.map(normalizeRow);
	node.setDirtyCanvas?.(true, true);
}

function migrateLegacyWidgets(node) {
	if (!node) return;
	const legacyState = findWidget(node, LEGACY_JSON_WIDGET);
	if (!Array.isArray(node.properties?.[STATE_KEY]) && legacyState?.value) {
		try {
			const parsed = JSON.parse(String(legacyState.value || "[]"));
			if (Array.isArray(parsed)) {
				writeRows(node, parsed);
			}
		} catch (_error) {
			// Ignore invalid legacy state; the panel will start empty.
		}
	}
	if (node.widgets) {
		node.widgets = node.widgets.filter(
			(widget) =>
				widget?.name !== LEGACY_JSON_WIDGET &&
				widget?.name !== LEGACY_CATALOG_WIDGET &&
				widget?.name !== STATE_INPUT &&
				widget?.name !== CATALOG_INPUT,
		);
	}
}

function ensurePanelWidget(node) {
	if (
		node._avataryLoraStackPanel &&
		node.widgets?.some((widget) => widget?._avataryLoraStackPanelWidget)
	) {
		return node._avataryLoraStackPanel;
	}

	if (node.widgets) {
		node.widgets = node.widgets.filter(
			(widget) => !widget?._avataryLoraStackPanelWidget,
		);
	}

	ensureStyles();
	ensureToggleStyles();
	const panel = document.createElement("div");
	panel.className = "avatary-lora-stack-panel";
	node._avataryLoraStackPanel = panel;

	if (typeof node.addDOMWidget === "function") {
		const widget = node.addDOMWidget("LoRAs", "lora_stack_panel", panel, {
			serialize: false,
			hideOnZoom: false,
			getMinHeight: () => getPanelHeight(node),
		});
		if (widget) {
			widget._avataryLoraStackPanelWidget = true;
			widget.serialize = false;
			return panel;
		}
	}
	return null;
}

function moveRow(rows, fromIndex, toIndex) {
	if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return rows;
	const next = rows.slice();
	const [item] = next.splice(fromIndex, 1);
	next.splice(toIndex, 0, item);
	return next;
}

function getPanelHeight(node) {
	const rowCount = readRows(node).length;
	const listHeight = rowCount
		? rowCount * ROW_HEIGHT + Math.max(0, rowCount - 1) * ROW_GAP
		: EMPTY_HEIGHT;
	return PANEL_PADDING_Y + listHeight + PANEL_GAP + ADD_BUTTON_HEIGHT;
}

function fitNodeHeight(node) {
	node.size[0] = Math.max(node.size?.[0] || 0, DEFAULT_W);
	node.size[1] = Math.max(140, getPanelHeight(node) + NODE_VERTICAL_CHROME);
	node.setDirtyCanvas?.(true, true);
}

function renderPanel(node) {
	migrateLegacyWidgets(node);
	const panel = ensurePanelWidget(node);
	if (!panel) return;

	const catalog = getCatalog(node);
	const rows = readRows(node);
	panel.innerHTML = "";

	const list = document.createElement("div");
	list.className = "avatary-lora-stack-list";
	if (!rows.length) {
		const empty = document.createElement("div");
		empty.className = "avatary-lora-stack-empty";
		empty.textContent = "Add LoRAs to build a stack.";
		list.appendChild(empty);
	}

	for (const [index, row] of rows.entries()) {
		const item = document.createElement("div");
		item.className = "avatary-lora-stack-row";
		item.draggable = true;
		item.dataset.index = String(index);

		item.addEventListener("dragstart", (event) => {
			item.classList.add("dragging");
			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData("text/plain", String(index));
		});
		item.addEventListener("dragend", () => item.classList.remove("dragging"));
		item.addEventListener("dragover", (event) => {
			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
		});
		item.addEventListener("drop", (event) => {
			event.preventDefault();
			const fromIndex = Number(event.dataTransfer.getData("text/plain"));
			const toIndex = Number(item.dataset.index);
			if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
			writeRows(node, moveRow(readRows(node), fromIndex, toIndex));
			renderPanel(node);
		});

		const handle = document.createElement("div");
		handle.className = "avatary-lora-stack-handle";
		handle.title = "Drag to reorder";
		handle.textContent = "::";

		const toggle = createToggle({
			active: row.enabled,
			disabled: false,
			title: row.enabled ? "Enabled" : "Disabled",
			onToggle: () => {
				const next = readRows(node);
				next[index].enabled = !Boolean(next[index].enabled);
				writeRows(node, next);
				renderPanel(node);
			},
		});
		toggle.addEventListener("pointerdown", (event) => event.stopPropagation());
		toggle.addEventListener("mousedown", (event) => event.stopPropagation());
		toggle.addEventListener("touchstart", (event) => event.stopPropagation());

		const options = catalog.includes(row.name) ? catalog : [row.name, ...catalog];
		const loraSelect = createSelect({
			options,
			value: row.name,
			title: "LoRA",
			onChange: (value) => {
				const next = readRows(node);
				next[index].name = String(value || "").trim();
				writeRows(node, next);
				renderPanel(node);
			},
		});

		const strength = document.createElement("input");
		strength.type = "number";
		strength.className = "avatary-lora-stack-number";
		strength.title = "Strength";
		strength.step = "0.05";
		strength.min = "-20";
		strength.max = "20";
		strength.value = String(row.strength);
		strength.addEventListener("change", () => {
			const next = readRows(node);
			next[index].strength = Number(strength.value);
			writeRows(node, next);
			renderPanel(node);
		});

		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "avatary-lora-stack-button avatary-lora-stack-remove";
		remove.title = "Remove";
		remove.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M3 6h18"></path>
				<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
				<path d="M19 6l-1 14c0 1-1 2-2 2H8c-1 0-2-1-2-2L5 6"></path>
				<path d="M10 11v6"></path>
				<path d="M14 11v6"></path>
			</svg>
		`;
		remove.addEventListener("click", () => {
			const next = readRows(node);
			next.splice(index, 1);
			writeRows(node, next);
			renderPanel(node);
		});

		item.append(handle, toggle, loraSelect, strength, remove);
		list.appendChild(item);
	}

	panel.appendChild(list);

	const addButton = document.createElement("button");
	addButton.type = "button";
	addButton.className = "avatary-lora-stack-button avatary-lora-stack-add";
	if (catalog.length) {
		addButton.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M5 12h14"></path>
				<path d="M12 5v14"></path>
			</svg>
			<span>Add LoRA</span>
		`;
	} else {
		addButton.textContent = "No LoRAs found";
	}
	addButton.disabled = !catalog.length;
	addButton.addEventListener("click", () => {
		const name = String(catalog[0] || "").trim();
		if (!name) return;
		writeRows(node, [
			...readRows(node),
			{
				name,
				enabled: true,
				strength: 1,
			},
		]);
		renderPanel(node);
	});
	panel.appendChild(addButton);

	fitNodeHeight(node);
}

function bindNode(node) {
	if (!isTargetNode(node)) return;
	renderPanel(node);
	setTimeout(() => renderPanel(node), 80);
}

app.registerExtension({
	name: "Avatary.LoraStack",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData.name !== NODE_CLASS) return;
		nodeType.__avataryLoraCatalog = extractValuesFromInputSpec(
			nodeData?.input?.hidden?.[CATALOG_INPUT],
		);

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
			if (this._avataryLoraStackPanel?.isConnected) {
				this._avataryLoraStackPanel.remove();
			}
			this._avataryLoraStackPanel = null;
			if (this.widgets) {
				this.widgets = this.widgets.filter(
					(widget) => !widget?._avataryLoraStackPanelWidget,
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
	const tail = id.includes(":") ? id.slice(id.lastIndexOf(":") + 1) : null;
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
		entry.inputs = entry.inputs || {};
		entry.inputs[STATE_INPUT] = JSON.stringify(readRows(node));
	}
	return result;
};
