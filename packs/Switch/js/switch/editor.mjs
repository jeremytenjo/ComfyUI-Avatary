import { app } from "/scripts/app.js";

const STATE_PROP = "switchState";
const BRAND = "#f66744";

let activeEditor = null;

function commit(state) {
  if (!state || state._committed) return;
  state._committed = true;
  const { node, slotIdx, input } = state;
  if (!input.isConnected) { cleanup(state); return; }
  const value = input.value.trim();
  const sw = node.properties[STATE_PROP] || (node.properties[STATE_PROP] = {});
  if (!sw.labels) sw.labels = {};
  if (value) sw.labels[slotIdx] = value;
  else delete sw.labels[slotIdx];
  cleanup(state);
  node.graph?.setDirtyCanvas?.(true, true);
}

function cancel(state) {
  if (!state || state._committed) return;
  state._committed = true;
  cleanup(state);
}

function cleanup(state) {
  if (!state) return;
  if (state.windowKeyHandler) {
    window.removeEventListener("keydown", state.windowKeyHandler, true);
  }
  if (state.blurHandler) state.input.removeEventListener("blur", state.blurHandler);
  state.input.remove();
  if (activeEditor === state) activeEditor = null;
}

export function openLabelEditor(node, slotIdx, rect) {
  if (activeEditor) commit(activeEditor);

  const initial = node.properties?.[STATE_PROP]?.labels?.[slotIdx] || "";
  const scale = app.canvas?.ds?.scale || 1;
  const fontPx = 12 * scale;
  const padX = 6 * scale;
  const borderPx = Math.max(1, 2 * scale);

  const input = document.createElement("input");
  input.type = "text";
  input.value = initial;
  input.placeholder = "Label";
  input.style.cssText = [
    "position: fixed",
    `left: ${rect.x}px`,
    `top: ${rect.y}px`,
    `width: ${rect.w}px`,
    `height: ${rect.h}px`,
    "z-index: 10000",
    "background: #1f1f1f",
    "color: #d8d8d8",
    `border: ${borderPx}px solid ${BRAND}`,
    "border-radius: 3px",
    `padding: 0 ${padX}px`,
    `font: ${fontPx}px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif`,
    "outline: none",
    "box-sizing: border-box",
    "line-height: 1",
  ].join("; ");

  document.body.appendChild(input);

  const state = { node, slotIdx, input, _committed: false };

  state.windowKeyHandler = (e) => {
    if (e.target !== input) return;
    e.stopImmediatePropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commit(state);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel(state);
    }
  };

  state.blurHandler = () => commit(state);
  window.addEventListener("keydown", state.windowKeyHandler, true);

  activeEditor = state;

  setTimeout(() => {
    if (!input.isConnected) return;
    input.focus();
    input.select();
    input.addEventListener("blur", state.blurHandler);
  }, 0);
}

export function cancelEditorForNode(node) {
  if (activeEditor && activeEditor.node === node) {
    cancel(activeEditor);
  }
}
