// @ts-nocheck
import { app } from "../../scripts/app.js";

const NODE_NAME = "AvataryFeatures";
const NODE_DISPLAY_NAME = "Features Avatary";
const MODE_ACTIVE = LiteGraph.ALWAYS;
const MODE_BYPASS = 4;
const STATE_KEY = "features_avatary_states";
const REFRESH_MS = 400;
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

function computeSignature(groupsByTitle) {
	return groupsByTitle.map((entry) => entry.key).join("|");
}

function hasStoredState(stateStore, key) {
	return Object.hasOwn(stateStore, key);
}

function resolveInitialEnabled(node, entry, stateStore) {
	if (hasStoredState(stateStore, entry.key)) {
		return Boolean(stateStore[entry.key]);
	}
	return resolveEnabledFromGroups(node, entry);
}

function syncWidgets(node, groupsByTitle, stateStore) {
	for (const entry of groupsByTitle) {
		const widgetName = entry.title;
		const widget = findWidget(node, widgetName);
		if (!widget?.__featuresAvataryDynamic) {
			continue;
		}
		const actualEnabled = resolveEnabledFromGroups(node, entry);
		const targetEnabled = resolveInitialEnabled(node, entry, stateStore);
		if (!hasStoredState(stateStore, entry.key)) {
			stateStore[entry.key] = targetEnabled;
		}
		if (actualEnabled !== targetEnabled) {
			applyModeToGroupTitle(node, entry, targetEnabled);
		}
		widget.value = targetEnabled;
	}
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
