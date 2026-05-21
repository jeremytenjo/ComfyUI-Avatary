import { app } from "/scripts/app.js";
import { getUpstreamType } from "./core.mjs";

export const BRAND = "#f66744";
export const ROW_H = 20;
export const TOP_PAD = 4;

const TOGGLE_W = 28;
const TOGGLE_H = 14;
const TOGGLE_R = 7;
const KNOB_R = 4;
const PAD_RIGHT = 70;
const DOT_GUTTER = 28;

export function rowCenterY(slotIdx0) {
  return TOP_PAD + slotIdx0 * ROW_H + ROW_H / 2;
}

export function toggleRect(nodeWidth, slotIdx0) {
  const cy = rowCenterY(slotIdx0);
  return {
    x: nodeWidth - PAD_RIGHT - TOGGLE_W,
    y: cy - TOGGLE_H / 2,
    w: TOGGLE_W,
    h: TOGGLE_H,
  };
}

function inside(pos, r) {
  return (
    pos[0] >= r.x && pos[0] <= r.x + r.w &&
    pos[1] >= r.y && pos[1] <= r.y + r.h
  );
}

export function hitToggle(pos, nodeWidth, slotIdx0) {
  return inside(pos, toggleRect(nodeWidth, slotIdx0));
}

export function labelRect(nodeWidth, slotIdx0) {
  const cy = rowCenterY(slotIdx0);
  const left = DOT_GUTTER + 4;
  const right = nodeWidth - PAD_RIGHT - TOGGLE_W - 6;
  return {
    x: left,
    y: cy - ROW_H / 2,
    w: Math.max(0, right - left),
    h: ROW_H,
  };
}

export function hitLabel(pos, nodeWidth, slotIdx0) {
  return inside(pos, labelRect(nodeWidth, slotIdx0));
}

export function labelScreenRect(node, slotIdx1) {
  const slotIdx0 = slotIdx1 - 1;
  const r = labelRect(node.size?.[0] || 260, slotIdx0);

  const ds = app.canvas?.ds;
  const scale = ds?.scale || 1;
  const offsetX = ds?.offset?.[0] || 0;
  const offsetY = ds?.offset?.[1] || 0;
  const canvasEl = app.canvas?.canvas;
  const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : { left: 0, top: 0 };
  const baseLeft = canvasRect.left + offsetX * scale;
  const baseTop = canvasRect.top + offsetY * scale;
  return {
    x: baseLeft + (node.pos[0] + r.x) * scale,
    y: baseTop + (node.pos[1] + r.y) * scale,
    w: r.w * scale,
    h: r.h * scale,
  };
}

function drawToggle(ctx, nodeWidth, slotIdx0, on, disabled) {
  const r = toggleRect(nodeWidth, slotIdx0);
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.35;

  ctx.beginPath();
  ctx.fillStyle = on ? BRAND : "rgba(255,255,255,0.06)";
  ctx.strokeStyle = on ? BRAND : "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  const rad = TOGGLE_R;
  const t = r.y, b = r.y + r.h, l = r.x, ri = r.x + r.w;
  ctx.moveTo(l + rad, t);
  ctx.arcTo(ri, t, ri, b, rad);
  ctx.arcTo(ri, b, l, b, rad);
  ctx.arcTo(l, b, l, t, rad);
  ctx.arcTo(l, t, ri, t, rad);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = on ? "#fff" : "#ccc";
  const knobX = on ? (ri - TOGGLE_R) : (l + TOGGLE_R);
  const knobY = r.y + r.h / 2;
  ctx.arc(knobX, knobY, KNOB_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawLabel(ctx, nodeWidth, slotIdx0, text, dim, placeholderType) {
  const cy = rowCenterY(slotIdx0);
  const lx = DOT_GUTTER + 4;
  const maxW = nodeWidth - PAD_RIGHT - TOGGLE_W - 8 - lx;

  ctx.save();

  if (dim) ctx.globalAlpha = 0.45;
  const hasUserText = text && text.length > 0;
  const usefulType = placeholderType && placeholderType !== "*" ? placeholderType : null;
  let display;
  let color;
  if (hasUserText) {
    display = text;
    color = "#d8d8d8";
  } else if (dim) {
    display = "(empty)";
    color = "#aaa";
  } else if (usefulType) {
    display = usefulType;
    color = "#d8d8d8";
  } else {
    display = "Label...";
    color = "#5a5a5a";
  }

  ctx.fillStyle = color;
  ctx.font = "12px 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  let painted = display;
  if (ctx.measureText(painted).width > maxW) {
    while (painted.length > 1 && ctx.measureText(painted + "...").width > maxW) {
      painted = painted.slice(0, -1);
    }
    painted += "...";
  }
  ctx.fillText(painted, lx, cy);
  ctx.restore();
}

export function drawSwitchRows(node, ctx) {
  const inputs = node.inputs;
  if (!inputs || inputs.length === 0) return;
  const w = node.size[0];
  const state = node.properties?.switchState;
  const activeIndex = state?.activeIndex ?? 0;
  const labels = state?.labels ?? {};

  for (let i = 0; i < inputs.length; i++) {
    const slotIdx1 = i + 1;
    const slot = inputs[i];
    const connected = slot != null && slot.link != null;
    const isTrailing = !connected && slotIdx1 === inputs.length;
    const on = connected && activeIndex === slotIdx1;

    const labelTxt = labels[slotIdx1] || "";
    const placeholderType = connected ? getUpstreamType(node, slotIdx1) : null;
    drawLabel(ctx, w, i, labelTxt, isTrailing, placeholderType);
    drawToggle(ctx, w, i, on, isTrailing);
  }
}
