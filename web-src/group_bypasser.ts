// @ts-nocheck
import { app } from "../../scripts/app.js";

const NODE_NAME = "ComfyUI-Group-Bypasser";
const NODE_DISPLAY_NAME = "Group Bypasser";
const MODE_ACTIVE = LiteGraph.ALWAYS;
const MODE_BYPASS = 4;
const STATE_KEY = "group_bypasser_states";
const REFRESH_MS = 400;
const ALPHABETICAL_COLLATOR = new Intl.Collator(undefined, {
	sensitivity: "base",
	numeric: true,
});

function queueRefresh(node, force = false) {
	if (force) {
		node.__groupBypasserForceRefresh = true;
	}
	if (node.__groupBypasserRefreshQueued) {
		return;
	}
	node.__groupBypasserRefreshQueued = true;
	setTimeout(() => {
		node.__groupBypasserRefreshQueued = false;
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
	if (!title || title === NODE_NAME || title === "ComfyUI-Group-Bypasser") {
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

function applyModeToGroupTitle(_node, groupEntry, bypassed) {
	if (!groupEntry?.groups?.length) {
		return;
	}

	const seenNodeIds = new WeakMap();
	const mode = bypassed ? MODE_BYPASS : MODE_ACTIVE;

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

function resolveBypassFromGroups(_node, groupEntry) {
	if (!groupEntry?.groups?.length) {
		return false;
	}

	const seenNodeIds = new WeakMap();
	let allBypassed = true;
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
			if (targetNode.mode !== MODE_BYPASS) {
				allBypassed = false;
			}
		}
	}

	if (!anyFound) {
		return false;
	}
	return allBypassed;
}

function getEntryByKey(node, key) {
	return collectGroupsByTitle(node).find((entry) => entry.key === key) || null;
}

function computeSignature(groupsByTitle) {
	return groupsByTitle.map((entry) => entry.key).join("|");
}

function hasStoredState(stateStore, key) {
	return Object.hasOwn(stateStore, key);
}

function syncWidgets(node, groupsByTitle, stateStore) {
	for (const entry of groupsByTitle) {
		const widgetName = entry.title;
		const widget = findWidget(node, widgetName);
		if (!widget?.__groupBypasserDynamic) {
			continue;
		}
		const hasSavedState = hasStoredState(stateStore, entry.key);
		const actualBypassed = resolveBypassFromGroups(node, entry);
		const targetBypassed = hasSavedState
			? Boolean(stateStore[entry.key])
			: actualBypassed;
		if (!hasSavedState) {
			stateStore[entry.key] = targetBypassed;
		}
		if (actualBypassed !== targetBypassed) {
			applyModeToGroupTitle(node, entry, targetBypassed);
		}
		widget.value = targetBypassed;
	}
}

function removeDynamicWidgets(node) {
	let index = 0;
	while ((node.widgets || [])[index]) {
		if (node.widgets[index]?.__groupBypasserDynamic) {
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
	const forceRefresh = Boolean(node.__groupBypasserForceRefresh);
	if (forceRefresh) {
		node.__groupBypasserForceRefresh = false;
	}

	// Drop stale state keys.
	const activeKeys = new Set(groupsByTitle.map((entry) => entry.key));
	for (const key of Object.keys(stateStore)) {
		if (!activeKeys.has(key)) {
			delete stateStore[key];
		}
	}

	if (!forceRefresh && node.__groupBypasserSignature === signature) {
		syncWidgets(node, groupsByTitle, stateStore);
		app.graph?.setDirtyCanvas?.(true, true);
		return;
	}

	node.__groupBypasserSignature = signature;
	removeDynamicWidgets(node);

	for (const entry of groupsByTitle) {
		const widgetName = entry.title;
		const actualBypassed = resolveBypassFromGroups(node, entry);
		const isBypassed = hasStoredState(stateStore, entry.key)
			? Boolean(stateStore[entry.key])
			: actualBypassed;
		stateStore[entry.key] = isBypassed;
		if (actualBypassed !== isBypassed) {
			applyModeToGroupTitle(node, entry, isBypassed);
		}

		const widget = node.addWidget("toggle", widgetName, isBypassed, (value) => {
			const bypassed = Boolean(value);
			const latestEntry = getEntryByKey(node, entry.key);
			if (!latestEntry) {
				return;
			}
			stateStore[entry.key] = bypassed;
			applyModeToGroupTitle(node, latestEntry, bypassed);
		});

		widget.__groupBypasserDynamic = true;
		widget.__groupBypasserKey = entry.key;
		widget.value = isBypassed;
	}

	node.setSize([node.size[0], node.computeSize()[1]]);
	app.graph?.setDirtyCanvas?.(true, true);
}

function bindNode(node) {
	if (node.__groupBypasserBound) {
		return;
	}
	node.__groupBypasserBound = true;
	syncNodeTitle(node);

	const originalOnRemoved = node.onRemoved;
	node.onRemoved = function () {
		if (this.__groupBypasserRefreshTimer) {
			clearInterval(this.__groupBypasserRefreshTimer);
			this.__groupBypasserRefreshTimer = null;
		}
		return originalOnRemoved?.apply(this, arguments);
	};

	// Keep frame list up-to-date while preserving saved states by title key.
	node.__groupBypasserRefreshTimer = setInterval(() => {
		const graph = getCurrentGraph(node);
		if (!graph) {
			return;
		}
		if (node.__groupBypasserGraphRef !== graph) {
			node.__groupBypasserGraphRef = graph;
			forceFullRefresh(node);
			return;
		}
		refreshNode(node);
	}, REFRESH_MS);
}

app.registerExtension({
	name: "comfy.group.bypasser",

	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (!isTargetNodeDef(nodeData)) {
			return;
		}

		const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
		const originalOnConfigure = nodeType.prototype.onConfigure;

		nodeType.prototype.onNodeCreated = function () {
			const result = originalOnNodeCreated?.apply(this, arguments);
			bindNode(this);
			queueRefresh(this, true);
			setTimeout(() => queueRefresh(this, true), 80);
			setTimeout(() => queueRefresh(this, true), 250);
			return result;
		};

		nodeType.prototype.onConfigure = function () {
			const result = originalOnConfigure?.apply(this, arguments);
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
