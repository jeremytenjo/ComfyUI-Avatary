// @ts-nocheck
import { app } from "../../scripts/app.js";
import { captureTextInputEvents } from "./components/textfield.js";
import { createToggle, ensureToggleStyles } from "./components/toggle.js";

const NODE_NAME = "AvataryFeatures";
const NODE_DISPLAY_NAME = "Features Avatary";
const MODE_ACTIVE = LiteGraph.ALWAYS;
const MODE_BYPASS = 4;
const STATE_KEY = "features_avatary_states";
const RULES_KEY = "features_avatary_rules";
const REFRESH_MS = 400;
const PANEL_BASE_HEIGHT = 18;
const FEATURE_ROW_HEIGHT = 36;
const PANEL_MIN_HEIGHT = 86;
const PANEL_MAX_HEIGHT = 320;
const STYLE_ID = "avatary-features-panel-styles";
const MODAL_ID = "avatary-features-rules-modal";
const ALPHABETICAL_COLLATOR = new Intl.Collator(undefined, {
	sensitivity: "base",
	numeric: true,
});

function queueRefresh(node, force = false) {
	if (force) {
		node.__featuresAvataryForceRefresh = true;
	}
	if (node.__featuresAvataryRefreshQueued) {
		return;
	}
	node.__featuresAvataryRefreshQueued = true;
	setTimeout(() => {
		node.__featuresAvataryRefreshQueued = false;
		refreshNode(node);
	}, 0);
}

function isTargetNodeDef(nodeData) {
	return String(nodeData?.name || "") === NODE_NAME;
}

function isTargetNodeInstance(node) {
	const candidates = [
		node?.type,
		node?.comfyClass,
		node?.constructor?.type,
		node?.constructor?.title,
	].map((value) => String(value || ""));
	return candidates.includes(NODE_NAME);
}

function syncNodeTitle(node) {
	if (!node) {
		return;
	}
	const title = String(node.title || "").trim();
	if (!title || title === NODE_NAME) {
		node.title = NODE_DISPLAY_NAME;
	}
}

function normalizeTitle(title) {
	return String(title || "").trim();
}

function keyForTitle(title) {
	return normalizeTitle(title).toLowerCase();
}

function getCurrentGraph(node) {
	return node?.graph || app?.canvas?.getCurrentGraph?.() || app?.graph;
}

function getGroupBounds(group) {
	const bounds = group?._bounding || group?.bounding;
	if (!Array.isArray(bounds) || bounds.length < 4) {
		return null;
	}
	return bounds;
}

function collectNestedGraphs(rootGraph) {
	if (!rootGraph) {
		return [];
	}

	const collected = [];
	const stack = [rootGraph];
	const seen = new Set();

	while (stack.length) {
		const graph = stack.pop();
		if (!graph || seen.has(graph)) {
			continue;
		}
		seen.add(graph);
		collected.push(graph);

		for (const graphNode of graph._nodes || []) {
			const childGraph = graphNode?.subgraph;
			if (childGraph && !seen.has(childGraph)) {
				stack.push(childGraph);
			}
		}
	}

	return collected;
}

function getGroupNodes(group, graph) {
	if (!group || !graph) {
		return [];
	}

	try {
		if (typeof group.recomputeInsideNodes === "function") {
			group.recomputeInsideNodes();
		}
	} catch (_error) {
		// Fall through to stale-membership fallback.
	}

	const fromChildren = Array.from(group?._children || []).filter(
		(node) => typeof node?.id === "number",
	);
	if (fromChildren.length) {
		return fromChildren;
	}

	const bounds = getGroupBounds(group);
	if (!bounds) {
		return [];
	}

	const [gx, gy, gw, gh] = bounds;
	return (graph._nodes || []).filter((graphNode) => {
		if (typeof graphNode?.id !== "number") {
			return false;
		}
		const pos = graphNode.pos || [0, 0];
		const size = Array.isArray(graphNode.size) ? graphNode.size : [140, 80];
		const centerX = Number(pos[0] || 0) + Number(size[0] || 0) * 0.5;
		const centerY = Number(pos[1] || 0) + Number(size[1] || 0) * 0.5;
		return (
			centerX >= gx && centerX < gx + gw && centerY >= gy && centerY < gy + gh
		);
	});
}

function collectGroupsByTitle(node) {
	const rootGraph = getCurrentGraph(node);
	if (!rootGraph) {
		return [];
	}

	const deduped = new Map();

	for (const graph of collectNestedGraphs(rootGraph)) {
		const sourceGroups = Array.isArray(graph._groups)
			? graph._groups
			: Array.isArray(graph.groups)
				? graph.groups
				: [];

		for (const group of sourceGroups) {
			const title = normalizeTitle(group?.title);
			if (!title) {
				continue;
			}
			const key = keyForTitle(title);
			if (!deduped.has(key)) {
				deduped.set(key, {
					key,
					title,
					groups: [],
				});
			}
			deduped.get(key).groups.push({ group, graph });
		}
	}

	return Array.from(deduped.values()).sort(
		(a, b) =>
			ALPHABETICAL_COLLATOR.compare(a.title, b.title) ||
			a.key.localeCompare(b.key),
	);
}

function ensureStateStore(node) {
	if (!node.properties || typeof node.properties !== "object") {
		node.properties = {};
	}
	if (
		!node.properties[STATE_KEY] ||
		typeof node.properties[STATE_KEY] !== "object"
	) {
		node.properties[STATE_KEY] = {};
	}
	return node.properties[STATE_KEY];
}

function findWidget(node, name) {
	return (node.widgets || []).find((widget) => widget.name === name);
}

function applyModeToGroupTitle(_node, groupEntry, enabled) {
	if (!groupEntry?.groups?.length) {
		return;
	}

	const seenNodeIds = new WeakMap();
	const mode = enabled ? MODE_ACTIVE : MODE_BYPASS;

	for (const { group, graph } of groupEntry.groups) {
		if (!group || !graph) {
			continue;
		}
		let graphSeenIds = seenNodeIds.get(graph);
		if (!graphSeenIds) {
			graphSeenIds = new Set();
			seenNodeIds.set(graph, graphSeenIds);
		}
		for (const targetNode of getGroupNodes(group, graph)) {
			if (
				!(targetNode && Number.isInteger(targetNode.id) && targetNode.id >= 0)
			) {
				continue;
			}
			if (graphSeenIds.has(targetNode.id)) {
				continue;
			}
			graphSeenIds.add(targetNode.id);
			targetNode.mode = mode;
		}
		graph.setDirtyCanvas?.(true, true);
	}
}

function resolveEnabledFromGroups(_node, groupEntry) {
	if (!groupEntry?.groups?.length) {
		return false;
	}

	const seenNodeIds = new WeakMap();
	let allEnabled = true;
	let anyFound = false;

	for (const { group, graph } of groupEntry.groups) {
		if (!group || !graph) {
			continue;
		}
		let graphSeenIds = seenNodeIds.get(graph);
		if (!graphSeenIds) {
			graphSeenIds = new Set();
			seenNodeIds.set(graph, graphSeenIds);
		}
		for (const targetNode of getGroupNodes(group, graph)) {
			if (
				!(targetNode && Number.isInteger(targetNode.id) && targetNode.id >= 0)
			) {
				continue;
			}
			if (graphSeenIds.has(targetNode.id)) {
				continue;
			}
			graphSeenIds.add(targetNode.id);
			anyFound = true;
			if (targetNode.mode === MODE_BYPASS) {
				allEnabled = false;
			}
		}
	}

	if (!anyFound) {
		return false;
	}
	return allEnabled;
}

function getEntryByKey(node, key) {
	return collectGroupsByTitle(node).find((entry) => entry.key === key) || null;
}

function getNodeLabel(node) {
	return String(node?.title || node?.type || node?.comfyClass || "").trim();
}

function collectNamedNodes(node) {
	const rootGraph = getCurrentGraph(node);
	if (!rootGraph) {
		return [];
	}

	const collected = [];
	const seenNodeIds = new WeakMap();

	for (const graph of collectNestedGraphs(rootGraph)) {
		if (!graph) {
			continue;
		}
		let graphSeenIds = seenNodeIds.get(graph);
		if (!graphSeenIds) {
			graphSeenIds = new Set();
			seenNodeIds.set(graph, graphSeenIds);
		}
		for (const graphNode of graph._nodes || []) {
			if (!(graphNode && Number.isInteger(graphNode.id) && graphNode.id >= 0)) {
				continue;
			}
			if (graphSeenIds.has(graphNode.id)) {
				continue;
			}
			const label = getNodeLabel(graphNode);
			if (!label) {
				continue;
			}
			graphSeenIds.add(graphNode.id);
			collected.push({ graph, node: graphNode, label });
		}
	}

	return collected;
}

function computeSignature(groupsByTitle) {
	return groupsByTitle.map((entry) => entry.key).join("|");
}

function hasStoredState(stateStore, key) {
	return Object.hasOwn(stateStore, key);
}

function asBoolean(value) {
	if (value === true || value === 1) {
		return true;
	}
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		return normalized === "true" || normalized === "1" || normalized === "yes";
	}
	return false;
}

function stopCanvasEvent(event) {
	event.stopPropagation();
}

function ensureStyles() {
	if (document.getElementById(STYLE_ID)) {
		return;
	}
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
		.avatary-features-panel {
			display: flex;
			flex-direction: column;
			gap: 8px;
			height: 100%;
			box-sizing: border-box;
			overflow: auto;
			padding: 1px;
			font: 12px Inter, system-ui, sans-serif;
		}
		.avatary-features-row {
			display: flex;
			align-items: center;
			gap: 10px;
			min-height: 30px;
		}
		.avatary-features-label {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			color: var(--component-node-foreground);
			user-select: none;
		}
		.avatary-features-rules-button {
			flex: 0 0 auto;
			height: 28px;
			min-width: 58px;
			border: 0;
			border-radius: 8px;
			box-sizing: border-box;
			background: var(--component-node-widget-background);
			color: var(--component-node-foreground);
			font-size: 12px;
			outline: none;
			cursor: pointer;
			padding: 0 10px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
		}
		.avatary-features-rules-button:hover {
			background: var(--component-node-widget-background-hovered);
		}
		.avatary-features-rules-badge {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 16px;
			height: 16px;
			border-radius: 999px;
			box-sizing: border-box;
			background: var(--component-node-foreground);
			color: var(--component-node-background);
			font-size: 10px;
			font-weight: 700;
			line-height: 1;
			padding: 0 5px;
		}
		.avatary-features-modal-button {
			height: 34px;
			border: 0;
			border-radius: 8px;
			box-sizing: border-box;
			background: var(--component-node-widget-background);
			color: var(--component-node-foreground);
			font-size: 13px;
			outline: none;
			cursor: pointer;
			padding: 0 12px;
		}
		.avatary-features-modal-button:hover {
			background: var(--component-node-widget-background-hovered);
		}
		.avatary-features-rule-option {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}
		.avatary-features-rule-description {
			color: var(--component-node-foreground-secondary);
			font-size: 12px;
			line-height: 1.35;
		}
		.avatary-features-modal-button-primary {
			background: var(--p-primary-color);
			color: var(--p-primary-contrast-color);
		}
		.avatary-features-modal-button-primary:hover {
			background: color-mix(in srgb, var(--p-primary-color) 88%, white);
		}
		.avatary-features-modal-backdrop {
			position: fixed;
			inset: 0;
			z-index: 9999;
			display: flex;
			align-items: center;
			justify-content: center;
			background: color-mix(in srgb, black 48%, transparent);
		}
		.avatary-features-modal {
			width: min(520px, calc(100vw - 32px));
			min-height: 360px;
			border-radius: 8px;
			background: var(--comfy-menu-bg);
			color: var(--component-node-foreground);
			box-shadow: 0 18px 60px rgba(0, 0, 0, .45);
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		.avatary-features-modal-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			padding: 12px 14px;
			border-bottom: 1px solid var(--border-color);
			font-size: 13px;
		}
		.avatary-features-modal-close {
			width: 28px;
			height: 28px;
			border: 0;
			border-radius: 8px;
			background: var(--component-node-widget-background);
			color: var(--component-node-foreground);
			cursor: pointer;
		}
		.avatary-features-modal-close:hover {
			background: var(--component-node-widget-background-hovered);
		}
		.avatary-features-modal-body {
			flex: 1 1 auto;
			min-height: 220px;
			padding: 14px;
			display: flex;
			flex-direction: column;
			gap: 10px;
		}
		.avatary-features-rule-list {
			flex: 1 1 auto;
			display: flex;
			flex-direction: column;
			gap: 8px;
			min-height: 0;
			overflow: auto;
		}
		.avatary-features-rule-row {
			display: flex;
			align-items: center;
			gap: 10px;
			min-height: 34px;
			border-radius: 8px;
			background: var(--component-node-widget-background);
			padding: 0 10px;
		}
		.avatary-features-rule-label {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.avatary-features-rule-type {
			flex: 0 0 auto;
			opacity: .72;
		}
		.avatary-features-rule-actions {
			display: flex;
			flex: 0 0 auto;
			gap: 8px;
		}
		.avatary-features-modal-footer {
			display: flex;
			justify-content: flex-end;
			gap: 8px;
			padding-top: 4px;
		}
		.avatary-features-rule-empty {
			color: var(--component-node-foreground-secondary);
			font-size: 13px;
			padding: 4px 0;
		}
		.avatary-features-regex-input {
			width: 100%;
			height: 34px;
			border: 0;
			border-radius: 8px;
			box-sizing: border-box;
			background: var(--component-node-widget-background);
			color: var(--component-node-foreground);
			font-size: 13px;
			outline: none;
			padding: 0 12px;
		}
		.avatary-features-regex-input:hover,
		.avatary-features-regex-input:focus {
			background: var(--component-node-widget-background-hovered);
		}
		.avatary-features-regex-error {
			min-height: 18px;
			color: var(--error-text, #ff6b6b);
			font-size: 12px;
		}
	`;
	document.head.appendChild(style);
}

function getPanelHeight(node) {
	const dynamicCount = (node.widgets || []).filter(
		(widget) => widget?.__featuresAvataryDynamic,
	).length;
	const rowCount = Math.max(1, node.__featuresAvataryRowCount || dynamicCount);
	return Math.max(
		PANEL_MIN_HEIGHT,
		Math.min(PANEL_MAX_HEIGHT, PANEL_BASE_HEIGHT + rowCount * FEATURE_ROW_HEIGHT),
	);
}

function ensurePanelWidget(node) {
	if (
		node.__featuresAvataryPanel &&
		node.widgets?.some((widget) => widget?.__featuresAvataryPanelWidget)
	) {
		return node.__featuresAvataryPanel;
	}
	if (node.widgets) {
		node.widgets = node.widgets.filter(
			(widget) => !widget?.__featuresAvataryPanelWidget,
		);
	}

	ensureStyles();
	const panel = document.createElement("div");
	panel.className = "avatary-features-panel";
	node.__featuresAvataryPanel = panel;

	if (typeof node.addDOMWidget === "function") {
		const widget = node.addDOMWidget("Features", "features_avatary_panel", panel, {
			serialize: false,
			hideOnZoom: false,
			getMinHeight: () => getPanelHeight(node),
		});
		if (widget) {
			widget.__featuresAvataryPanelWidget = true;
			widget.serialize = false;
			return panel;
		}
	}
	return null;
}

function closeRulesModal() {
	document.getElementById(MODAL_ID)?.remove();
}

function createModal(titleText) {
	ensureStyles();
	closeRulesModal();

	const backdrop = document.createElement("div");
	backdrop.id = MODAL_ID;
	backdrop.className = "avatary-features-modal-backdrop";

	const modal = document.createElement("div");
	modal.className = "avatary-features-modal";
	modal.addEventListener("click", (event) => event.stopPropagation());

	const header = document.createElement("div");
	header.className = "avatary-features-modal-header";

	const title = document.createElement("div");
	title.textContent = titleText;

	const close = document.createElement("button");
	close.type = "button";
	close.className = "avatary-features-modal-close";
	close.title = "Close";
	close.textContent = "x";
	close.addEventListener("click", closeRulesModal);

	const body = document.createElement("div");
	body.className = "avatary-features-modal-body";

	header.append(title, close);
	modal.append(header, body);
	backdrop.appendChild(modal);
	backdrop.addEventListener("click", closeRulesModal);
	document.body.appendChild(backdrop);
	return { body };
}

function ensureRuleStore(node) {
	if (!node.properties || typeof node.properties !== "object") {
		node.properties = {};
	}
	if (
		!node.properties[RULES_KEY] ||
		typeof node.properties[RULES_KEY] !== "object" ||
		Array.isArray(node.properties[RULES_KEY])
	) {
		node.properties[RULES_KEY] = {};
	}
	return node.properties[RULES_KEY];
}

function getFeatureRules(node, featureKey) {
	const store = ensureRuleStore(node);
	if (!Array.isArray(store[featureKey])) {
		store[featureKey] = [];
	}
	store[featureKey] = store[featureKey]
		.filter((rule) =>
			[
				"toggle",
				"toggle_node",
			].includes(rule?.type),
		)
		.map((rule) => ({
			type: rule.type === "toggle_node" ? "toggle_node" : "toggle",
			pattern: String(rule.pattern || ""),
		}));
	return store[featureKey];
}

function removeFeatureRule(node, featureKey, index) {
	const rules = getFeatureRules(node, featureKey);
	rules.splice(index, 1);
	app.graph?.setDirtyCanvas?.(true, true);
}

function refreshRulesBadge(node) {
	if (!isTargetNodeInstance(node)) {
		return;
	}
	node.__featuresAvataryForceRefresh = true;
	renderPanel(node, collectGroupsByTitle(node), ensureStateStore(node));
	app.graph?.setDirtyCanvas?.(true, true);
}

function ruleTypeLabel(type) {
	if (type === "toggle_node") {
		return "Toggle Node";
	}
	return "Toggle Group";
}

function ruleTypeDescription(type) {
	if (type === "toggle_node") {
		return "Matches node names by regex. Feature on bypasses matches; feature off activates them.";
	}
	return "Matches group names by regex. Feature on bypasses matches; feature off activates them.";
}

function createDescription(text) {
	const description = document.createElement("div");
	description.className = "avatary-features-rule-description";
	description.textContent = text;
	return description;
}

function openToggleRegexModal(node, entry, type = "toggle", editIndex = null) {
	const normalizedType = type === "toggle_node" ? "toggle_node" : "toggle";
	const editing = Number.isInteger(editIndex);
	const existingRule = editing ? getFeatureRules(node, entry.key)[editIndex] : null;
	const { body } = createModal(
		`${editing ? "Edit" : "Add"} ${ruleTypeLabel(normalizedType)} Rule`,
	);

	body.appendChild(createDescription(ruleTypeDescription(normalizedType)));

	const input = document.createElement("input");
	input.type = "text";
	input.className = "avatary-features-regex-input";
	input.placeholder = normalizedType.includes("_node")
		? "Node name regex"
		: "Group name regex";
	input.value = existingRule?.pattern || "";
	captureTextInputEvents(input);

	const error = document.createElement("div");
	error.className = "avatary-features-regex-error";

	const footer = document.createElement("div");
	footer.className = "avatary-features-modal-footer";

	const cancel = document.createElement("button");
	cancel.type = "button";
	cancel.className = "avatary-features-modal-button";
	cancel.textContent = "Cancel";
	cancel.addEventListener("click", () => openRulesModal(node, entry));

	const save = document.createElement("button");
	save.type = "button";
	save.className =
		"avatary-features-modal-button avatary-features-modal-button-primary";
	save.textContent = "Save";
	save.addEventListener("click", () => {
		const pattern = String(input.value || "").trim();
		if (!pattern) {
			error.textContent = "Enter a regex.";
			return;
		}
		try {
			new RegExp(pattern);
		} catch (err) {
			error.textContent = err?.message || "Invalid regex.";
			return;
		}
		const rules = getFeatureRules(node, entry.key);
		if (editing && rules[editIndex]) {
			rules[editIndex] = { type: normalizedType, pattern };
		} else {
			rules.push({ type: normalizedType, pattern });
		}
		app.graph?.setDirtyCanvas?.(true, true);
		refreshRulesBadge(node);
		openRulesModal(node, entry);
	});

	input.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			save.click();
		}
		if (event.key === "Escape") {
			event.preventDefault();
			openRulesModal(node, entry);
		}
	});

	footer.append(cancel, save);
	body.append(input, error, footer);
	setTimeout(() => input.focus(), 0);
}

function openAddRuleModal(node, entry) {
	const { body } = createModal("Add Rule");

	function createRuleOption(type) {
		const wrap = document.createElement("div");
		wrap.className = "avatary-features-rule-option";

		const button = document.createElement("button");
		button.type = "button";
		button.className = "avatary-features-modal-button";
		button.textContent = ruleTypeLabel(type);
		button.addEventListener("click", () => openToggleRegexModal(node, entry, type));

		const description = createDescription(ruleTypeDescription(type));

		wrap.append(button, description);
		return wrap;
	}

	body.append(
		createRuleOption("toggle"),
		createRuleOption("toggle_node"),
	);
}

function openRulesModal(node, entry) {
	const { body } = createModal(`${entry.title} Rules`);
	const rules = getFeatureRules(node, entry.key);

	const list = document.createElement("div");
	list.className = "avatary-features-rule-list";

	if (!rules.length) {
		const empty = document.createElement("div");
		empty.className = "avatary-features-rule-empty";
		empty.textContent = "No rules yet.";
		list.appendChild(empty);
	}

	for (const [index, rule] of rules.entries()) {
		const row = document.createElement("div");
		row.className = "avatary-features-rule-row";

		const type = document.createElement("div");
		type.className = "avatary-features-rule-type";
		type.textContent = ruleTypeLabel(rule.type);

		const label = document.createElement("div");
		label.className = "avatary-features-rule-label";
		label.textContent = rule.pattern;
		label.title = rule.pattern;

		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "avatary-features-modal-button";
		remove.textContent = "Remove";
		remove.addEventListener("click", () => {
			removeFeatureRule(node, entry.key, index);
			refreshRulesBadge(node);
			openRulesModal(node, entry);
		});

		const edit = document.createElement("button");
		edit.type = "button";
		edit.className = "avatary-features-modal-button";
		edit.textContent = "Edit";
		edit.addEventListener("click", () => {
			openToggleRegexModal(node, entry, rule.type, index);
		});

		const actions = document.createElement("div");
		actions.className = "avatary-features-rule-actions";
		actions.append(edit, remove);

		row.append(type, label, actions);
		list.appendChild(row);
	}

	const footer = document.createElement("div");
	footer.className = "avatary-features-modal-footer";

	const add = document.createElement("button");
	add.type = "button";
	add.className =
		"avatary-features-modal-button avatary-features-modal-button-primary";
	add.textContent = "Add Rule";
	add.addEventListener("click", () => openAddRuleModal(node, entry));

	footer.appendChild(add);
	body.append(list, footer);
}

function applyFeatureRules(node, entry, featureEnabled) {
	const rules = getFeatureRules(node, entry.key);
	if (!rules.length) {
		return;
	}
	const groupsByTitle = collectGroupsByTitle(node);
	const namedNodes = collectNamedNodes(node);
	for (const rule of rules) {
		if (
			![
				"toggle",
				"toggle_node",
			].includes(rule.type)
		) {
			continue;
		}
		let regex = null;
		try {
			regex = new RegExp(rule.pattern);
		} catch (_error) {
			continue;
		}
		const targetEnabled =
			!featureEnabled;

		if (rule.type === "toggle_node") {
			for (const target of namedNodes) {
				regex.lastIndex = 0;
				if (!regex.test(target.label)) {
					continue;
				}
				target.node.mode = targetEnabled ? MODE_ACTIVE : MODE_BYPASS;
				target.graph.setDirtyCanvas?.(true, true);
			}
			continue;
		}

		for (const targetEntry of groupsByTitle) {
			regex.lastIndex = 0;
			if (!regex.test(targetEntry.title)) {
				continue;
			}
			applyModeToGroupTitle(node, targetEntry, targetEnabled);
			const stateStore = ensureStateStore(node);
			stateStore[targetEntry.key] = targetEnabled;
		}
	}
}

function resolveInitialEnabled(node, entry, stateStore) {
	if (hasStoredState(stateStore, entry.key)) {
		return asBoolean(stateStore[entry.key]);
	}
	return resolveEnabledFromGroups(node, entry);
}

function syncWidgets(node, groupsByTitle, stateStore) {
	for (const entry of groupsByTitle) {
		const widgetName = entry.title;
		const actualEnabled = resolveEnabledFromGroups(node, entry);
		const targetEnabled = resolveInitialEnabled(node, entry, stateStore);
		if (!hasStoredState(stateStore, entry.key)) {
			stateStore[entry.key] = targetEnabled;
		}
		if (actualEnabled !== targetEnabled) {
			applyModeToGroupTitle(node, entry, targetEnabled);
		}

		const widget = findWidget(node, widgetName);
		if (!widget?.__featuresAvataryDynamic) {
			continue;
		}
		widget.value = targetEnabled;
	}
}

function renderPanel(node, groupsByTitle, stateStore) {
	ensureStyles();
	ensureToggleStyles();
	const panel = ensurePanelWidget(node);
	if (!panel) {
		return false;
	}

	panel.innerHTML = "";
	node.__featuresAvataryRowCount = groupsByTitle.length;
	panel.addEventListener("pointerdown", stopCanvasEvent);
	panel.addEventListener("mousedown", stopCanvasEvent);
	panel.addEventListener("touchstart", stopCanvasEvent);

	if (!groupsByTitle.length) {
		const empty = document.createElement("div");
		empty.className = "avatary-features-label";
		empty.textContent = "No groups found";
		panel.appendChild(empty);
		return true;
	}

	const hasAnyRules = groupsByTitle.some(
		(entry) => getFeatureRules(node, entry.key).length > 0,
	);

	for (const entry of groupsByTitle) {
		const isEnabled = resolveInitialEnabled(node, entry, stateStore);
		if (!hasStoredState(stateStore, entry.key)) {
			stateStore[entry.key] = isEnabled;
		}
		const actualEnabled = resolveEnabledFromGroups(node, entry);
		if (actualEnabled !== isEnabled) {
			applyModeToGroupTitle(node, entry, isEnabled);
		}

		const row = document.createElement("div");
		row.className = "avatary-features-row";
		row.addEventListener("pointerdown", stopCanvasEvent);
		row.addEventListener("mousedown", stopCanvasEvent);
		row.addEventListener("touchstart", stopCanvasEvent);

		const label = document.createElement("div");
		label.className = "avatary-features-label";
		label.textContent = entry.title;
		label.title = entry.title;

		const toggle = createToggle({
			active: isEnabled,
			disabled: false,
			title: entry.title,
			onToggle: () => {
				const latestEntry = getEntryByKey(node, entry.key);
				if (!latestEntry) {
					return;
				}
				const enabled = !asBoolean(stateStore[entry.key]);
				stateStore[entry.key] = enabled;
				applyModeToGroupTitle(node, latestEntry, enabled);
				applyFeatureRules(node, latestEntry, enabled);
				renderPanel(node, collectGroupsByTitle(node), stateStore);
			},
		});
		toggle.addEventListener("pointerdown", stopCanvasEvent);
		toggle.addEventListener("mousedown", stopCanvasEvent);
		toggle.addEventListener("touchstart", stopCanvasEvent);

		const rules = document.createElement("button");
		rules.type = "button";
		rules.className = "avatary-features-rules-button";
		rules.title = `Open rules for ${entry.title}`;
		const rulesText = document.createElement("span");
		rulesText.textContent = "Rules";
		rules.appendChild(rulesText);
		const ruleCount = getFeatureRules(node, entry.key).length;
		if (ruleCount > 0 || hasAnyRules) {
			const badge = document.createElement("span");
			badge.className = "avatary-features-rules-badge";
			badge.textContent = String(ruleCount);
			rules.appendChild(badge);
		}
		rules.addEventListener("pointerdown", stopCanvasEvent);
		rules.addEventListener("mousedown", stopCanvasEvent);
		rules.addEventListener("touchstart", stopCanvasEvent);
		rules.addEventListener("click", (event) => {
			event.stopPropagation();
			openRulesModal(node, entry);
		});

		row.append(label, toggle, rules);
		panel.appendChild(row);
	}

	node.setSize?.([
		Math.max(node.size?.[0] || 0, 360),
		Math.max(node.size?.[1] || 0, getPanelHeight(node) + 76),
	]);
	app.graph?.setDirtyCanvas?.(true, true);
	return true;
}

function removeDynamicWidgets(node) {
	let index = 0;
	while ((node.widgets || [])[index]) {
		if (node.widgets[index]?.__featuresAvataryDynamic) {
			node.removeWidget(index);
			continue;
		}
		index += 1;
	}
}

function forceFullRefresh(node) {
	queueRefresh(node, true);
}

function refreshNode(node) {
	if (!isTargetNodeInstance(node)) {
		return;
	}

	const groupsByTitle = collectGroupsByTitle(node);
	const stateStore = ensureStateStore(node);
	const signature = computeSignature(groupsByTitle);
	const forceRefresh = Boolean(node.__featuresAvataryForceRefresh);
	if (forceRefresh) {
		node.__featuresAvataryForceRefresh = false;
	}

	const activeKeys = new Set(groupsByTitle.map((entry) => entry.key));
	for (const key of Object.keys(stateStore)) {
		if (!activeKeys.has(key)) {
			delete stateStore[key];
		}
	}

	if (!forceRefresh && node.__featuresAvatarySignature === signature) {
		syncWidgets(node, groupsByTitle, stateStore);
		app.graph?.setDirtyCanvas?.(true, true);
		return;
	}

	node.__featuresAvatarySignature = signature;
	removeDynamicWidgets(node);

	if (renderPanel(node, groupsByTitle, stateStore)) {
		app.graph?.setDirtyCanvas?.(true, true);
		return;
	}

	for (const entry of groupsByTitle) {
		const widgetName = entry.title;
		const isEnabled = resolveInitialEnabled(node, entry, stateStore);
		stateStore[entry.key] = isEnabled;
		const actualEnabled = resolveEnabledFromGroups(node, entry);
		if (actualEnabled !== isEnabled) {
			applyModeToGroupTitle(node, entry, isEnabled);
		}

		const widget = node.addWidget("toggle", widgetName, isEnabled, (value) => {
			const enabled = Boolean(value);
			const latestEntry = getEntryByKey(node, entry.key);
			if (!latestEntry) {
				return;
			}
			stateStore[entry.key] = enabled;
			applyModeToGroupTitle(node, latestEntry, enabled);
		});

		widget.__featuresAvataryDynamic = true;
		widget.__featuresAvataryKey = entry.key;
		widget.value = isEnabled;
	}

	node.setSize([node.size[0], node.computeSize()[1]]);
	app.graph?.setDirtyCanvas?.(true, true);
}

function bindNode(node) {
	if (node.__featuresAvataryBound) {
		return;
	}
	node.__featuresAvataryBound = true;
	syncNodeTitle(node);

	const originalOnRemoved = node.onRemoved;
	node.onRemoved = function (...args) {
		if (this.__featuresAvataryRefreshTimer) {
			clearInterval(this.__featuresAvataryRefreshTimer);
			this.__featuresAvataryRefreshTimer = null;
		}
		if (this.__featuresAvataryPanel?.isConnected) {
			this.__featuresAvataryPanel.remove();
		}
		this.__featuresAvataryPanel = null;
		if (this.widgets) {
			this.widgets = this.widgets.filter(
				(widget) => !widget?.__featuresAvataryPanelWidget,
			);
		}
		return originalOnRemoved?.apply(this, args);
	};

	node.__featuresAvataryRefreshTimer = setInterval(() => {
		const graph = getCurrentGraph(node);
		if (!graph) {
			return;
		}
		if (node.__featuresAvataryGraphRef !== graph) {
			node.__featuresAvataryGraphRef = graph;
			forceFullRefresh(node);
			return;
		}
		refreshNode(node);
	}, REFRESH_MS);
}

app.registerExtension({
	name: "avatary.features",

	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (!isTargetNodeDef(nodeData)) {
			return;
		}

		const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
		const originalOnConfigure = nodeType.prototype.onConfigure;

		nodeType.prototype.onNodeCreated = function (...args) {
			const result = originalOnNodeCreated?.apply(this, args);
			bindNode(this);
			queueRefresh(this, true);
			setTimeout(() => queueRefresh(this, true), 80);
			setTimeout(() => queueRefresh(this, true), 250);
			return result;
		};

		nodeType.prototype.onConfigure = function (...args) {
			const result = originalOnConfigure?.apply(this, args);
			bindNode(this);
			queueRefresh(this, true);
			setTimeout(() => queueRefresh(this, true), 80);
			return result;
		};
	},

	loadedGraphNode(node) {
		if (!isTargetNodeInstance(node)) {
			return;
		}
		bindNode(node);
		queueRefresh(node, true);
		setTimeout(() => queueRefresh(node, true), 80);
	},
});
