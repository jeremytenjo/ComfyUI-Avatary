// @ts-nocheck
import { app } from "/scripts/app.js";
import { renderMissingFiles } from "./components/missing_files.js";

const NODE_CLASS = "ControlLight";
const PANEL_HEIGHT = 210;
const DEFAULT_W = 340;
const ROUTE = "/avatary/controllight/missing-files";

function ensurePanelWidget(node) {
	if (
		node._avataryControlLightPanel &&
		node.widgets?.some((w) => w?._avataryControlLightPanelWidget)
	) {
		return node._avataryControlLightPanel;
	}
	if (node.widgets) {
		node.widgets = node.widgets.filter((w) => !w?._avataryControlLightPanelWidget);
	}
	const panel = document.createElement("div");
	panel.style.cssText = [
		"display:flex",
		"flex-direction:column",
		"gap:8px",
		"padding:1px",
		"height:100%",
		"overflow:auto",
		"box-sizing:border-box",
	].join(";");
	node._avataryControlLightPanel = panel;

	if (typeof node.addDOMWidget === "function") {
		const w = node.addDOMWidget("ControlLight", "control_light_panel", panel, {
			serialize: false,
			hideOnZoom: false,
			getMinHeight: () => PANEL_HEIGHT,
		});
		if (w) {
			w._avataryControlLightPanelWidget = true;
			w.serialize = false;
			return panel;
		}
	}
	return null;
}

async function fetchMissingFiles() {
	const response = await fetch(ROUTE, { method: "GET" });
	if (!response.ok) {
		throw new Error(`Missing-files request failed (${response.status})`);
	}
	return await response.json();
}

function renderLoading(panel) {
	panel.innerHTML = "";
	const copy = document.createElement("div");
	copy.className = "text-component-node-foreground-secondary text-xs";
	copy.textContent = "Checking ControlLight files...";
	panel.appendChild(copy);
}

function renderError(panel, message) {
	panel.innerHTML = "";
	const copy = document.createElement("div");
	copy.className = "text-component-node-foreground-secondary text-xs";
	copy.textContent = String(message || "Failed to check required files.");
	panel.appendChild(copy);
}

async function refreshPanel(node) {
	const panel = ensurePanelWidget(node);
	if (!panel) return;
	if (node._avataryControlLightBusy) return;
	node._avataryControlLightBusy = true;
	renderLoading(panel);
	try {
		const payload = await fetchMissingFiles();
		const items = (Array.isArray(payload?.items) ? payload.items : []).filter(
			(item) => Boolean(item?.missing),
		);
		renderMissingFiles({
			container: panel,
			title: "ControlLight Missing Files",
			items,
		});
	} catch (err) {
		renderError(panel, err?.message || String(err));
	} finally {
		node._avataryControlLightBusy = false;
	}
}

function startPolling(node) {
	if (node._avataryControlLightTimer) return;
	node._avataryControlLightTimer = setInterval(() => {
		try {
			refreshPanel(node);
		} catch (_err) {}
	}, 8000);
}

app.registerExtension({
	name: "Avatary.ControlLight.MissingFiles",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData.name !== NODE_CLASS) return;

		const origCreated = nodeType.prototype.onNodeCreated;
		nodeType.prototype.onNodeCreated = function (...args) {
			const r = origCreated?.apply(this, args);
			this.size[0] = Math.max(this.size?.[0] || 0, DEFAULT_W);
			this.size[1] = Math.max(this.size?.[1] || 0, PANEL_HEIGHT + 110);
			refreshPanel(this);
			startPolling(this);
			return r;
		};

		const origConfigure = nodeType.prototype.onConfigure;
		nodeType.prototype.onConfigure = function (...args) {
			const r = origConfigure?.apply(this, args);
			refreshPanel(this);
			startPolling(this);
			return r;
		};

		const origRemoved = nodeType.prototype.onRemoved;
		nodeType.prototype.onRemoved = function (...args) {
			if (this._avataryControlLightTimer) {
				clearInterval(this._avataryControlLightTimer);
				this._avataryControlLightTimer = null;
			}
			if (this._avataryControlLightPanel?.isConnected) {
				this._avataryControlLightPanel.remove();
			}
			this._avataryControlLightPanel = null;
			if (this.widgets) {
				this.widgets = this.widgets.filter(
					(w) => !w?._avataryControlLightPanelWidget,
				);
			}
			return origRemoved?.apply(this, args);
		};
	},

	loadedGraphNode(node) {
		const isTarget =
			node?.comfyClass === NODE_CLASS ||
			node?.type === NODE_CLASS ||
			node?.constructor?.type === NODE_CLASS;
		if (!isTarget) return;
		node.size[0] = Math.max(node.size?.[0] || 0, DEFAULT_W);
		node.size[1] = Math.max(node.size?.[1] || 0, PANEL_HEIGHT + 110);
		refreshPanel(node);
		startPolling(node);
	},
});
