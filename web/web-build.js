// web-src/download_to_directory.ts
(() => {
  const DIALOG_ID = "download-to-directory-dialog";
  const BUTTON_ID = "download-to-directory-button";
  const RECENT_FOLDERS_KEY = "download-to-directory-recent-folders-v1";
  const ADVANCED_OPEN_KEY = "download-to-directory-advanced-open-v1";
  const HISTORY_KEY = "download-to-directory-history-v1";
  const HF_TOKEN_KEY = "download-to-directory-hf-token-v1";
  const DEFAULT_DOWNLOAD_ROOT = "models/loras";
  const MAX_RECENT_FOLDERS = 8;
  const MAX_HISTORY_ITEMS = 100;
  const HOT_RELOAD_POLL_MS = 800;
  const state = {
    apiPrefix: "/api",
    roots: [],
    toggleEl: null,
    dialogEl: null,
    historyEntries: [],
    installBusy: false,
    installJobId: "",
    installProgress: null,
    installPollTimer: null,
    installResults: [],
    uploadFolder: "output"
  };
  let restartConfirmResolver = null;
  let uploadPathResolver = null;
  let exportPathResolver = null;
  let hotReloadTimer = null;
  let lastHotReloadStamp = null;
  function ensureStyles5() {
    if (document.getElementById("download-to-directory-style")) return;
    const style = document.createElement("style");
    style.id = "download-to-directory-style";
    style.textContent = `
      #download-to-directory-inline-slot {
        display: flex;
        align-items: center;
        pointer-events: auto;
        height: 48px;
        flex-shrink: 0;
        padding: 0 8px;
        border: 1px solid var(--interface-stroke, var(--p-content-border-color, #434958));
        border-radius: 12px;
        background: var(--comfy-menu-bg, var(--p-content-background, #16191f));
        box-shadow: var(--shadow-interface, 0 8px 24px rgba(0, 0, 0, 0.22));
      }
      #${BUTTON_ID} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 32px;
        padding: 8px 12px;
        border: none;
        border-radius: 8px;
        background: var(--secondary-background, var(--p-surface-800, #23262f));
        color: var(--secondary-foreground, var(--p-surface-0, #fff));
        font-size: 12px;
        font-weight: 500;
        line-height: 1;
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
        transition: background 120ms ease;
      }
      #${BUTTON_ID}:hover {
        background: var(--secondary-background-hover, var(--interface-button-hover-surface, #2f3340));
      }
      #${BUTTON_ID} i {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }
      #${DIALOG_ID} {
        width: min(760px, calc(100vw - 64px));
        max-height: calc(100vh - 24px);
        overflow: visible;
        border: 1px solid var(--p-content-border-color, #343943);
        border-radius: 20px;
        background: var(--p-content-background, #16191f);
        color: var(--p-text-color, #f5f7fb);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
        padding: 0;
        transform-origin: 50% 50%;
        opacity: 0;
        transform: translateY(8px) scale(0.96);
      }
      #${DIALOG_ID}::backdrop {
        background: rgba(8, 10, 14, 0.64);
        opacity: 0;
      }
      #${DIALOG_ID}[open] {
        animation: dtd-dialog-in 180ms cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
      }
      #${DIALOG_ID}[open]::backdrop {
        animation: dtd-backdrop-in 180ms ease forwards;
      }
      #${DIALOG_ID}.dtd-closing {
        animation: dtd-dialog-out 150ms cubic-bezier(0.4, 0, 1, 1) forwards;
      }
      #${DIALOG_ID}.dtd-closing::backdrop {
        animation: dtd-backdrop-out 150ms ease forwards;
      }
      @keyframes dtd-dialog-in {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes dtd-dialog-out {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(8px) scale(0.96);
        }
      }
      @keyframes dtd-backdrop-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes dtd-backdrop-out {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
      #${DIALOG_ID} .body {
        --dtd-body-pad-x: 18px;
        --dtd-band-bg: var(--p-surface-900, #141922);
        padding: 16px var(--dtd-body-pad-x) 14px;
        max-height: calc(100vh - 24px);
        overflow: auto;
      }
      #${DIALOG_ID} .row {
        --dtd-stack-gap: 12px;
        display: flex;
        flex-direction: column;
        gap: var(--dtd-stack-gap);
      }
      #${DIALOG_ID} .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #${DIALOG_ID} .form-section {
        display: flex;
        flex-direction: column;
        gap: var(--dtd-stack-gap);
        padding: 10px 0;
      }
      #${DIALOG_ID} .bleed {
        box-sizing: border-box;
        margin-left: calc(-1 * var(--dtd-body-pad-x));
        margin-right: calc(-1 * var(--dtd-body-pad-x));
        width: calc(100% + (var(--dtd-body-pad-x) * 2));
      }
      #${DIALOG_ID} .title-band,
      #${DIALOG_ID} .cta-band {
        background: var(--dtd-band-bg);
        padding: 10px var(--dtd-body-pad-x);
      }
      #${DIALOG_ID} .title-band {
        padding-top: 8px;
        padding-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      #${DIALOG_ID} .divider {
        height: 1px;
        background: var(--p-content-border-color, #434958);
      }
      #${DIALOG_ID} input,
      #${DIALOG_ID} select,
      #${DIALOG_ID} button {
        width: 100%;
        box-sizing: border-box;
        margin: 0;
        border-radius: 11px;
        border: 1px solid var(--p-content-border-color, #434958);
        background: var(--p-surface-800, #232831);
        color: var(--p-text-color, #f5f7fb);
        padding: 9px 12px;
        font-size: 14px;
        line-height: 1.4;
      }
      #${DIALOG_ID} input::placeholder {
        color: var(--p-text-muted-color, #9aa2b3);
      }
      #${DIALOG_ID} input:focus,
      #${DIALOG_ID} select:focus {
        outline: none;
        border-color: var(--p-primary-color, #4399ff);
        box-shadow: 0 0 0 1px var(--p-primary-color, #4399ff);
      }
      #${DIALOG_ID} label {
        display: block;
        margin-bottom: 2px;
        color: var(--p-text-color, #f5f7fb);
        font-size: 14px;
        font-weight: 600;
      }
      #${DIALOG_ID} .hint {
        margin: 0;
        color: var(--p-text-muted-color, #a8afbd);
        font-size: 12px;
        line-height: 1.35;
      }
      #${DIALOG_ID} .status {
        margin: 0;
        min-height: 22px;
        font-size: 14px;
      }
      #${DIALOG_ID} .status.error {
        color: #ff8f9d;
      }
      #${DIALOG_ID} .status.success {
        color: #6de4a0;
      }
      #${DIALOG_ID} .inline {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
      }
      #${DIALOG_ID} details.section {
        margin: 0;
        border: 1px solid var(--p-content-border-color, #434958);
        border-radius: 12px;
        background: var(--p-surface-900, #1a1f27);
        overflow: hidden;
      }
      #${DIALOG_ID} details.section > summary {
        cursor: pointer;
        list-style: none;
        padding: 9px 12px;
        font-size: 13px;
        font-weight: 600;
        color: var(--p-text-color, #f5f7fb);
        user-select: none;
      }
      #${DIALOG_ID} details.section > summary::-webkit-details-marker {
        display: none;
      }
      #${DIALOG_ID} .advanced-body {
        padding: 0 12px 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #${DIALOG_ID} .inline input[type="checkbox"] {
        margin: 0;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 1px solid var(--p-content-border-color, #505768);
        background: var(--p-surface-900, #1a1f27);
        accent-color: var(--p-primary-color, #2f8dff);
        box-shadow: none;
      }
      #${DIALOG_ID} .actions {
        display: flex;
        gap: 10px;
        margin: 0;
      }
      #${DIALOG_ID} .actions button {
        margin-bottom: 0;
        height: 42px;
        font-weight: 600;
        cursor: pointer;
        transition: filter 120ms ease, border-color 120ms ease, background 120ms ease;
      }
      #${DIALOG_ID} #dtd-submit {
        background: var(--p-primary-color, #2587f9);
        border-color: color-mix(in srgb, var(--p-primary-color, #2587f9) 68%, #ffffff 32%);
        color: #ffffff;
      }
      #${DIALOG_ID} #dtd-submit:hover {
        filter: brightness(1.08);
      }
      #${DIALOG_ID} #dtd-upload,
      #${DIALOG_ID} #dtd-export {
        width: fit-content;
        min-width: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding-block: 8px;
        padding-inline: 18px;
        line-height: 1;
        background: var(--p-surface-800, #232831);
        border-color: color-mix(in srgb, var(--p-primary-color, #2587f9) 40%, var(--p-content-border-color, #434958));
        color: var(--p-text-color, #f5f7fb);
      }
      #${DIALOG_ID} #dtd-upload:hover,
      #${DIALOG_ID} #dtd-export:hover {
        background: var(--p-surface-700, #2c323d);
      }
      #${DIALOG_ID} #dtd-restart {
        width: fit-content;
        min-width: 0;
        padding: 8px 10px;
        display: inline-flex;
        align-items: center;
        background: var(--p-surface-800, #232831);
        border-color: color-mix(in srgb, var(--p-primary-color, #2587f9) 40%, var(--p-content-border-color, #434958));
        color: var(--p-text-color, #f5f7fb);
      }
      #${DIALOG_ID} #dtd-restart:hover {
        background: var(--p-surface-700, #2c323d);
      }
      #${DIALOG_ID} #dtd-restart .icon-wrap {
        width: 22px;
        height: 22px;
        border-radius: 7px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      #${DIALOG_ID} #dtd-restart .icon-wrap i {
        font-size: 13px;
      }
      #${DIALOG_ID} .title {
        margin: 0;
        font-size: 24px;
        line-height: 1.1;
        font-weight: 650;
      }
      #${DIALOG_ID} #dtd-close-icon {
        width: 36px;
        min-width: 36px;
        height: 36px;
        padding: 0;
        border-radius: 10px;
        border: 1px solid var(--p-content-border-color, #434958);
        background: var(--p-surface-800, #232831);
        color: var(--p-text-color, #f5f7fb);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
      }
      #${DIALOG_ID} #dtd-close-icon:hover {
        background: var(--p-surface-700, #2c323d);
      }
      #${DIALOG_ID} .history-body {
        padding: 0 12px 10px;
        max-height: min(42vh, 360px);
        overflow: auto;
      }
      #${DIALOG_ID} .history-empty {
        margin: 0;
        color: var(--p-text-muted-color, #a8afbd);
        font-size: 13px;
        padding: 2px 0;
      }
      #${DIALOG_ID} .history-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      #${DIALOG_ID} .history-item {
        border: 1px solid var(--p-content-border-color, #434958);
        border-radius: 10px;
        padding: 10px;
        background: var(--p-surface-800, #232831);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #${DIALOG_ID} .history-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      #${DIALOG_ID} .history-status {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }
      #${DIALOG_ID} .history-status.success {
        color: #6de4a0;
      }
      #${DIALOG_ID} .history-status.failed {
        color: #ff8f9d;
      }
      #${DIALOG_ID} .history-status.queued,
      #${DIALOG_ID} .history-status.running {
        color: #7db9ff;
      }
      #${DIALOG_ID} .history-time {
        font-size: 12px;
        color: var(--p-text-muted-color, #a8afbd);
      }
      #${DIALOG_ID} .history-main {
        font-size: 13px;
        line-height: 1.35;
        color: var(--p-text-color, #f5f7fb);
      }
      #${DIALOG_ID} .history-sub {
        font-size: 12px;
        line-height: 1.35;
        color: var(--p-text-muted-color, #a8afbd);
        overflow-wrap: anywhere;
      }
      #${DIALOG_ID} .history-error {
        font-size: 12px;
        line-height: 1.35;
        color: #ff8f9d;
        overflow-wrap: anywhere;
      }
      #${DIALOG_ID} .history-path-input {
        margin: 0;
        width: 100%;
        height: 34px;
        border-radius: 8px;
        border: 1px solid var(--p-content-border-color, #434958);
        background: var(--p-surface-900, #1a1f27);
        color: var(--p-text-color, #f5f7fb);
        padding: 6px 10px;
        font-size: 12px;
        line-height: 1.3;
      }
      #${DIALOG_ID} .history-hf-token-input {
        margin: 0;
        width: 100%;
        height: 34px;
        border-radius: 8px;
        border: 1px solid var(--p-content-border-color, #434958);
        background: var(--p-surface-900, #1a1f27);
        color: var(--p-text-color, #f5f7fb);
        padding: 6px 10px;
        font-size: 12px;
        line-height: 1.3;
      }
      #${DIALOG_ID} .history-actions {
        display: flex;
        gap: 8px;
      }
      #${DIALOG_ID} .history-actions button {
        width: auto;
        min-width: 0;
        padding: 6px 10px;
        height: 32px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      #${DIALOG_ID} .history-actions .danger {
        border-color: color-mix(in srgb, #ff8f9d 50%, var(--p-content-border-color, #434958));
      }
      #${DIALOG_ID} .confirm-modal {
        position: fixed;
        inset: 0;
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(8, 10, 14, 0.72);
      }
      #${DIALOG_ID} .confirm-modal[hidden] {
        display: none;
      }
      #${DIALOG_ID} .confirm-card {
        width: min(420px, calc(100vw - 48px));
        border-radius: 14px;
        border: 1px solid var(--p-content-border-color, #434958);
        background: var(--p-surface-900, #141922);
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.45);
        padding: 14px;
      }
      #${DIALOG_ID} .confirm-title {
        margin: 0 0 8px 0;
        font-size: 17px;
        line-height: 1.25;
        font-weight: 700;
      }
      #${DIALOG_ID} .confirm-copy {
        margin: 0;
        font-size: 13px;
        line-height: 1.4;
        color: var(--p-text-muted-color, #a8afbd);
      }
      #${DIALOG_ID} .confirm-actions {
        margin-top: 12px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      #${DIALOG_ID} .confirm-actions button {
        width: auto;
        min-width: 96px;
        height: 36px;
        padding: 8px 12px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 600;
      }
      #${DIALOG_ID} .upload-path-copy {
        margin: 0 0 8px 0;
        font-size: 13px;
        line-height: 1.4;
        color: var(--p-text-muted-color, #a8afbd);
      }
      #${DIALOG_ID} .upload-dropzone {
        margin-top: 10px;
        border: 1px dashed color-mix(in srgb, var(--p-primary-color, #2587f9) 45%, var(--p-content-border-color, #434958));
        border-radius: 10px;
        min-height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        font-size: 13px;
        color: var(--p-text-muted-color, #a8afbd);
        background: color-mix(in srgb, var(--p-primary-color, #2587f9) 7%, var(--p-surface-900, #141922));
        text-align: center;
        cursor: pointer;
        transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
      }
      #${DIALOG_ID} .upload-dropzone:hover {
        border-color: color-mix(in srgb, var(--p-primary-color, #2587f9) 70%, var(--p-content-border-color, #434958));
        color: var(--p-text-color, #f5f7fb);
      }
      #${DIALOG_ID} .upload-dropzone.drag-active {
        border-color: var(--p-primary-color, #2587f9);
        background: color-mix(in srgb, var(--p-primary-color, #2587f9) 14%, var(--p-surface-900, #141922));
        color: var(--p-text-color, #f5f7fb);
      }
      #${DIALOG_ID} .upload-path-actions {
        margin-top: 12px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      #${DIALOG_ID} .upload-path-actions button {
        width: auto;
        min-width: 96px;
        height: 36px;
        padding: 8px 12px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 600;
      }
      #${DIALOG_ID} #dtd-confirm-confirm {
        background: var(--p-primary-color, #2587f9);
        border-color: color-mix(in srgb, var(--p-primary-color, #2587f9) 68%, #ffffff 32%);
        color: #ffffff;
      }
      #${DIALOG_ID} #dtd-confirm-confirm:hover {
        filter: brightness(1.08);
      }
    `;
    document.head.appendChild(style);
  }
  async function fetchWebChangeStamp() {
    const response = await fetch(
      `${state.apiPrefix}/download-to-dir/dev/web-change-stamp`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" }
      }
    );
    if (!response.ok) {
      throw new Error(`Hot reload probe failed: ${response.status}`);
    }
    return response.json();
  }
  function startHotReloadWatcher() {
    if (hotReloadTimer !== null) return;
    hotReloadTimer = window.setInterval(async () => {
      try {
        const payload = await fetchWebChangeStamp();
        if (!payload?.enabled) return;
        const stamp = typeof payload.stamp === "number" ? payload.stamp : Number(payload.stamp);
        if (!Number.isFinite(stamp) || stamp <= 0) return;
        if (lastHotReloadStamp === null) {
          lastHotReloadStamp = stamp;
          return;
        }
        if (stamp !== lastHotReloadStamp) {
          lastHotReloadStamp = stamp;
          window.location.reload();
        }
      } catch (_err) {
      }
    }, HOT_RELOAD_POLL_MS);
  }
  async function apiFetch(path, options) {
    const prefixes = [state.apiPrefix, "", "/api"];
    let lastError = null;
    for (const prefix of prefixes) {
      const url = `${prefix}${path}`;
      try {
        const resp = await fetch(url, options);
        if (resp.status === 404) continue;
        state.apiPrefix = prefix;
        return resp;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("Unable to reach ComfyUI API");
  }
  function setStatus(message, type = "") {
    const status = document.querySelector(`#${DIALOG_ID} .status`);
    if (!status) return;
    const normalized = String(message || "").trim().replace(/\.$/, "").toLowerCase();
    const hideStatus = normalized === "ready";
    status.hidden = hideStatus;
    status.className = `status ${type}`.trim();
    status.textContent = hideStatus ? "" : message;
  }
  function escapeHtml(value) {
    return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  function isTerminalInstallStatus(status) {
    return ["completed", "partial", "failed"].includes(
      String(status || "").toLowerCase()
    );
  }
  function clearInstallPollTimer() {
    if (state.installPollTimer != null) {
      window.clearTimeout(state.installPollTimer);
      state.installPollTimer = null;
    }
  }
  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }
  async function fetchInstallProgress(jobId) {
    const response = await apiFetch(
      `/download-to-dir/custom-node-install-progress/${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" }
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = String(data?.reason || data?.error || "").trim() || `Failed to poll install progress (${response.status})`;
      throw new Error(reason);
    }
    return data;
  }
  function applyInstallProgress(progress) {
    state.installProgress = progress && typeof progress === "object" ? progress : null;
    state.installResults = Array.isArray(progress?.results) ? progress.results : [];
    state.installBusy = !isTerminalInstallStatus(progress?.status);
  }
  async function waitForInstallJobCompletion(jobId) {
    clearInstallPollTimer();
    while (true) {
      const progress = await fetchInstallProgress(jobId);
      applyInstallProgress(progress);
      if (isTerminalInstallStatus(progress?.status)) {
        clearInstallPollTimer();
        return progress;
      }
      await sleep(700);
    }
  }
  function readSessionJson(key, fallback) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }
  function writeSessionJson(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
    }
  }
  function readSessionBoolean(key, fallback = false) {
    const value = readSessionJson(key, fallback);
    return typeof value === "boolean" ? value : fallback;
  }
  function writeSessionBoolean(key, value) {
    writeSessionJson(key, Boolean(value));
  }
  function findActionbarMountNode() {
    const actionbarContainer = document.querySelector(".actionbar-container");
    if (actionbarContainer?.parentElement) {
      return {
        parent: actionbarContainer.parentElement,
        before: actionbarContainer
      };
    }
    const content = document.querySelector(
      ".actionbar [data-pc-section='content']"
    );
    if (content) {
      const inlineRow = content.querySelector(
        ".relative.flex.items-center.gap-2.select-none"
      );
      return {
        parent: inlineRow || content,
        before: null
      };
    }
    const fallback = document.querySelector(".actionbar .p-panel-content");
    if (fallback) {
      return {
        parent: fallback,
        before: null
      };
    }
    return null;
  }
  function ensureButtonMounted() {
    const toggle = state.toggleEl || document.getElementById(BUTTON_ID);
    if (!toggle) return;
    const mountTarget = findActionbarMountNode();
    if (!mountTarget?.parent) return;
    let slot = document.getElementById("download-to-directory-inline-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.id = "download-to-directory-inline-slot";
    }
    if (slot.parentElement !== mountTarget.parent) {
      mountTarget.parent.insertBefore(slot, mountTarget.before);
    } else if (mountTarget.before && slot.nextElementSibling !== mountTarget.before) {
      mountTarget.parent.insertBefore(slot, mountTarget.before);
    }
    if (toggle.parentElement !== slot) {
      slot.appendChild(toggle);
    }
  }
  function formatApiError(status, data, fallbackMessage) {
    const raw = String(data?.reason || data?.error || "").trim();
    const msg = raw.toLowerCase();
    if (status === 405) {
      return "Upload endpoint is not available in the running backend. Restart ComfyUI to load the new upload route.";
    }
    if (status === 409) {
      return 'A file with that name already exists. Enable "Overwrite existing file" or choose a different filename/subdirectory.';
    }
    if (status === 400 && msg.includes("only http/https")) {
      return "Only HTTP/HTTPS links are supported.";
    }
    if (status === 400 && msg.includes("outside allowed comfyui roots")) {
      return "That file is outside allowed ComfyUI roots and cannot be deleted.";
    }
    if (status === 400 && msg.includes("outside custom_nodes")) {
      return "Only directories inside custom_nodes can be deleted.";
    }
    if (status === 400 && msg.includes("directory")) {
      return "Directory deletion is only supported for custom_nodes entries.";
    }
    if (msg.includes("certificate verify failed")) {
      return "Secure connection failed while validating the site certificate. Install/update certificates in your Python environment and try again.";
    }
    if (msg.includes("timed out")) {
      return "The download timed out. Please retry or try a different source.";
    }
    if (status === 404) {
      return "The file could not be found at that URL (404).";
    }
    if (status >= 500) {
      return "Server error while downloading. Check ComfyUI logs for details and try again.";
    }
    return raw || fallbackMessage || `Request failed (${status})`;
  }
  function isHuggingFaceUrl(url) {
    try {
      const parsed = new URL(String(url || "").trim());
      const host = String(parsed.hostname || "").toLowerCase();
      return host === "huggingface.co" || host === "www.huggingface.co" || host === "hf.co";
    } catch {
      return false;
    }
  }
  function formatHuggingFaceAuthMessage(rawMessage) {
    const base = String(rawMessage || "").trim() || "Hugging Face download was blocked.";
    return `${base} Add your Hugging Face token in Advanced > Hugging Face token, then retry. Create/read token at https://huggingface.co/settings/tokens and make sure you accepted access terms on the model page.`;
  }
  function maybeFormatHuggingFaceAuthError(url, message) {
    const raw = String(message || "").trim();
    const normalized = raw.toLowerCase();
    const isAuthError = normalized.includes("401") || normalized.includes("403") || normalized.includes("unauthorized") || normalized.includes("forbidden") || normalized.includes("authentication") || normalized.includes("blocked");
    if (!isAuthError || !isHuggingFaceUrl(url)) return raw;
    return formatHuggingFaceAuthMessage(raw);
  }
  function isHuggingFaceAuthError(url, message) {
    const normalized = String(message || "").toLowerCase();
    const isAuthError = normalized.includes("401") || normalized.includes("403") || normalized.includes("unauthorized") || normalized.includes("forbidden") || normalized.includes("authentication") || normalized.includes("blocked");
    return Boolean(isAuthError && isHuggingFaceUrl(url));
  }
  function getHfTokenInput() {
    const input = document.getElementById("dtd-hf-token");
    return input instanceof HTMLInputElement ? input : null;
  }
  function saveHuggingFaceTokenForSession(token) {
    const trimmed = String(token || "").trim();
    const input = getHfTokenInput();
    if (input) input.value = trimmed;
    writeSessionJson(HF_TOKEN_KEY, trimmed);
  }
  function revealHuggingFaceTokenInput() {
    const input = getHfTokenInput();
    if (!input || input.offsetParent === null) return;
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 120);
  }
  async function promptForHuggingFaceTokenIfNeeded(attempt, message) {
    if (!isHuggingFaceAuthError(attempt?.url, message)) {
      return null;
    }
    revealHuggingFaceTokenInput();
    const userToken = window.prompt(
      "Hugging Face token is required for this download.\nPaste token (hf_...) to retry now. Leave blank to cancel.",
      String(
        attempt?.huggingface_token || readSessionJson(HF_TOKEN_KEY, "") || ""
      )
    );
    const trimmedToken = String(userToken || "").trim();
    if (!trimmedToken) return null;
    saveHuggingFaceTokenForSession(trimmedToken);
    return trimmedToken;
  }
  function normalizeFolderValue(value) {
    return String(value || "").trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  }
  function readRecentFolders() {
    try {
      const raw = localStorage.getItem(RECENT_FOLDERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((entry) => normalizeFolderValue(entry)).filter((entry) => entry.length > 0).slice(0, MAX_RECENT_FOLDERS);
    } catch {
      return [];
    }
  }
  function writeRecentFolders(folders) {
    try {
      localStorage.setItem(
        RECENT_FOLDERS_KEY,
        JSON.stringify(folders.slice(0, MAX_RECENT_FOLDERS))
      );
    } catch {
    }
  }
  function saveRecentFolder(folder) {
    const normalized = normalizeFolderValue(folder);
    if (!normalized) return;
    const deduped = [
      normalized,
      ...readRecentFolders().filter((f) => f !== normalized)
    ];
    writeRecentFolders(deduped);
  }
  function readHistoryEntries() {
    const parsed = readSessionJson(HISTORY_KEY, []);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry === "object").slice(0, MAX_HISTORY_ITEMS);
  }
  function writeHistoryEntries(entries) {
    const sanitized = Array.isArray(entries) ? entries.filter((entry) => entry && typeof entry === "object") : [];
    state.historyEntries = sanitized.slice(0, MAX_HISTORY_ITEMS);
    writeSessionJson(HISTORY_KEY, state.historyEntries);
  }
  function addHistoryEntry(entry) {
    const record = {
      id: entry?.id && String(entry.id).trim() ? String(entry.id).trim() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      created_at: Number(entry?.created_at || Date.now()),
      status: (() => {
        const candidate = String(entry?.status || "failed").toLowerCase();
        return ["queued", "running", "success", "failed"].includes(candidate) ? candidate : "failed";
      })(),
      url: String(entry?.url || "").trim(),
      selected_root_value: String(entry?.selected_root_value || "").trim(),
      root_key: String(entry?.root_key || "").trim(),
      folder: String(entry?.folder || "").trim(),
      subdirectory: String(entry?.subdirectory || "").trim(),
      filename: String(entry?.filename || "").trim(),
      file_name: String(entry?.file_name || "").trim(),
      operation: (() => {
        const candidate = String(entry?.operation || "download").trim().toLowerCase();
        if (candidate === "upload") return "upload";
        if (candidate === "install") return "install";
        return "download";
      })(),
      overwrite: Boolean(entry?.overwrite),
      destination_path: String(entry?.destination_path || "").trim(),
      path: String(entry?.path || "").trim(),
      bytes_written: Number(entry?.bytes_written || 0),
      total_bytes: entry?.total_bytes == null ? null : Number(entry.total_bytes || 0),
      progress_percent: entry?.progress_percent == null ? null : Number(entry.progress_percent || 0),
      error: String(entry?.error || "").trim(),
      huggingface_token: String(entry?.huggingface_token || "").trim()
    };
    writeHistoryEntries([record, ...state.historyEntries]);
    renderHistory();
  }
  function updateHistoryEntry(entryId, patch) {
    const id = String(entryId || "").trim();
    if (!id) return;
    writeHistoryEntries(
      state.historyEntries.map((entry) => {
        if (entry.id !== id) return entry;
        return { ...entry, ...patch };
      })
    );
    renderHistory();
  }
  function removeHistoryEntry(entryId) {
    const id = String(entryId || "").trim();
    if (!id) return;
    writeHistoryEntries(
      state.historyEntries.filter((entry) => entry.id !== id)
    );
    renderHistory();
  }
  function getHistoryEntry(entryId) {
    const id = String(entryId || "").trim();
    if (!id) return null;
    return state.historyEntries.find((entry) => entry.id === id) || null;
  }
  function formatTimestamp(ms) {
    const value = Number(ms || 0);
    if (!Number.isFinite(value) || value <= 0) return "";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "";
    }
  }
  function getEntryPath(entry) {
    const explicit = String(entry?.path || "").trim();
    if (explicit) return explicit;
    if (entry?.status === "success") {
      return String(entry?.destination_path || "").trim();
    }
    return normalizeFolderValue(entry?.folder) || normalizeFolderValue(
      `${entry?.root_key || ""}${entry?.subdirectory ? `/${entry.subdirectory}` : ""}`
    );
  }
  function normalizePathForCompare(value) {
    return String(value || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  }
  function looksLikeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return false;
    if (/^git@[^:]+:.+/.test(raw)) return true;
    try {
      const parsed = new URL(raw);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }
  function isAbsolutePathLike(value) {
    const raw = String(value || "").trim();
    if (!raw) return false;
    return raw.startsWith("/") || raw.startsWith("\\\\") || /^[a-zA-Z]:[\\/]/.test(raw);
  }
  function isPathUnderCustomNodes(pathValue) {
    const candidateRaw = String(pathValue || "").trim();
    if (!candidateRaw || !isAbsolutePathLike(candidateRaw)) return false;
    const candidate = normalizePathForCompare(candidateRaw);
    const customRoots = state.roots.filter(
      (root) => /^custom_nodes(?:_\d+)?$/i.test(String(root?.key || "").trim())
    ).map((root) => normalizePathForCompare(root?.path || "")).filter(Boolean);
    if (customRoots.length > 0) {
      return customRoots.some(
        (rootPath) => candidate === rootPath || candidate.startsWith(`${rootPath}/`)
      );
    }
    return candidate.includes("/custom_nodes/");
  }
  function getCustomNodeDiskPath(entry) {
    const candidates = [
      String(entry?.destination_path || "").trim(),
      String(entry?.path || "").trim(),
      String(getEntryPath(entry) || "").trim()
    ];
    for (const candidate of candidates) {
      if (!candidate || looksLikeUrl(candidate)) continue;
      if (isPathUnderCustomNodes(candidate)) return candidate;
    }
    return "";
  }
  function getCustomNodeInstallTarget(entry) {
    const sourceCandidates = [
      String(entry?.url || "").trim(),
      String(entry?.install_target || "").trim(),
      String(entry?.source_url || "").trim(),
      String(entry?.path || "").trim(),
      String(entry?.destination_path || "").trim()
    ];
    for (const candidate of sourceCandidates) {
      if (!candidate) continue;
      if (looksLikeUrl(candidate)) return candidate;
      if (!isAbsolutePathLike(candidate) && !candidate.startsWith(".")) {
        return candidate;
      }
    }
    return "";
  }
  function canUpdateCustomNodeEntry(entry) {
    return String(entry?.status || "").toLowerCase() === "success" && Boolean(getCustomNodeDiskPath(entry)) && Boolean(getCustomNodeInstallTarget(entry));
  }
  function inferDisplayNameFromEntry(entry) {
    if (String(entry?.operation || "").toLowerCase() === "install") {
      if (entry?.file_name) return String(entry.file_name);
      const installTarget = String(
        entry?.destination_path || entry?.path || ""
      ).trim();
      if (installTarget) {
        const base = installTarget.split("/").pop() || installTarget;
        return base.toLowerCase().endsWith(".git") ? base.slice(0, -4) : base;
      }
      return "Installed custom node";
    }
    if (entry?.file_name) return String(entry.file_name);
    if (entry?.filename) return String(entry.filename);
    const destinationName = String(entry?.destination_path || "").trim().split("/").pop();
    if (destinationName) return destinationName;
    try {
      const parsed = new URL(String(entry?.url || "").trim());
      const urlName = String(parsed.pathname || "").split("/").pop();
      return urlName || "download.bin";
    } catch {
      return "download.bin";
    }
  }
  function formatEntryProgress(entry) {
    const normalizedStatus = String(entry?.status || "").toLowerCase();
    const operation = String(entry?.operation || "").toLowerCase();
    if (operation === "install") {
      if (normalizedStatus === "running") return "Installing...";
      if (normalizedStatus === "success") return "Installed";
      if (normalizedStatus === "failed") return "Install failed";
      return "";
    }
    if (normalizedStatus === "queued") return "Queued...";
    if (normalizedStatus === "running") {
      const bytesWritten = Number(entry?.bytes_written || 0);
      const totalBytes = entry?.total_bytes == null ? null : Number(entry.total_bytes);
      const percent = Number(entry?.progress_percent);
      if (Number.isFinite(totalBytes) && totalBytes > 0) {
        const pct = Number.isFinite(percent) ? percent.toFixed(1) : (bytesWritten / totalBytes * 100).toFixed(1);
        return `${formatBytes(bytesWritten)} / ${formatBytes(totalBytes)} (${pct}%)`;
      }
      return `${formatBytes(bytesWritten)} downloaded`;
    }
    if (normalizedStatus === "success" && Number(entry?.bytes_written) > 0) {
      return formatBytes(Number(entry.bytes_written));
    }
    return "";
  }
  function renderRootOptions() {
    const select = document.getElementById("dtd-root");
    if (!select) return;
    const recentFolders = readRecentFolders();
    const previousValue = select.value;
    select.innerHTML = "";
    if (recentFolders.length > 0) {
      const recentGroup = document.createElement("optgroup");
      recentGroup.label = "Recent folders";
      for (const folder of recentFolders) {
        const opt = document.createElement("option");
        opt.value = `recent:${folder}`;
        opt.textContent = folder;
        opt.title = `ComfyUI root/${folder}`;
        recentGroup.appendChild(opt);
      }
      select.appendChild(recentGroup);
      const allGroup = document.createElement("optgroup");
      allGroup.label = "All folders";
      for (const root of state.roots) {
        const opt = document.createElement("option");
        opt.value = root.key;
        opt.textContent = root.key;
        opt.title = root.path;
        allGroup.appendChild(opt);
      }
      select.appendChild(allGroup);
    } else {
      for (const root of state.roots) {
        const opt = document.createElement("option");
        opt.value = root.key;
        opt.textContent = root.key;
        opt.title = root.path;
        select.appendChild(opt);
      }
    }
    if (previousValue) {
      const hasPrevious = Array.from(select.options).some(
        (opt) => opt.value === previousValue
      );
      if (hasPrevious) select.value = previousValue;
      return;
    }
    const hasDefault = Array.from(select.options).some(
      (opt) => opt.value === DEFAULT_DOWNLOAD_ROOT
    );
    if (hasDefault) {
      select.value = DEFAULT_DOWNLOAD_ROOT;
      return;
    }
    if (select.options.length > 0) select.value = select.options[0].value;
  }
  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const exp = Math.min(
      Math.floor(Math.log(value) / Math.log(1024)),
      units.length - 1
    );
    const size = value / 1024 ** exp;
    return `${size.toFixed(exp >= 2 ? 2 : 1)} ${units[exp]}`;
  }
  function createHistoryItemElement(entry) {
    const item = document.createElement("div");
    item.className = `history-item ${entry.status}`;
    const top = document.createElement("div");
    top.className = "history-top";
    const status = document.createElement("span");
    status.className = `history-status ${entry.status}`;
    status.textContent = entry.status === "success" ? "Success" : entry.status === "failed" ? "Failed" : entry.status === "running" ? "Running" : "Queued";
    const time = document.createElement("span");
    time.className = "history-time";
    time.textContent = formatTimestamp(entry.created_at);
    top.append(status, time);
    const main = document.createElement("div");
    main.className = "history-main";
    main.textContent = inferDisplayNameFromEntry(entry);
    const sub = document.createElement("div");
    sub.className = "history-sub";
    const parts = [];
    const locationLabel = String(entry.destination_path || "").trim() || getEntryPath(entry);
    if (locationLabel) parts.push(locationLabel);
    const progressLabel = formatEntryProgress(entry);
    if (progressLabel) parts.push(progressLabel);
    sub.textContent = parts.join(" \u2022 ");
    const error = document.createElement("div");
    error.className = "history-error";
    error.hidden = !(entry.status === "failed" && entry.error);
    error.textContent = entry.status === "failed" ? String(entry.error || "") : "";
    const actions = document.createElement("div");
    actions.className = "history-actions";
    if (entry.status === "success" && entry.operation !== "install") {
      if (canUpdateCustomNodeEntry(entry)) {
        const updateBtn = document.createElement("button");
        updateBtn.type = "button";
        updateBtn.dataset.action = "update-custom-node";
        updateBtn.dataset.id = entry.id;
        updateBtn.textContent = "Update";
        actions.appendChild(updateBtn);
      }
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "danger";
      deleteBtn.dataset.action = "delete-file";
      deleteBtn.dataset.id = entry.id;
      deleteBtn.textContent = "Delete from disk";
      actions.appendChild(deleteBtn);
    } else if (entry.status === "success" && entry.operation === "install") {
      if (canUpdateCustomNodeEntry(entry)) {
        const updateBtn = document.createElement("button");
        updateBtn.type = "button";
        updateBtn.dataset.action = "update-custom-node";
        updateBtn.dataset.id = entry.id;
        updateBtn.textContent = "Update";
        actions.appendChild(updateBtn);
      }
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.dataset.action = "remove-entry";
      removeBtn.dataset.id = entry.id;
      removeBtn.textContent = "Remove";
      actions.appendChild(removeBtn);
    } else if (entry.status === "failed" && entry.operation !== "upload") {
      const pathInput = document.createElement("input");
      pathInput.type = "text";
      pathInput.className = "history-path-input";
      pathInput.dataset.action = "edit-path";
      pathInput.dataset.id = entry.id;
      pathInput.value = getEntryPath(entry);
      item.append(pathInput);
      if (isHuggingFaceAuthError(entry?.url, entry?.error)) {
        const tokenInput = document.createElement("input");
        tokenInput.type = "text";
        tokenInput.className = "history-hf-token-input";
        tokenInput.dataset.action = "edit-hf-token";
        tokenInput.dataset.id = entry.id;
        tokenInput.placeholder = "Hugging Face token (hf_...)";
        tokenInput.value = String(entry?.huggingface_token || "").trim() || String(readSessionJson(HF_TOKEN_KEY, "") || "").trim();
        item.append(tokenInput);
      }
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.dataset.action = "retry-entry";
      retryBtn.dataset.id = entry.id;
      retryBtn.textContent = "Retry";
      actions.appendChild(retryBtn);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.dataset.action = "remove-entry";
      removeBtn.dataset.id = entry.id;
      removeBtn.textContent = "Ignore";
      actions.appendChild(removeBtn);
    } else if (entry.status === "failed") {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.dataset.action = "remove-entry";
      removeBtn.dataset.id = entry.id;
      removeBtn.textContent = "Ignore";
      actions.appendChild(removeBtn);
    }
    item.append(top, main, sub, error, actions);
    return item;
  }
  function renderHistory() {
    const historyList = document.getElementById("dtd-history-list");
    const emptyEl = document.getElementById("dtd-history-empty");
    if (!historyList || !emptyEl) return;
    historyList.innerHTML = "";
    if (state.historyEntries.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    for (const entry of state.historyEntries) {
      historyList.appendChild(createHistoryItemElement(entry));
    }
  }
  function readDownloadFormValues() {
    const urlInput = document.getElementById("dtd-url");
    const rootInput = document.getElementById("dtd-root");
    const folderInput = document.getElementById("dtd-folder");
    const subdirInput = document.getElementById("dtd-subdir");
    const filenameInput = document.getElementById("dtd-filename");
    const overwriteInput = document.getElementById("dtd-overwrite");
    const hfTokenInput = document.getElementById("dtd-hf-token");
    const url = (urlInput?.value || "").trim();
    const selectedRootValue = (rootInput?.value || "").trim();
    const folder = (folderInput?.value || "").trim();
    const subdirectory = (subdirInput?.value || "").trim();
    const selectedRecentFolder = selectedRootValue.startsWith("recent:") ? selectedRootValue.slice("recent:".length) : "";
    const effectiveFolder = folder || selectedRecentFolder;
    const effectiveRootKey = selectedRootValue.startsWith("recent:") ? "" : selectedRootValue;
    return {
      url,
      selected_root_value: selectedRootValue,
      root_key: effectiveRootKey,
      folder: effectiveFolder,
      subdirectory,
      filename: (filenameInput?.value || "").trim(),
      overwrite: Boolean(overwriteInput?.checked),
      huggingface_token: (hfTokenInput?.value || "").trim()
    };
  }
  function _prefillFromHistory(entry) {
    if (!entry) return;
    const urlInput = document.getElementById("dtd-url");
    const rootInput = document.getElementById("dtd-root");
    const folderInput = document.getElementById("dtd-folder");
    const subdirInput = document.getElementById("dtd-subdir");
    const filenameInput = document.getElementById("dtd-filename");
    const overwriteInput = document.getElementById("dtd-overwrite");
    const advanced = document.getElementById("dtd-advanced");
    if (urlInput) urlInput.value = entry.url || "";
    if (folderInput)
      folderInput.value = getEntryPath(entry) || entry.folder || "";
    if (subdirInput) subdirInput.value = entry.subdirectory || "";
    if (filenameInput) filenameInput.value = entry.filename || "";
    if (overwriteInput) overwriteInput.checked = Boolean(entry.overwrite);
    if (rootInput) {
      const candidateValues = [
        entry.selected_root_value,
        entry.root_key
      ].filter((value) => Boolean(value));
      for (const candidate of candidateValues) {
        const hasOption = Array.from(rootInput.options).some(
          (opt) => opt.value === candidate
        );
        if (hasOption) {
          rootInput.value = candidate;
          break;
        }
      }
    }
    if (advanced && !advanced.open) {
      advanced.open = true;
      writeSessionBoolean(ADVANCED_OPEN_KEY, true);
    }
    setStatus(
      "Prefilled failed download. Update destination if needed, then click Download."
    );
  }
  async function deleteFileFromHistory(entry) {
    const deletePath = getEntryPath(entry);
    if (!deletePath) {
      setStatus("This history entry does not have a saved file path.", "error");
      return;
    }
    const confirmed = await requestActionConfirmation({
      title: "Delete file from disk?",
      copy: deletePath,
      confirmLabel: "Delete"
    });
    if (!confirmed) return;
    setStatus("Deleting file...");
    const resp = await apiFetch("/download-to-dir/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: deletePath })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(
        formatApiError(resp.status, data, `Delete failed (${resp.status})`)
      );
    }
    removeHistoryEntry(entry.id);
    if (data.deleted) {
      setStatus(`Deleted ${deletePath}`, "success");
    } else {
      setStatus(
        "File was already missing. Removed entry from history.",
        "success"
      );
    }
  }
  async function updateCustomNodeFromHistory(entry) {
    const customNodePath = getCustomNodeDiskPath(entry);
    const installTarget = getCustomNodeInstallTarget(entry);
    if (!customNodePath || !installTarget) {
      setStatus(
        "Update is only available for custom_nodes entries with a valid source URL.",
        "error"
      );
      return;
    }
    const confirmed = await requestActionConfirmation({
      title: "Update custom node?",
      copy: `${customNodePath}

Reinstall source: ${installTarget}`,
      confirmLabel: "Update"
    });
    if (!confirmed) return;
    updateHistoryEntry(entry.id, {
      created_at: Date.now(),
      status: "running",
      error: "",
      path: customNodePath,
      destination_path: customNodePath
    });
    setStatus(`Updating ${inferDisplayNameFromEntry(entry)}...`);
    try {
      const deleteResp = await apiFetch("/download-to-dir/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: customNodePath })
      });
      const deleteData = await deleteResp.json().catch(() => ({}));
      if (!deleteResp.ok) {
        throw new Error(
          formatApiError(
            deleteResp.status,
            deleteData,
            `Delete failed (${deleteResp.status})`
          )
        );
      }
      state.installBusy = true;
      state.installJobId = "";
      state.installResults = [];
      state.installProgress = {
        status: "queued",
        total_targets: 1,
        completed_targets: 0,
        failed_targets: 0,
        progress_percent: 0,
        current_target: installTarget,
        results: []
      };
      const installResp = await apiFetch(
        "/download-to-dir/custom-node-install",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ targets: [installTarget] })
        }
      );
      const installData = await installResp.json().catch(() => ({}));
      if (!installResp.ok || !installData?.job_id) {
        const reason = String(installData?.reason || installData?.error || "").trim() || `Failed to start update install (${installResp.status})`;
        throw new Error(reason);
      }
      state.installJobId = String(installData.job_id || "").trim();
      applyInstallProgress({
        ...state.installProgress || {},
        ...installData
      });
      const finalProgress = await waitForInstallJobCompletion(
        state.installJobId
      );
      const finalStatus = String(finalProgress?.status || "").toLowerCase();
      const failedCount = Number(finalProgress?.failed_targets || 0);
      const firstError = String(
        finalProgress?.results?.find?.((result) => !result?.ok)?.stderr || ""
      ).trim();
      if (finalStatus === "completed") {
        updateHistoryEntry(entry.id, {
          status: "success",
          error: "",
          url: installTarget,
          path: customNodePath,
          destination_path: customNodePath
        });
        setStatus(
          `Updated ${inferDisplayNameFromEntry(entry)}. Restart ComfyUI if needed.`,
          "success"
        );
      } else {
        const reason = firstError || `Update failed (${failedCount} target(s) failed).`;
        updateHistoryEntry(entry.id, {
          status: "failed",
          error: reason,
          path: customNodePath,
          destination_path: customNodePath
        });
        setStatus(reason, "error");
      }
    } catch (err) {
      const message = err?.message || String(err);
      updateHistoryEntry(entry.id, {
        status: "failed",
        error: message,
        path: customNodePath,
        destination_path: customNodePath
      });
      setStatus(message, "error");
    } finally {
      clearInstallPollTimer();
      state.installBusy = false;
    }
  }
  async function pollDownloadProgress(jobId, historyEntryId = jobId) {
    while (true) {
      const resp = await apiFetch(`/download-to-dir/progress/${jobId}`, {
        method: "GET"
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(
          formatApiError(
            resp.status,
            data,
            `Could not read download progress (${resp.status})`
          )
        );
      }
      const status = String(data.status || "").toLowerCase();
      const bytesWritten = Number(data.bytes_written || 0);
      const totalBytes = data.total_bytes == null ? null : Number(data.total_bytes);
      const percent = Number(data.progress_percent);
      if (status === "failed") {
        throw new Error(String(data.error || "Download failed."));
      }
      updateHistoryEntry(historyEntryId, {
        status,
        bytes_written: bytesWritten,
        total_bytes: totalBytes,
        progress_percent: Number.isFinite(percent) ? percent : null
      });
      if (status === "completed") {
        return data;
      }
      await sleep(350);
    }
  }
  function buildRetryAttemptFromEntry(entry) {
    const formValues = readDownloadFormValues();
    const retryPath = String(getEntryPath(entry) || "").trim();
    const entryToken = String(entry?.huggingface_token || "").trim();
    const formToken = String(formValues?.huggingface_token || "").trim();
    return {
      url: String(entry?.url || "").trim(),
      selected_root_value: "",
      root_key: "",
      folder: retryPath,
      subdirectory: "",
      filename: String(entry?.filename || entry?.file_name || "").trim(),
      overwrite: Boolean(entry?.overwrite),
      huggingface_token: entryToken || formToken
    };
  }
  async function handleDownload(options = {}) {
    const attempt = options?.attempt && typeof options.attempt === "object" ? options.attempt : readDownloadFormValues();
    const existingEntryId = String(options?.existingEntryId || "").trim();
    const historyTargetId = existingEntryId || "";
    let trackedJobId = "";
    if (!attempt.url || !attempt.root_key && !attempt.folder) {
      setStatus("URL and destination are required.", "error");
      return;
    }
    setStatus("Ready.");
    const payload = {
      url: attempt.url,
      root_key: attempt.root_key,
      folder: attempt.folder,
      subdirectory: attempt.subdirectory,
      filename: attempt.filename,
      overwrite: attempt.overwrite,
      huggingface_token: attempt.huggingface_token
    };
    try {
      const startResp = await apiFetch("/download-to-dir/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const startData = await startResp.json().catch(() => ({}));
      if (!startResp.ok) {
        const message = maybeFormatHuggingFaceAuthError(
          attempt.url,
          formatApiError(
            startResp.status,
            startData,
            `Download failed (${startResp.status})`
          )
        );
        const promptedToken = await promptForHuggingFaceTokenIfNeeded(
          attempt,
          message
        );
        if (promptedToken) {
          await handleDownload({
            attempt: {
              ...attempt,
              huggingface_token: promptedToken
            },
            existingEntryId: historyTargetId
          });
          return;
        }
        setStatus(message, "error");
        if (historyTargetId) {
          updateHistoryEntry(historyTargetId, {
            status: "failed",
            error: message
          });
        } else {
          addHistoryEntry({
            ...attempt,
            operation: "download",
            status: "failed",
            error: message
          });
        }
        return;
      }
      const jobId = String(startData.job_id || "").trim();
      if (!jobId) {
        const message = "Download did not return a tracking job id.";
        setStatus(message, "error");
        if (historyTargetId) {
          updateHistoryEntry(historyTargetId, {
            status: "failed",
            error: message
          });
        } else {
          addHistoryEntry({
            ...attempt,
            operation: "download",
            status: "failed",
            error: message
          });
        }
        return;
      }
      trackedJobId = jobId;
      const entryId = historyTargetId || jobId;
      if (!historyTargetId) {
        addHistoryEntry({
          ...attempt,
          operation: "download",
          id: entryId,
          created_at: Date.now(),
          status: "queued",
          file_name: inferDisplayNameFromEntry({
            ...attempt,
            destination_path: String(startData.destination_path || "")
          }),
          destination_path: String(startData.destination_path || ""),
          bytes_written: 0,
          total_bytes: null,
          progress_percent: 0,
          error: ""
        });
      }
      updateHistoryEntry(entryId, {
        created_at: Date.now(),
        status: "running",
        bytes_written: 0,
        total_bytes: null,
        progress_percent: 0,
        destination_path: String(startData.destination_path || ""),
        file_name: inferDisplayNameFromEntry({
          ...attempt,
          destination_path: String(startData.destination_path || "")
        }),
        error: ""
      });
      const done = await pollDownloadProgress(jobId, entryId);
      const mb = Number(done.bytes_written || 0) / (1024 * 1024);
      const recentFolder = normalizeFolderValue(attempt.folder) || normalizeFolderValue(
        `${attempt.root_key}${attempt.subdirectory ? `/${attempt.subdirectory}` : ""}`
      );
      saveRecentFolder(recentFolder);
      renderRootOptions();
      updateHistoryEntry(entryId, {
        status: "success",
        destination_path: String(done.destination_path || ""),
        bytes_written: Number(done.bytes_written || 0),
        total_bytes: done.total_bytes == null ? null : Number(done.total_bytes || 0),
        progress_percent: 100,
        error: ""
      });
      const refreshResult = await triggerNodeDefinitionsRefresh();
      const refreshSuffix = refreshResult ? " Node definitions refreshed." : " Download complete. Press R to refresh node definitions.";
      setStatus(
        `Saved to ${done.destination_path} (${mb.toFixed(2)} MB).${refreshSuffix}`,
        "success"
      );
    } catch (err) {
      const message = maybeFormatHuggingFaceAuthError(
        attempt.url,
        err?.message || String(err)
      );
      const promptedToken = await promptForHuggingFaceTokenIfNeeded(
        attempt,
        message
      );
      if (promptedToken) {
        const retryEntryId = historyTargetId || trackedJobId;
        if (retryEntryId) {
          updateHistoryEntry(retryEntryId, {
            status: "queued",
            error: "",
            bytes_written: 0,
            total_bytes: null,
            progress_percent: 0,
            huggingface_token: promptedToken
          });
        }
        await handleDownload({
          attempt: {
            ...attempt,
            huggingface_token: promptedToken
          },
          existingEntryId: retryEntryId
        });
        return;
      }
      setStatus(message, "error");
      if (trackedJobId) {
        updateHistoryEntry(historyTargetId || trackedJobId, {
          status: "failed",
          error: message
        });
      }
      if (!trackedJobId && !historyTargetId) {
        addHistoryEntry({
          ...attempt,
          operation: "download",
          status: "failed",
          error: message
        });
      }
    } finally {
    }
  }
  async function handleUpload2(files, options = {}) {
    const selectedFiles = Array.isArray(files) ? files.filter((file) => file instanceof File) : files instanceof File ? [files] : [];
    if (selectedFiles.length === 0) {
      setStatus("Choose a file to upload.", "error");
      return;
    }
    const baseAttempt = readDownloadFormValues();
    const uploadFolderOverride = options && typeof options === "object" ? String(options.uploadFolder || "").trim() : "";
    const attempt = {
      ...baseAttempt,
      folder: uploadFolderOverride || baseAttempt.folder,
      subdirectory: "",
      root_key: uploadFolderOverride ? "" : baseAttempt.root_key,
      selected_root_value: uploadFolderOverride ? "" : baseAttempt.selected_root_value
    };
    if (!attempt.root_key && !attempt.folder) {
      setStatus("Destination is required.", "error");
      return;
    }
    if (selectedFiles.length > 1 && attempt.filename) {
      setStatus(
        "Filename override is only supported for single-file upload. Clear Filename or upload one file.",
        "error"
      );
      return;
    }
    const singleFileMode = selectedFiles.length === 1;
    const totalFiles = selectedFiles.length;
    let successCount = 0;
    let failCount = 0;
    let lastSuccessPath = "";
    let lastSuccessBytes = 0;
    for (let index = 0; index < totalFiles; index += 1) {
      const selectedFile = selectedFiles[index];
      const entryId = `upload-${Date.now()}-${index}`;
      addHistoryEntry({
        ...attempt,
        id: entryId,
        created_at: Date.now(),
        operation: "upload",
        status: "running",
        file_name: selectedFile.name,
        destination_path: "",
        bytes_written: 0,
        total_bytes: Number(selectedFile.size || 0),
        progress_percent: 0,
        error: ""
      });
      const payload = new FormData();
      payload.append("file", selectedFile);
      payload.append("root_key", attempt.root_key || "");
      payload.append("folder", attempt.folder || "");
      payload.append("subdirectory", attempt.subdirectory || "");
      payload.append("filename", singleFileMode ? attempt.filename || "" : "");
      payload.append("overwrite", attempt.overwrite ? "true" : "false");
      const remainingAfterCurrent = totalFiles - (index + 1);
      setStatus(
        `Uploading ${index + 1}/${totalFiles}: ${selectedFile.name} (${remainingAfterCurrent} remaining after this)`
      );
      const resp = await apiFetch("/download-to-dir/upload", {
        method: "POST",
        body: payload
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const message = formatApiError(
          resp.status,
          data,
          `Upload failed (${resp.status})`
        );
        updateHistoryEntry(entryId, {
          status: "failed",
          error: message
        });
        failCount += 1;
        const processed2 = successCount + failCount;
        const remaining2 = totalFiles - processed2;
        if (remaining2 > 0) {
          setStatus(
            `Uploaded ${processed2}/${totalFiles}. ${remaining2} remaining...`
          );
        }
        continue;
      }
      const writtenBytes = Number(data.bytes_written || selectedFile.size || 0);
      const destinationPath = String(data.destination_path || "").trim();
      updateHistoryEntry(entryId, {
        status: "success",
        destination_path: destinationPath,
        path: destinationPath,
        bytes_written: writtenBytes,
        total_bytes: writtenBytes,
        progress_percent: 100,
        error: ""
      });
      successCount += 1;
      lastSuccessPath = destinationPath;
      lastSuccessBytes = writtenBytes;
      const processed = successCount + failCount;
      const remaining = totalFiles - processed;
      if (remaining > 0) {
        setStatus(
          `Uploaded ${processed}/${totalFiles}. ${remaining} remaining...`
        );
      }
    }
    const recentFolder = normalizeFolderValue(attempt.folder) || normalizeFolderValue(
      `${attempt.root_key}${attempt.subdirectory ? `/${attempt.subdirectory}` : ""}`
    );
    saveRecentFolder(recentFolder);
    renderRootOptions();
    let refreshSuffix = "";
    if (successCount > 0) {
      const refreshResult = await triggerNodeDefinitionsRefresh();
      refreshSuffix = refreshResult ? " Node definitions refreshed." : " Upload complete. Press R to refresh node definitions.";
    }
    if (successCount === 1 && failCount === 0 && singleFileMode) {
      setStatus(
        `Saved to ${lastSuccessPath} (${formatBytes(lastSuccessBytes)}).${refreshSuffix}`,
        "success"
      );
      return;
    }
    if (failCount === 0) {
      setStatus(
        `Uploaded ${successCount} files successfully.${refreshSuffix}`,
        "success"
      );
      return;
    }
    if (successCount === 0) {
      setStatus(`Upload failed for all ${failCount} files.`, "error");
      return;
    }
    setStatus(
      `Uploaded ${successCount}/${selectedFiles.length} files. ${failCount} failed.${refreshSuffix}`,
      "error"
    );
  }
  async function handleExport(pathValue) {
    const exportPath = String(pathValue || "").trim();
    if (!exportPath) {
      setStatus("Export path is required.", "error");
      return;
    }
    setStatus("Preparing export zip...");
    const startResp = await apiFetch("/download-to-dir/export/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: exportPath })
    });
    if (!startResp.ok) {
      let data = null;
      try {
        data = await startResp.json();
      } catch {
        data = null;
      }
      const message = formatApiError(
        startResp.status,
        data,
        `Export failed (${startResp.status})`
      );
      setStatus(message, "error");
      return;
    }
    const startData = await startResp.json().catch(() => ({}));
    const exportJobId = String(startData.job_id || "").trim();
    if (!exportJobId) {
      setStatus("Export failed: missing export job id.", "error");
      return;
    }
    while (true) {
      const progressResp = await apiFetch(
        `/download-to-dir/export/progress/${encodeURIComponent(exportJobId)}`,
        { method: "GET" }
      );
      const progressData = await progressResp.json().catch(() => ({}));
      if (!progressResp.ok) {
        const message = formatApiError(
          progressResp.status,
          progressData,
          `Could not read export progress (${progressResp.status})`
        );
        setStatus(message, "error");
        return;
      }
      const statusValue = String(progressData.status || "").toLowerCase();
      const completed = Number(progressData.completed_files || 0);
      const total = Number(progressData.total_files || 0);
      const current = String(progressData.current_file || "").trim();
      if (statusValue === "completed") break;
      if (statusValue === "failed") {
        const reason = String(progressData.error || "").trim() || "Export failed.";
        setStatus(reason, "error");
        return;
      }
      if (total > 0) {
        setStatus(
          `Preparing export zip... ${completed}/${total}${current ? ` | ${current}` : ""}`
        );
      } else {
        setStatus("Preparing export zip...");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    const resp = await apiFetch(
      `/download-to-dir/export/download/${encodeURIComponent(exportJobId)}`,
      {
        method: "GET"
      }
    );
    if (!resp.ok) {
      let data = null;
      try {
        data = await resp.json();
      } catch {
        data = null;
      }
      const message = formatApiError(
        resp.status,
        data,
        `Export download failed (${resp.status})`
      );
      setStatus(message, "error");
      return;
    }
    const blob = await resp.blob();
    const disposition = String(resp.headers.get("content-disposition") || "");
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = String(filenameMatch?.[1] || "").trim() || "export.zip";
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
    setStatus(`Exported ${filename}`, "success");
  }
  async function callRestartEndpoint() {
    const routes = [
      "/download-to-dir/restart",
      "/api/download-to-dir/restart",
      "/manager/reboot",
      "/api/manager/reboot"
    ];
    let lastError = null;
    let lastResponse = null;
    for (const route of routes) {
      try {
        const resp = await fetch(route, { method: "GET" });
        if (resp.status === 404) {
          lastResponse = resp;
          continue;
        }
        return resp;
      } catch (err) {
        lastError = err;
      }
    }
    if (lastError) throw lastError;
    return lastResponse;
  }
  function closeConfirmModal(confirmed) {
    const modal = document.getElementById("dtd-confirm-modal");
    if (modal) modal.hidden = true;
    if (restartConfirmResolver) {
      restartConfirmResolver(Boolean(confirmed));
      restartConfirmResolver = null;
    }
  }
  function closeUploadPathModal(pathValue) {
    const modal = document.getElementById("dtd-upload-path-modal");
    if (modal) modal.hidden = true;
    if (!uploadPathResolver) return;
    const resolver = uploadPathResolver;
    uploadPathResolver = null;
    resolver(pathValue);
  }
  function dismissUploadPathModal() {
    const modal = document.getElementById("dtd-upload-path-modal");
    if (modal) modal.hidden = true;
    uploadPathResolver = null;
  }
  function closeExportPathModal(pathValue) {
    const modal = document.getElementById("dtd-export-path-modal");
    if (modal) modal.hidden = true;
    if (!exportPathResolver) return;
    const resolver = exportPathResolver;
    exportPathResolver = null;
    resolver(pathValue);
  }
  function requestUploadPath() {
    const modal = document.getElementById("dtd-upload-path-modal");
    const input = document.getElementById("dtd-upload-path-input");
    if (!modal || !(input instanceof HTMLInputElement)) {
      return Promise.resolve(null);
    }
    if (uploadPathResolver) closeUploadPathModal(null);
    input.value = String(state.uploadFolder || "output").trim();
    modal.hidden = false;
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
    return new Promise((resolve) => {
      uploadPathResolver = resolve;
    });
  }
  function requestExportPath() {
    const modal = document.getElementById("dtd-export-path-modal");
    const input = document.getElementById("dtd-export-path-input");
    if (!modal || !(input instanceof HTMLInputElement)) {
      return Promise.resolve(null);
    }
    if (exportPathResolver) closeExportPathModal(null);
    input.value = String(input.value || "").trim();
    modal.hidden = false;
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
    return new Promise((resolve) => {
      exportPathResolver = resolve;
    });
  }
  function requestActionConfirmation({
    title = "Are you sure?",
    copy = "",
    confirmLabel = "Confirm"
  } = {}) {
    const modal = document.getElementById("dtd-confirm-modal");
    if (!modal) {
      return Promise.resolve(window.confirm(`${title}

${copy}`.trim()));
    }
    const titleEl = document.getElementById("dtd-confirm-title");
    const copyEl = document.getElementById("dtd-confirm-copy");
    const confirmEl = document.getElementById("dtd-confirm-confirm");
    if (titleEl)
      titleEl.textContent = String(title || "").trim() || "Are you sure?";
    if (copyEl) copyEl.textContent = String(copy || "").trim();
    if (confirmEl) {
      confirmEl.textContent = String(confirmLabel || "").trim() || "Confirm";
    }
    if (restartConfirmResolver) {
      restartConfirmResolver(false);
      restartConfirmResolver = null;
    }
    modal.hidden = false;
    return new Promise((resolve) => {
      restartConfirmResolver = resolve;
    });
  }
  async function handleRestart(options = {}) {
    const requireConfirm = options?.confirm !== false;
    if (requireConfirm) {
      const confirmed = await requestActionConfirmation({
        title: "Restart ComfyUI?",
        copy: "Running tasks may be interrupted. Continue?",
        confirmLabel: "Restart"
      });
      if (!confirmed) return;
    }
    setStatus("Restarting ComfyUI...");
    try {
      const response = await callRestartEndpoint();
      if (!response || response.status === 404) {
        setStatus("Restart endpoint is unavailable.", "error");
        return;
      }
      if (response.status === 403) {
        setStatus(
          "Restart was blocked by ComfyUI-Manager security settings.",
          "error"
        );
        return;
      }
      if (!response.ok) {
        setStatus(`Restart failed (${response.status}).`, "error");
        return;
      }
      setStatus("Restart requested. Waiting for reconnect...", "success");
      const apiObj = window.api;
      let finished = false;
      const finish = async (message) => {
        if (finished) return;
        finished = true;
        let suffix = "";
        try {
          const refreshed = await triggerNodeDefinitionsRefresh();
          suffix = refreshed ? " Node definitions refreshed." : "";
        } catch {
        }
        setStatus(`${message}${suffix}`.trim(), "success");
        window.setTimeout(() => {
          setStatus("Ready.");
        }, 4e3);
      };
      if (apiObj?.addEventListener) {
        const onReconnected = () => {
          finish("Restart complete. Reconnected to ComfyUI.");
        };
        apiObj.addEventListener("reconnected", onReconnected);
        window.setTimeout(() => {
          finish(
            "Restart complete. If the UI did not refresh yet, wait a moment or refresh the page."
          );
        }, 7e3);
      } else {
        window.setTimeout(() => {
          finish(
            "Restart complete. If the UI did not refresh yet, wait a moment or refresh the page."
          );
        }, 2500);
      }
    } catch (err) {
      setStatus(err?.message || String(err), "error");
    }
  }
  function retryHistoryEntry(entry) {
    if (!entry) return;
    const retryAttempt = buildRetryAttemptFromEntry(entry);
    if (!retryAttempt.url || !retryAttempt.folder) {
      setStatus("Retry requires a URL and destination path.", "error");
      return;
    }
    updateHistoryEntry(entry.id, {
      created_at: Date.now(),
      status: "queued",
      bytes_written: 0,
      total_bytes: null,
      progress_percent: 0,
      error: ""
    });
    handleDownload({
      attempt: retryAttempt,
      existingEntryId: entry.id
    }).catch((err) => setStatus(err?.message || String(err), "error"));
  }
  async function loadRoots() {
    const select = document.getElementById("dtd-root");
    if (!select) return;
    setStatus("Loading destinations...");
    const resp = await apiFetch("/download-to-dir/roots", { method: "GET" });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(
        formatApiError(
          resp.status,
          data,
          `Could not load destination folders (${resp.status})`
        )
      );
    }
    state.roots = Array.isArray(data.roots) ? data.roots : [];
    renderRootOptions();
    if (select.options.length === 0) {
      setStatus("No writable roots available", "error");
    } else {
      setStatus("Ready.");
    }
  }
  async function triggerNodeDefinitionsRefresh() {
    const commandId = "Comfy.RefreshNodeDefinitions";
    const appObj = window.app;
    const attempts = [
      () => appObj?.extensionManager?.command?.execute?.(commandId),
      () => appObj?.extensionManager?.commands?.execute?.(commandId),
      () => appObj?.commands?.execute?.(commandId),
      () => appObj?.refreshComboInNodes?.()
    ];
    for (const run of attempts) {
      try {
        const result = run();
        if (result && typeof result.then === "function") {
          await result;
        }
        if (result !== void 0 || run === attempts[attempts.length - 1]) {
          return true;
        }
      } catch {
      }
    }
    try {
      const event = new KeyboardEvent("keydown", {
        key: "r",
        code: "KeyR",
        bubbles: true,
        cancelable: true
      });
      const accepted = document.dispatchEvent(event) || window.dispatchEvent(event);
      return Boolean(accepted);
    } catch {
      return false;
    }
  }
  function closeDialogAnimated(dialog) {
    if (!dialog?.open || dialog.classList.contains("dtd-closing")) return;
    dialog.classList.add("dtd-closing");
    const onAnimEnd = (event) => {
      if (event.target !== dialog || event.animationName !== "dtd-dialog-out") {
        return;
      }
      dialog.removeEventListener("animationend", onAnimEnd);
      dialog.classList.remove("dtd-closing");
      dialog.close();
    };
    dialog.addEventListener("animationend", onAnimEnd);
  }
  function renderUi() {
    ensureStyles5();
    writeHistoryEntries(readHistoryEntries());
    if (!state.toggleEl) {
      const toggle2 = document.createElement("button");
      toggle2.id = BUTTON_ID;
      toggle2.type = "button";
      toggle2.innerHTML = '<i class="icon-[lucide--download]"></i><span>Downloader</span>';
      state.toggleEl = toggle2;
    }
    const toggle = state.toggleEl;
    if (!state.dialogEl) {
      const dialog2 = document.createElement("dialog");
      dialog2.id = DIALOG_ID;
      dialog2.innerHTML = `
      <div class="body row">
        <div class="title-band bleed">
          <h2 class="title">Downloader</h2>
          <button id="dtd-close-icon" type="button" aria-label="Close dialog">&times;</button>
        </div>
        <div class="divider bleed"></div>
        <div class="form-section">
          <div class="field">
            <label>File URL</label>
            <p class="hint">Tip: Git repo links (.git, GitHub repo pages, Hugging Face repo/tree links) are cloned automatically when destination is custom_nodes.</p>
            <input id="dtd-url" type="text" placeholder="https://example.com/file.bin" />
          </div>

          <div class="field">
            <label>Destination</label>
            <select id="dtd-root"></select>
          </div>

          <div class="field">
            <details id="dtd-advanced" class="section advanced">
              <summary>Advanced</summary>
              <div class="advanced-body">
                <div class="field">
                  <label>Folder (optional, from ComfyUI root)</label>
                  <input id="dtd-folder" type="text" placeholder="models/checkpoints or any/relative/path" />
                </div>

                <div class="field">
                  <label>Subdirectory (optional)</label>
                  <input id="dtd-subdir" type="text" placeholder="my/models" />
                </div>

                <div class="field">
                  <label>Filename (optional)</label>
                  <input id="dtd-filename" type="text" placeholder="auto from URL if empty" />
                </div>

                <div class="field">
                  <label>Hugging Face token (optional)</label>
                  <input id="dtd-hf-token" type="password" placeholder="hf_... (for gated/private Hugging Face downloads)" autocomplete="off" />
                  <p class="hint">Only needed for gated/private Hugging Face files.</p>
                </div>

                <div class="field">
                  <label class="inline">
                    <input id="dtd-overwrite" type="checkbox" />
                    Overwrite existing file
                  </label>
                </div>
              </div>
            </details>
          </div>

          <div class="field">
            <details class="section history" open>
              <summary>Downloads</summary>
              <div class="history-body">
                <p id="dtd-history-empty" class="history-empty">No downloads yet.</p>
                <div id="dtd-history-list" class="history-list"></div>
              </div>
            </details>
          </div>
        </div>

        <div class="divider bleed"></div>
        <div class="cta-band bleed">
          <div class="actions">
            <button id="dtd-submit" type="button">Download</button>
            <button id="dtd-export" type="button">Export</button>
            <button id="dtd-upload" type="button">Upload</button>
            <button id="dtd-restart" type="button">
              <span class="icon-wrap"><i class="icon-[lucide--refresh-cw]"></i></span>
            </button>
          </div>
          <input id="dtd-file" type="file" multiple hidden />
        </div>
        <div class="field">
          <div class="status"></div>
        </div>
        <div id="dtd-confirm-modal" class="confirm-modal" hidden>
          <div class="confirm-card">
            <h3 id="dtd-confirm-title" class="confirm-title">Restart ComfyUI?</h3>
            <p id="dtd-confirm-copy" class="confirm-copy">Running tasks may be interrupted. Continue?</p>
            <div class="confirm-actions">
              <button id="dtd-confirm-cancel" type="button">Cancel</button>
              <button id="dtd-confirm-confirm" type="button">Restart</button>
            </div>
          </div>
        </div>
        <div id="dtd-upload-path-modal" class="confirm-modal" hidden>
          <div class="confirm-card">
            <h3 class="confirm-title">Upload Output Path</h3>
            <p class="upload-path-copy">Choose where uploaded images should be saved (relative to ComfyUI root).</p>
            <input id="dtd-upload-path-input" type="text" placeholder="output or output/my-images" />
            <div id="dtd-upload-dropzone" class="upload-dropzone" role="button" tabindex="0">Click or drop files here to upload</div>
            <div class="upload-path-actions">
              <button id="dtd-upload-path-cancel" type="button">Cancel</button>
            </div>
          </div>
        </div>
        <div id="dtd-export-path-modal" class="confirm-modal" hidden>
          <div class="confirm-card">
            <h3 class="confirm-title">Export Path</h3>
            <p class="upload-path-copy">Enter a file or folder path. It will be zipped and downloaded.</p>
            <input id="dtd-export-path-input" type="text" placeholder="/absolute/path/to/folder-or-file" />
            <div class="upload-path-actions">
              <button id="dtd-export-path-cancel" type="button">Cancel</button>
              <button id="dtd-export-path-confirm" type="button">Export</button>
            </div>
          </div>
        </div>
      </div>
    `;
      document.body.appendChild(dialog2);
      state.dialogEl = dialog2;
    }
    const dialog = state.dialogEl;
    toggle.addEventListener("click", () => {
      if (!dialog.open) {
        dialog.classList.remove("dtd-closing");
        dialog.showModal();
      }
      if (state.roots.length === 0) {
        loadRoots().catch(
          (err) => setStatus(err.message || String(err), "error")
        );
      }
    });
    ensureButtonMounted();
    const advanced = document.getElementById("dtd-advanced");
    if (advanced instanceof HTMLDetailsElement) {
      advanced.open = readSessionBoolean(ADVANCED_OPEN_KEY, false);
      advanced.addEventListener("toggle", () => {
        writeSessionBoolean(ADVANCED_OPEN_KEY, advanced.open);
      });
    }
    const hfTokenInput = document.getElementById("dtd-hf-token");
    if (hfTokenInput instanceof HTMLInputElement) {
      const savedToken = String(readSessionJson(HF_TOKEN_KEY, "") || "");
      hfTokenInput.value = savedToken;
      hfTokenInput.addEventListener("input", () => {
        writeSessionJson(HF_TOKEN_KEY, String(hfTokenInput.value || "").trim());
      });
    }
    renderHistory();
    const rootSelect = document.getElementById("dtd-root");
    const folderInput = document.getElementById("dtd-folder");
    if (rootSelect && folderInput) {
      rootSelect.addEventListener("change", () => {
        const selected = rootSelect.value || "";
        if (selected.startsWith("recent:")) {
          folderInput.value = selected.slice("recent:".length);
        }
      });
    }
    const historyList = document.getElementById("dtd-history-list");
    if (historyList) {
      historyList.addEventListener("input", (event) => {
        const pathInput = event.target instanceof Element ? event.target.closest('input[data-action="edit-path"][data-id]') : null;
        if (pathInput instanceof HTMLInputElement) {
          const entryId2 = pathInput.dataset.id || "";
          const updatedPath = String(pathInput.value || "").trim();
          writeHistoryEntries(
            state.historyEntries.map((entry) => {
              if (entry.id !== entryId2) return entry;
              return { ...entry, path: updatedPath };
            })
          );
          return;
        }
        const tokenInput = event.target instanceof Element ? event.target.closest('input[data-action="edit-hf-token"][data-id]') : null;
        if (!(tokenInput instanceof HTMLInputElement)) return;
        const entryId = tokenInput.dataset.id || "";
        const updatedToken = String(tokenInput.value || "").trim();
        writeHistoryEntries(
          state.historyEntries.map((entry) => {
            if (entry.id !== entryId) return entry;
            return { ...entry, huggingface_token: updatedToken };
          })
        );
        saveHuggingFaceTokenForSession(updatedToken);
      });
      historyList.addEventListener("click", (event) => {
        const button = event.target instanceof Element ? event.target.closest("button[data-action][data-id]") : null;
        if (!button) return;
        const action = button.getAttribute("data-action") || "";
        const entryId = button.getAttribute("data-id") || "";
        const entry = getHistoryEntry(entryId);
        if (!entry) return;
        if (action === "remove-entry") {
          removeHistoryEntry(entryId);
          return;
        }
        if (action === "retry-entry") {
          retryHistoryEntry(entry);
          return;
        }
        if (action === "delete-file") {
          deleteFileFromHistory(entry).catch((err) => {
            setStatus(err.message || String(err), "error");
          });
          return;
        }
        if (action === "update-custom-node") {
          updateCustomNodeFromHistory(entry).catch((err) => {
            setStatus(err.message || String(err), "error");
          });
        }
      });
    }
    const submit = document.getElementById("dtd-submit");
    if (submit) {
      submit.addEventListener("click", () => {
        handleDownload().catch(
          (err) => setStatus(err.message || String(err), "error")
        );
      });
    }
    const upload = document.getElementById("dtd-upload");
    const exportBtn = document.getElementById("dtd-export");
    const fileInput = document.getElementById("dtd-file");
    if (upload && fileInput instanceof HTMLInputElement) {
      upload.addEventListener("click", async () => {
        const chosenPath = await requestUploadPath();
        if (chosenPath == null) return;
        const normalizedPath = String(chosenPath || "").trim();
        state.uploadFolder = normalizedPath || "output";
        fileInput.click();
      });
      fileInput.addEventListener("change", () => {
        const files = Array.from(fileInput.files || []);
        fileInput.value = "";
        if (files.length === 0) return;
        handleUpload2(files, { uploadFolder: state.uploadFolder }).catch(
          (err) => setStatus(err.message || String(err), "error")
        );
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener("click", async () => {
        const chosenPath = await requestExportPath();
        if (chosenPath == null) return;
        handleExport(chosenPath).catch(
          (err) => setStatus(err.message || String(err), "error")
        );
      });
    }
    const restart = document.getElementById("dtd-restart");
    if (restart) {
      restart.addEventListener("click", () => {
        handleRestart().catch(
          (err) => setStatus(err.message || String(err), "error")
        );
      });
    }
    const confirmModal = document.getElementById("dtd-confirm-modal");
    const confirmCancel = document.getElementById("dtd-confirm-cancel");
    const confirmConfirm = document.getElementById("dtd-confirm-confirm");
    if (confirmModal) {
      confirmModal.addEventListener("click", (event) => {
        if (event.target === confirmModal) closeConfirmModal(false);
      });
      confirmModal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeConfirmModal(false);
        }
      });
    }
    if (confirmCancel) {
      confirmCancel.addEventListener("click", () => closeConfirmModal(false));
    }
    if (confirmConfirm) {
      confirmConfirm.addEventListener("click", () => closeConfirmModal(true));
    }
    const uploadPathModal = document.getElementById("dtd-upload-path-modal");
    const uploadPathInput = document.getElementById("dtd-upload-path-input");
    const uploadPathCancel = document.getElementById("dtd-upload-path-cancel");
    const uploadDropzone = document.getElementById("dtd-upload-dropzone");
    if (uploadPathModal) {
      const consumeModalDragEvent = (event) => {
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        const isInDropzone = path.includes(uploadDropzone);
        if (isInDropzone) return;
        event.preventDefault();
        event.stopPropagation();
      };
      for (const eventName of ["dragenter", "dragover", "drop"]) {
        uploadPathModal.addEventListener(
          eventName,
          consumeModalDragEvent,
          true
        );
      }
      uploadPathModal.addEventListener("click", (event) => {
        if (event.target === uploadPathModal) closeUploadPathModal(null);
      });
      uploadPathModal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeUploadPathModal(null);
          return;
        }
        if (event.key === "Enter") {
          const currentValue = String(uploadPathInput?.value || "").trim();
          closeUploadPathModal(currentValue);
        }
      });
    }
    if (uploadPathCancel) {
      uploadPathCancel.addEventListener(
        "click",
        () => closeUploadPathModal(null)
      );
    }
    if (uploadDropzone) {
      const consumeDragEvent = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      const uploadDroppedFiles = (files) => {
        const selectedFiles = Array.from(files || []);
        if (selectedFiles.length === 0) return;
        const currentValue = String(uploadPathInput?.value || "").trim();
        state.uploadFolder = currentValue || "output";
        dismissUploadPathModal();
        handleUpload2(selectedFiles, { uploadFolder: state.uploadFolder }).catch(
          (err) => setStatus(err.message || String(err), "error")
        );
      };
      uploadDropzone.addEventListener("click", () => {
        const currentValue = String(uploadPathInput?.value || "").trim();
        closeUploadPathModal(currentValue);
      });
      uploadDropzone.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const currentValue = String(uploadPathInput?.value || "").trim();
          closeUploadPathModal(currentValue);
        }
      });
      for (const eventName of ["dragenter", "dragover"]) {
        uploadDropzone.addEventListener(eventName, consumeDragEvent, true);
      }
      uploadDropzone.addEventListener(
        "drop",
        (event) => {
          consumeDragEvent(event);
          uploadDropzone.classList.remove("drag-active");
          uploadDroppedFiles(event.dataTransfer?.files || []);
        },
        true
      );
      uploadDropzone.addEventListener("dragenter", (event) => {
        consumeDragEvent(event);
        uploadDropzone.classList.add("drag-active");
      });
      uploadDropzone.addEventListener("dragover", (event) => {
        consumeDragEvent(event);
        uploadDropzone.classList.add("drag-active");
      });
      uploadDropzone.addEventListener("dragleave", (event) => {
        event.stopPropagation();
        if (!uploadDropzone.contains(event.relatedTarget)) {
          uploadDropzone.classList.remove("drag-active");
        }
      });
    }
    const exportPathModal = document.getElementById("dtd-export-path-modal");
    const exportPathInput = document.getElementById("dtd-export-path-input");
    const exportPathCancel = document.getElementById("dtd-export-path-cancel");
    const exportPathConfirm = document.getElementById(
      "dtd-export-path-confirm"
    );
    if (exportPathModal) {
      exportPathModal.addEventListener("click", (event) => {
        if (event.target === exportPathModal) closeExportPathModal(null);
      });
      exportPathModal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeExportPathModal(null);
          return;
        }
        if (event.key === "Enter") {
          const currentValue = String(exportPathInput?.value || "").trim();
          closeExportPathModal(currentValue);
        }
      });
    }
    if (exportPathCancel) {
      exportPathCancel.addEventListener(
        "click",
        () => closeExportPathModal(null)
      );
    }
    if (exportPathConfirm) {
      exportPathConfirm.addEventListener("click", () => {
        const currentValue = String(exportPathInput?.value || "").trim();
        closeExportPathModal(currentValue);
      });
    }
    const close = document.getElementById("dtd-close-icon");
    if (close) {
      close.addEventListener("click", () => closeDialogAnimated(dialog));
    }
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        closeConfirmModal(false);
        closeDialogAnimated(dialog);
      }
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeConfirmModal(false);
      closeDialogAnimated(dialog);
    });
    const observer = new MutationObserver(() => ensureButtonMounted());
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function init() {
    if (!document.body) {
      setTimeout(init, 150);
      return;
    }
    renderUi();
    startHotReloadWatcher();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

// web-src/group_bypasser.ts
import { app } from "../../scripts/app.js";
var NODE_NAME = "ComfyUI-Group-Bypasser";
var NODE_DISPLAY_NAME = "Group Bypasser";
var MODE_ACTIVE = LiteGraph.ALWAYS;
var MODE_BYPASS = 4;
var STATE_KEY = "group_bypasser_states";
var REFRESH_MS = 400;
var ALPHABETICAL_COLLATOR = new Intl.Collator(void 0, {
  sensitivity: "base",
  numeric: true
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
    node?.constructor?.title
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
  const seen = /* @__PURE__ */ new Set();
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
  }
  const fromChildren = Array.from(group?._children || []).filter(
    (node) => typeof node?.id === "number"
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
    return centerX >= gx && centerX < gx + gw && centerY >= gy && centerY < gy + gh;
  });
}
function collectGroupsByTitle(node) {
  const rootGraph = getCurrentGraph(node);
  if (!rootGraph) {
    return [];
  }
  const deduped = /* @__PURE__ */ new Map();
  for (const graph of collectNestedGraphs(rootGraph)) {
    const sourceGroups = Array.isArray(graph._groups) ? graph._groups : Array.isArray(graph.groups) ? graph.groups : [];
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
          groups: []
        });
      }
      deduped.get(key).groups.push({ group, graph });
    }
  }
  return Array.from(deduped.values()).sort(
    (a, b) => ALPHABETICAL_COLLATOR.compare(a.title, b.title) || a.key.localeCompare(b.key)
  );
}
function ensureStateStore(node) {
  if (!node.properties || typeof node.properties !== "object") {
    node.properties = {};
  }
  if (!node.properties[STATE_KEY] || typeof node.properties[STATE_KEY] !== "object") {
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
  const seenNodeIds = /* @__PURE__ */ new WeakMap();
  const mode = bypassed ? MODE_BYPASS : MODE_ACTIVE;
  for (const { group, graph } of groupEntry.groups) {
    if (!group || !graph) {
      continue;
    }
    let graphSeenIds = seenNodeIds.get(graph);
    if (!graphSeenIds) {
      graphSeenIds = /* @__PURE__ */ new Set();
      seenNodeIds.set(graph, graphSeenIds);
    }
    for (const targetNode of getGroupNodes(group, graph)) {
      if (!(targetNode && Number.isInteger(targetNode.id) && targetNode.id >= 0)) {
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
  const seenNodeIds = /* @__PURE__ */ new WeakMap();
  let allBypassed = true;
  let anyFound = false;
  for (const { group, graph } of groupEntry.groups) {
    if (!group || !graph) {
      continue;
    }
    let graphSeenIds = seenNodeIds.get(graph);
    if (!graphSeenIds) {
      graphSeenIds = /* @__PURE__ */ new Set();
      seenNodeIds.set(graph, graphSeenIds);
    }
    for (const targetNode of getGroupNodes(group, graph)) {
      if (!(targetNode && Number.isInteger(targetNode.id) && targetNode.id >= 0)) {
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
    const targetBypassed = hasSavedState ? Boolean(stateStore[entry.key]) : actualBypassed;
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
    const isBypassed = hasStoredState(stateStore, entry.key) ? Boolean(stateStore[entry.key]) : actualBypassed;
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
  node.onRemoved = function(...args) {
    if (this.__groupBypasserRefreshTimer) {
      clearInterval(this.__groupBypasserRefreshTimer);
      this.__groupBypasserRefreshTimer = null;
    }
    return originalOnRemoved?.apply(this, args);
  };
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
    nodeType.prototype.onNodeCreated = function(...args) {
      const result = originalOnNodeCreated?.apply(this, args);
      bindNode(this);
      queueRefresh(this, true);
      setTimeout(() => queueRefresh(this, true), 80);
      setTimeout(() => queueRefresh(this, true), 250);
      return result;
    };
    nodeType.prototype.onConfigure = function(...args) {
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
  }
});

// web-src/features_avatary.ts
import { app as app2 } from "../../scripts/app.js";

// web-src/components/textfield.ts
var COMFY_TEXT_INPUT_EVENTS = [
  "keydown",
  "keyup",
  "keypress",
  "beforeinput",
  "input",
  "pointerdown",
  "mousedown",
  "mouseup",
  "click",
  "dblclick",
  "touchstart",
  "wheel"
];
function captureTextInputEvents(element) {
  const stop = (event) => event.stopPropagation();
  for (const eventName of COMFY_TEXT_INPUT_EVENTS) {
    element.addEventListener(eventName, stop);
  }
}
function createTextfield({
  value = "",
  placeholder = "",
  disabled = false,
  title = "",
  className = "",
  captureEvents = true,
  onInput,
  onChange
}) {
  const input = document.createElement("input");
  input.type = "text";
  const comfyClasses = [
    // Mirrors ComfyUI_frontend widget input conventions.
    "w-full",
    "min-w-0",
    "h-7",
    "rounded-lg",
    "border-none",
    "bg-component-node-widget-background",
    "text-component-node-foreground",
    "px-4",
    "text-xs",
    "outline-none",
    "transition-colors",
    "hover:bg-component-node-widget-background-hovered",
    "focus:bg-component-node-widget-background-hovered"
  ].join(" ");
  input.className = `${comfyClasses} ${className}`.trim();
  input.value = value;
  input.placeholder = placeholder;
  input.disabled = disabled;
  if (title) input.title = title;
  input.addEventListener("input", () => onInput?.(input.value));
  input.addEventListener("change", () => onChange?.(input.value));
  if (captureEvents) captureTextInputEvents(input);
  return input;
}

// web-src/components/toggle.ts
var TOGGLE_STYLE_ID = "avatary-switch-toggle-styles";
function ensureToggleStyles() {
  if (document.getElementById(TOGGLE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = TOGGLE_STYLE_ID;
  style.textContent = `
    .avatary-switch-toggle {
      flex: 0 0 auto;
      width: 38px;
      height: 22px;
      border-radius: 999px;
      border: 1px solid var(--p-form-field-border-color, transparent);
      background: var(--component-node-widget-background, #3a3d48);
      position: relative;
      cursor: pointer;
      box-sizing: border-box;
      transition: background .12s ease, border-color .12s ease, box-shadow .12s ease;
    }
    .avatary-switch-toggle:not(.disabled):hover {
      background: var(--component-node-widget-background-hovered, #4a4e5e);
    }
    .avatary-switch-toggle:not(.disabled):active {
      box-shadow: 0 0 0 1px var(--component-node-widget-background-highlighted, #4b5563);
    }
    .avatary-switch-toggle .knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 14px;
      height: 14px;
      border-radius: 999px;
      background: var(--component-node-foreground-secondary, #aeb2be);
      box-shadow: 0 1px 2px rgba(0,0,0,.35);
      transition: left .15s ease;
    }
    .avatary-switch-toggle.active {
      background: var(--p-primary-color, #60A5FA);
      border-color: var(--p-form-field-border-color, transparent);
      box-shadow: 0 0 0 1px var(--component-node-widget-background-highlighted, #4b5563);
    }
    .avatary-switch-toggle.active:not(.disabled):hover {
      background: color-mix(in srgb, var(--p-primary-color, #60A5FA) 88%, white);
    }
    .avatary-switch-toggle.active .knob {
      left: 19px;
      background: var(--p-primary-contrast-color, #1f232c);
      box-shadow: 0 1px 2px rgba(0,0,0,.4);
    }
    .avatary-switch-toggle.disabled {
      opacity: .4;
      cursor: default;
    }
  `;
  document.head.appendChild(style);
}
function createToggle({ active, disabled, title, onToggle }) {
  const toggle = document.createElement("div");
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-checked", active ? "true" : "false");
  if (title) toggle.title = title;
  toggle.className = "avatary-switch-toggle";
  if (active) toggle.classList.add("active");
  if (disabled) toggle.classList.add("disabled");
  const knob = document.createElement("span");
  knob.className = "knob";
  toggle.appendChild(knob);
  toggle.addEventListener("click", () => {
    if (disabled) return;
    onToggle?.();
  });
  return toggle;
}

// web-src/features_avatary.ts
var NODE_NAME2 = "AvataryFeatures";
var NODE_DISPLAY_NAME2 = "Features Avatary";
var MODE_ACTIVE2 = LiteGraph.ALWAYS;
var MODE_BYPASS2 = 4;
var STATE_KEY2 = "features_avatary_states";
var RULES_KEY = "features_avatary_rules";
var REFRESH_MS2 = 400;
var PANEL_BASE_HEIGHT = 18;
var FEATURE_ROW_HEIGHT = 36;
var PANEL_MIN_HEIGHT = 86;
var PANEL_MAX_HEIGHT = 320;
var STYLE_ID = "avatary-features-panel-styles";
var MODAL_ID = "avatary-features-rules-modal";
var ALPHABETICAL_COLLATOR2 = new Intl.Collator(void 0, {
  sensitivity: "base",
  numeric: true
});
function queueRefresh2(node, force = false) {
  if (force) {
    node.__featuresAvataryForceRefresh = true;
  }
  if (node.__featuresAvataryRefreshQueued) {
    return;
  }
  node.__featuresAvataryRefreshQueued = true;
  setTimeout(() => {
    node.__featuresAvataryRefreshQueued = false;
    refreshNode2(node);
  }, 0);
}
function isTargetNodeDef2(nodeData) {
  return String(nodeData?.name || "") === NODE_NAME2;
}
function isTargetNodeInstance2(node) {
  const candidates = [
    node?.type,
    node?.comfyClass,
    node?.constructor?.type,
    node?.constructor?.title
  ].map((value) => String(value || ""));
  return candidates.includes(NODE_NAME2);
}
function syncNodeTitle2(node) {
  if (!node) {
    return;
  }
  const title = String(node.title || "").trim();
  if (!title || title === NODE_NAME2) {
    node.title = NODE_DISPLAY_NAME2;
  }
}
function normalizeTitle2(title) {
  return String(title || "").trim();
}
function keyForTitle2(title) {
  return normalizeTitle2(title).toLowerCase();
}
function getCurrentGraph2(node) {
  return node?.graph || app2?.canvas?.getCurrentGraph?.() || app2?.graph;
}
function getGroupBounds2(group) {
  const bounds = group?._bounding || group?.bounding;
  if (!Array.isArray(bounds) || bounds.length < 4) {
    return null;
  }
  return bounds;
}
function collectNestedGraphs2(rootGraph) {
  if (!rootGraph) {
    return [];
  }
  const collected = [];
  const stack = [rootGraph];
  const seen = /* @__PURE__ */ new Set();
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
function getGroupNodes2(group, graph) {
  if (!group || !graph) {
    return [];
  }
  try {
    if (typeof group.recomputeInsideNodes === "function") {
      group.recomputeInsideNodes();
    }
  } catch (_error) {
  }
  const fromChildren = Array.from(group?._children || []).filter(
    (node) => typeof node?.id === "number"
  );
  if (fromChildren.length) {
    return fromChildren;
  }
  const bounds = getGroupBounds2(group);
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
    return centerX >= gx && centerX < gx + gw && centerY >= gy && centerY < gy + gh;
  });
}
function collectGroupsByTitle2(node) {
  const rootGraph = getCurrentGraph2(node);
  if (!rootGraph) {
    return [];
  }
  const deduped = /* @__PURE__ */ new Map();
  for (const graph of collectNestedGraphs2(rootGraph)) {
    const sourceGroups = Array.isArray(graph._groups) ? graph._groups : Array.isArray(graph.groups) ? graph.groups : [];
    for (const group of sourceGroups) {
      const title = normalizeTitle2(group?.title);
      if (!title) {
        continue;
      }
      const key = keyForTitle2(title);
      if (!deduped.has(key)) {
        deduped.set(key, {
          key,
          title,
          groups: []
        });
      }
      deduped.get(key).groups.push({ group, graph });
    }
  }
  return Array.from(deduped.values()).sort(
    (a, b) => ALPHABETICAL_COLLATOR2.compare(a.title, b.title) || a.key.localeCompare(b.key)
  );
}
function ensureStateStore2(node) {
  if (!node.properties || typeof node.properties !== "object") {
    node.properties = {};
  }
  if (!node.properties[STATE_KEY2] || typeof node.properties[STATE_KEY2] !== "object") {
    node.properties[STATE_KEY2] = {};
  }
  return node.properties[STATE_KEY2];
}
function findWidget2(node, name) {
  return (node.widgets || []).find((widget) => widget.name === name);
}
function applyModeToGroupTitle2(_node, groupEntry, enabled) {
  if (!groupEntry?.groups?.length) {
    return;
  }
  const seenNodeIds = /* @__PURE__ */ new WeakMap();
  const mode = enabled ? MODE_ACTIVE2 : MODE_BYPASS2;
  for (const { group, graph } of groupEntry.groups) {
    if (!group || !graph) {
      continue;
    }
    let graphSeenIds = seenNodeIds.get(graph);
    if (!graphSeenIds) {
      graphSeenIds = /* @__PURE__ */ new Set();
      seenNodeIds.set(graph, graphSeenIds);
    }
    for (const targetNode of getGroupNodes2(group, graph)) {
      if (!(targetNode && Number.isInteger(targetNode.id) && targetNode.id >= 0)) {
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
  const seenNodeIds = /* @__PURE__ */ new WeakMap();
  let allEnabled = true;
  let anyFound = false;
  for (const { group, graph } of groupEntry.groups) {
    if (!group || !graph) {
      continue;
    }
    let graphSeenIds = seenNodeIds.get(graph);
    if (!graphSeenIds) {
      graphSeenIds = /* @__PURE__ */ new Set();
      seenNodeIds.set(graph, graphSeenIds);
    }
    for (const targetNode of getGroupNodes2(group, graph)) {
      if (!(targetNode && Number.isInteger(targetNode.id) && targetNode.id >= 0)) {
        continue;
      }
      if (graphSeenIds.has(targetNode.id)) {
        continue;
      }
      graphSeenIds.add(targetNode.id);
      anyFound = true;
      if (targetNode.mode === MODE_BYPASS2) {
        allEnabled = false;
      }
    }
  }
  if (!anyFound) {
    return false;
  }
  return allEnabled;
}
function getEntryByKey2(node, key) {
  return collectGroupsByTitle2(node).find((entry) => entry.key === key) || null;
}
function getNodeLabel(node) {
  return String(node?.title || node?.type || node?.comfyClass || "").trim();
}
function collectNamedNodes(node) {
  const rootGraph = getCurrentGraph2(node);
  if (!rootGraph) {
    return [];
  }
  const collected = [];
  const seenNodeIds = /* @__PURE__ */ new WeakMap();
  for (const graph of collectNestedGraphs2(rootGraph)) {
    if (!graph) {
      continue;
    }
    let graphSeenIds = seenNodeIds.get(graph);
    if (!graphSeenIds) {
      graphSeenIds = /* @__PURE__ */ new Set();
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
function computeSignature2(groupsByTitle) {
  return groupsByTitle.map((entry) => entry.key).join("|");
}
function hasStoredState2(stateStore, key) {
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
    (widget) => widget?.__featuresAvataryDynamic
  ).length;
  const rowCount = Math.max(1, node.__featuresAvataryRowCount || dynamicCount);
  return Math.max(
    PANEL_MIN_HEIGHT,
    Math.min(PANEL_MAX_HEIGHT, PANEL_BASE_HEIGHT + rowCount * FEATURE_ROW_HEIGHT)
  );
}
function ensurePanelWidget(node) {
  if (node.__featuresAvataryPanel && node.widgets?.some((widget) => widget?.__featuresAvataryPanelWidget)) {
    return node.__featuresAvataryPanel;
  }
  if (node.widgets) {
    node.widgets = node.widgets.filter(
      (widget) => !widget?.__featuresAvataryPanelWidget
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
      getMinHeight: () => getPanelHeight(node)
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
  if (!node.properties[RULES_KEY] || typeof node.properties[RULES_KEY] !== "object" || Array.isArray(node.properties[RULES_KEY])) {
    node.properties[RULES_KEY] = {};
  }
  return node.properties[RULES_KEY];
}
function getFeatureRules(node, featureKey) {
  const store = ensureRuleStore(node);
  if (!Array.isArray(store[featureKey])) {
    store[featureKey] = [];
  }
  store[featureKey] = store[featureKey].filter(
    (rule) => [
      "toggle",
      "toggle_node"
    ].includes(rule?.type)
  ).map((rule) => ({
    type: rule.type === "toggle_node" ? "toggle_node" : "toggle",
    pattern: String(rule.pattern || "")
  }));
  return store[featureKey];
}
function removeFeatureRule(node, featureKey, index) {
  const rules = getFeatureRules(node, featureKey);
  rules.splice(index, 1);
  app2.graph?.setDirtyCanvas?.(true, true);
}
function refreshRulesBadge(node) {
  if (!isTargetNodeInstance2(node)) {
    return;
  }
  node.__featuresAvataryForceRefresh = true;
  renderPanel(node, collectGroupsByTitle2(node), ensureStateStore2(node));
  app2.graph?.setDirtyCanvas?.(true, true);
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
    `${editing ? "Edit" : "Add"} ${ruleTypeLabel(normalizedType)} Rule`
  );
  body.appendChild(createDescription(ruleTypeDescription(normalizedType)));
  const input = document.createElement("input");
  input.type = "text";
  input.className = "avatary-features-regex-input";
  input.placeholder = normalizedType.includes("_node") ? "Node name regex" : "Group name regex";
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
  save.className = "avatary-features-modal-button avatary-features-modal-button-primary";
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
    app2.graph?.setDirtyCanvas?.(true, true);
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
    createRuleOption("toggle_node")
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
  add.className = "avatary-features-modal-button avatary-features-modal-button-primary";
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
  const groupsByTitle = collectGroupsByTitle2(node);
  const namedNodes = collectNamedNodes(node);
  for (const rule of rules) {
    if (![
      "toggle",
      "toggle_node"
    ].includes(rule.type)) {
      continue;
    }
    let regex = null;
    try {
      regex = new RegExp(rule.pattern);
    } catch (_error) {
      continue;
    }
    const targetEnabled = !featureEnabled;
    if (rule.type === "toggle_node") {
      for (const target of namedNodes) {
        regex.lastIndex = 0;
        if (!regex.test(target.label)) {
          continue;
        }
        target.node.mode = targetEnabled ? MODE_ACTIVE2 : MODE_BYPASS2;
        target.graph.setDirtyCanvas?.(true, true);
      }
      continue;
    }
    for (const targetEntry of groupsByTitle) {
      regex.lastIndex = 0;
      if (!regex.test(targetEntry.title)) {
        continue;
      }
      applyModeToGroupTitle2(node, targetEntry, targetEnabled);
      const stateStore = ensureStateStore2(node);
      stateStore[targetEntry.key] = targetEnabled;
    }
  }
}
function resolveInitialEnabled(node, entry, stateStore) {
  if (hasStoredState2(stateStore, entry.key)) {
    return asBoolean(stateStore[entry.key]);
  }
  return resolveEnabledFromGroups(node, entry);
}
function syncWidgets2(node, groupsByTitle, stateStore) {
  for (const entry of groupsByTitle) {
    const widgetName = entry.title;
    const actualEnabled = resolveEnabledFromGroups(node, entry);
    const targetEnabled = resolveInitialEnabled(node, entry, stateStore);
    if (!hasStoredState2(stateStore, entry.key)) {
      stateStore[entry.key] = targetEnabled;
    }
    if (actualEnabled !== targetEnabled) {
      applyModeToGroupTitle2(node, entry, targetEnabled);
    }
    const widget = findWidget2(node, widgetName);
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
    (entry) => getFeatureRules(node, entry.key).length > 0
  );
  for (const entry of groupsByTitle) {
    const isEnabled = resolveInitialEnabled(node, entry, stateStore);
    if (!hasStoredState2(stateStore, entry.key)) {
      stateStore[entry.key] = isEnabled;
    }
    const actualEnabled = resolveEnabledFromGroups(node, entry);
    if (actualEnabled !== isEnabled) {
      applyModeToGroupTitle2(node, entry, isEnabled);
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
        const latestEntry = getEntryByKey2(node, entry.key);
        if (!latestEntry) {
          return;
        }
        const enabled = !asBoolean(stateStore[entry.key]);
        stateStore[entry.key] = enabled;
        applyModeToGroupTitle2(node, latestEntry, enabled);
        applyFeatureRules(node, latestEntry, enabled);
        renderPanel(node, collectGroupsByTitle2(node), stateStore);
      }
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
    Math.max(node.size?.[1] || 0, getPanelHeight(node) + 76)
  ]);
  app2.graph?.setDirtyCanvas?.(true, true);
  return true;
}
function removeDynamicWidgets2(node) {
  let index = 0;
  while ((node.widgets || [])[index]) {
    if (node.widgets[index]?.__featuresAvataryDynamic) {
      node.removeWidget(index);
      continue;
    }
    index += 1;
  }
}
function forceFullRefresh2(node) {
  queueRefresh2(node, true);
}
function refreshNode2(node) {
  if (!isTargetNodeInstance2(node)) {
    return;
  }
  const groupsByTitle = collectGroupsByTitle2(node);
  const stateStore = ensureStateStore2(node);
  const signature = computeSignature2(groupsByTitle);
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
    syncWidgets2(node, groupsByTitle, stateStore);
    app2.graph?.setDirtyCanvas?.(true, true);
    return;
  }
  node.__featuresAvatarySignature = signature;
  removeDynamicWidgets2(node);
  if (renderPanel(node, groupsByTitle, stateStore)) {
    app2.graph?.setDirtyCanvas?.(true, true);
    return;
  }
  for (const entry of groupsByTitle) {
    const widgetName = entry.title;
    const isEnabled = resolveInitialEnabled(node, entry, stateStore);
    stateStore[entry.key] = isEnabled;
    const actualEnabled = resolveEnabledFromGroups(node, entry);
    if (actualEnabled !== isEnabled) {
      applyModeToGroupTitle2(node, entry, isEnabled);
    }
    const widget = node.addWidget("toggle", widgetName, isEnabled, (value) => {
      const enabled = Boolean(value);
      const latestEntry = getEntryByKey2(node, entry.key);
      if (!latestEntry) {
        return;
      }
      stateStore[entry.key] = enabled;
      applyModeToGroupTitle2(node, latestEntry, enabled);
    });
    widget.__featuresAvataryDynamic = true;
    widget.__featuresAvataryKey = entry.key;
    widget.value = isEnabled;
  }
  node.setSize([node.size[0], node.computeSize()[1]]);
  app2.graph?.setDirtyCanvas?.(true, true);
}
function bindNode2(node) {
  if (node.__featuresAvataryBound) {
    return;
  }
  node.__featuresAvataryBound = true;
  syncNodeTitle2(node);
  const originalOnRemoved = node.onRemoved;
  node.onRemoved = function(...args) {
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
        (widget) => !widget?.__featuresAvataryPanelWidget
      );
    }
    return originalOnRemoved?.apply(this, args);
  };
  node.__featuresAvataryRefreshTimer = setInterval(() => {
    const graph = getCurrentGraph2(node);
    if (!graph) {
      return;
    }
    if (node.__featuresAvataryGraphRef !== graph) {
      node.__featuresAvataryGraphRef = graph;
      forceFullRefresh2(node);
      return;
    }
    refreshNode2(node);
  }, REFRESH_MS2);
}
app2.registerExtension({
  name: "avatary.features",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (!isTargetNodeDef2(nodeData)) {
      return;
    }
    const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
    const originalOnConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onNodeCreated = function(...args) {
      const result = originalOnNodeCreated?.apply(this, args);
      bindNode2(this);
      queueRefresh2(this, true);
      setTimeout(() => queueRefresh2(this, true), 80);
      setTimeout(() => queueRefresh2(this, true), 250);
      return result;
    };
    nodeType.prototype.onConfigure = function(...args) {
      const result = originalOnConfigure?.apply(this, args);
      bindNode2(this);
      queueRefresh2(this, true);
      setTimeout(() => queueRefresh2(this, true), 80);
      return result;
    };
  },
  loadedGraphNode(node) {
    if (!isTargetNodeInstance2(node)) {
      return;
    }
    bindNode2(node);
    queueRefresh2(node, true);
    setTimeout(() => queueRefresh2(node, true), 80);
  }
});

// web-src/load_images_avatary.ts
import { app as app3 } from "/scripts/app.js";
var NODE_CLASS = "AvataryLoadImageBatch";
var STATE_KEY3 = "avataryLoadImageBatch";
var HIDDEN_INPUT_NAME = "UploadState";
var MANAGED_SUBFOLDER = "avatary_load_image_batch";
var PANEL_HEIGHT = 260;
var VIEWER_ID = "avatary-lb-viewer";
var ACCEPTED_TYPES = [".png", ".jpg", ".jpeg", ".webp", "image/*"];
var FIXED_NODE_WIDTH = 340;
var FIXED_NODE_HEIGHT = 380;
function ensureStyles2() {
  let style = document.getElementById("avatary-load-image-batch-styles");
  if (!style) {
    style = document.createElement("style");
    style.id = "avatary-load-image-batch-styles";
    document.head.appendChild(style);
  }
  style.textContent = `
    .avatary-lb-panel { display:flex; flex-direction:column; gap:8px; font:12px 'Segoe UI',sans-serif; height:100%; min-height:0; }
    .avatary-lb-panel.drag-hover {
      outline: 2px dashed #7ab8ff;
      outline-offset: -2px;
      border-radius: 10px;
      background: rgba(90, 140, 210, 0.08);
    }
    .avatary-lb-panel.drag-hover .avatary-lb-list {
      box-shadow: inset 0 0 0 1px rgba(122, 184, 255, 0.45);
      border-radius: 10px;
    }
    .avatary-lb-actions { display:flex; gap:8px; }
    .avatary-lb-actions.path-mode { justify-content:flex-end; }
    .avatary-lb-path-wrap { display:flex; gap:8px; width:100%; }
    .avatary-lb-path-input {
      flex:1;
      min-width:0;
      min-height:30px;
      border-radius:10px;
      border:1px solid var(--border-color,#434958);
      background:var(--comfy-input-bg,#232831);
      color:var(--input-text,#e6e9ef);
      padding:0 10px;
      outline:none;
    }
    .avatary-lb-btn { flex:1; min-height:30px; border-radius:10px; border:1px solid var(--border-color,#434958); background:var(--comfy-input-bg,#232831); color:var(--input-text,#e6e9ef); cursor:pointer; }
    .avatary-lb-btn.secondary { flex:0 0 auto; padding:0 10px; }
    .avatary-lb-btn i {
      width: 14px;
      height: 14px;
      font-size: 14px;
      display: inline-block;
      vertical-align: middle;
    }
    .avatary-lb-btn.mode {
      flex:0 0 auto;
      width:36px;
      padding:0;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .avatary-lb-list { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; overflow:auto; padding-right:2px; flex:1 1 auto; min-height:0; align-content:start; }
    .avatary-lb-item { border:1px solid var(--border-color,#434958); border-radius:10px; padding:6px; background:var(--comfy-menu-bg,#16191f); display:flex; flex-direction:column; gap:4px; }
    .avatary-lb-thumb-wrap {
      position: relative;
      width: 100%;
      padding-top: 100%;
      overflow: hidden;
      border-radius: 6px;
      background: #0f1116;
    }
    .avatary-lb-thumb-wrap { aspect-ratio: 1 / 1; }
    .avatary-lb-thumb {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .avatary-lb-list.single .avatary-lb-thumb-wrap {
      padding-top: 0;
      aspect-ratio: auto;
      background: transparent;
    }
    .avatary-lb-list.single .avatary-lb-thumb {
      position: static;
      inset: auto;
      width: 100%;
      height: auto;
      object-fit: initial;
    }
    .avatary-lb-thumb-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .avatary-lb-replace {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      border: 1px solid var(--border-color,#434958);
      background: rgba(20, 24, 31, 0.88);
      color: var(--input-text,#e6e9ef);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.9;
    }
    .avatary-lb-replace:hover { opacity: 1; background: rgba(30, 36, 46, 0.96); }
    .avatary-lb-replace i {
      width: 10px;
      height: 14px;
      font-size: 14px;
      display: inline-block;
    }
    .avatary-lb-meta { display:flex; align-items:center; justify-content:space-between; gap:6px; }
    .avatary-lb-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--input-text,#d0d6e2); }
    .avatary-lb-remove { border:none; background:transparent; color:#ff8f9d; cursor:pointer; font-size:11px; }
    .avatary-lb-empty { color:#8f97a6; padding:8px 2px; }
    .avatary-lb-viewer {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.86);
      cursor: zoom-out;
      padding: 16px;
      box-sizing: border-box;
    }
    .avatary-lb-viewer-content {
      width: min(96vw, 1800px);
      height: 96vh;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      cursor: default;
    }
    .avatary-lb-viewer img {
      max-width: min(96vw, 1800px);
      max-height: 96vh;
      width: auto;
      height: auto;
      object-fit: contain;
      border-radius: 10px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    }
    .avatary-lb-viewer-content.compare .avatary-lb-viewer-pane {
      flex: 1 1 0;
      min-width: 0;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .avatary-lb-viewer-content.compare .avatary-lb-viewer-pane img {
      max-width: 100%;
      max-height: 100%;
    }
    .avatary-lb-compare-btn {
      position: absolute;
      right: 22px;
      top: 50%;
      transform: translateY(-50%);
      width: 42px;
      height: 42px;
      border-radius: 999px;
      border: 1px solid var(--border-color,#434958);
      background: rgba(20, 24, 31, 0.92);
      color: var(--input-text,#e6e9ef);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }
    .avatary-lb-compare-btn:hover { background: rgba(30, 36, 46, 0.98); }
    .avatary-lb-compare-btn i {
      width: 16px;
      height: 16px;
      font-size: 16px;
      display: inline-block;
    }
  `;
}
function getState(node) {
  if (!node.properties) node.properties = {};
  if (!node.properties[STATE_KEY3]) {
    node.properties[STATE_KEY3] = {
      subfolder: MANAGED_SUBFOLDER,
      files: [],
      uploadedAt: {},
      isUploading: false,
      uploadDone: 0,
      uploadTotal: 0,
      mode: "upload",
      folderPath: "",
      sourceDir: "",
      previewKind: "managed",
      previewSubfolder: MANAGED_SUBFOLDER
    };
  }
  const state = node.properties[STATE_KEY3];
  if (!Array.isArray(state.files)) state.files = [];
  if (!state.uploadedAt || typeof state.uploadedAt !== "object")
    state.uploadedAt = {};
  if (!state.subfolder) state.subfolder = MANAGED_SUBFOLDER;
  if (typeof state.isUploading !== "boolean") state.isUploading = false;
  if (!Number.isFinite(state.uploadDone)) state.uploadDone = 0;
  if (!Number.isFinite(state.uploadTotal)) state.uploadTotal = 0;
  if (state.mode !== "upload" && state.mode !== "path") state.mode = "upload";
  if (typeof state.folderPath !== "string") state.folderPath = "";
  if (typeof state.sourceDir !== "string") state.sourceDir = "";
  if (state.previewKind !== "managed" && state.previewKind !== "input" && state.previewKind !== "folder") {
    state.previewKind = "managed";
  }
  if (typeof state.previewSubfolder !== "string") state.previewSubfolder = MANAGED_SUBFOLDER;
  return state;
}
function getFilesLatestFirst(state) {
  return [...state.files].sort((a, b) => {
    const tsA = Number(state.uploadedAt?.[a] || 0);
    const tsB = Number(state.uploadedAt?.[b] || 0);
    if (tsA !== tsB) return tsB - tsA;
    return String(a).localeCompare(String(b));
  });
}
function getHiddenWidget(node) {
  return node.widgets?.find((w) => w.name === HIDDEN_INPUT_NAME) || null;
}
function syncUploadState(node) {
  const state = getState(node);
  const hidden = getHiddenWidget(node);
  state.files = getFilesLatestFirst(state);
  if (hidden)
    hidden.value = JSON.stringify({
      subfolder: state.subfolder,
      files: state.files,
      mode: state.mode,
      folder_path: state.folderPath,
      source_dir: state.sourceDir
    });
}
function managedPreviewUrl(fileName, subfolder) {
  const params = new URLSearchParams({
    filename: fileName,
    type: "input",
    subfolder
  });
  return `/view?${params.toString()}`;
}
function previewUrl(node, fileName) {
  const state = getState(node);
  if (state.previewKind === "input") {
    return managedPreviewUrl(fileName, state.previewSubfolder || "");
  }
  if (state.previewKind === "folder") {
    const params = new URLSearchParams({
      filename: fileName,
      folder_path: state.sourceDir || ""
    });
    return `/avatary/load-images/preview?${params.toString()}`;
  }
  return managedPreviewUrl(fileName, state.subfolder);
}
function ensurePanelWidget2(node) {
  if (node._avataryLbPanel && node.widgets?.some((w) => w?._avataryLbPanelWidget))
    return node._avataryLbPanel;
  if (node.widgets)
    node.widgets = node.widgets.filter((w) => !w?._avataryLbPanelWidget);
  node._avataryLbPanel = null;
  const panel = document.createElement("div");
  panel.className = "avatary-lb-panel";
  node._avataryLbPanel = panel;
  if (typeof node.addDOMWidget === "function") {
    const w = node.addDOMWidget("Uploads", "upload_panel", panel, {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => PANEL_HEIGHT
    });
    if (w) {
      w._avataryLbPanelWidget = true;
      w.serialize = false;
      return panel;
    }
  }
  return null;
}
async function uploadSingle(file) {
  const body = new FormData();
  body.append("image", file);
  body.append("type", "input");
  body.append("subfolder", MANAGED_SUBFOLDER);
  body.append("overwrite", "true");
  const response = await fetch("/upload/image", {
    method: "POST",
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Upload failed (${response.status})`);
  }
  return await response.json();
}
async function deleteFilesFromDisk(files) {
  if (!Array.isArray(files) || files.length === 0)
    return { deleted: [], errors: [] };
  const response = await fetch("/avatary/load-images/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Delete failed (${response.status})`);
  }
  return await response.json();
}
function filterImageFiles(files) {
  return Array.from(files || []).filter(
    (file) => file?.type?.startsWith("image/")
  );
}
function uniqueStrings(values) {
  return Array.from(
    new Set(
      (values || []).map((value) => String(value || "").trim()).filter(Boolean)
    )
  );
}
function extractUrlsFromText(payload) {
  if (!payload) return [];
  const text = String(payload);
  const matches = text.match(/https?:\/\/[^\s"')<>]+|\/[^\s"')<>]+/g) || [];
  return uniqueStrings(matches);
}
function resolveDraggedUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return null;
  try {
    return new URL(value, window.location.origin);
  } catch {
    return null;
  }
}
function inferFileNameFromUrl(url, index) {
  const fallback = `dropped_${Date.now()}_${index}.png`;
  const fileNameParam = url.searchParams.get("filename");
  if (fileNameParam) {
    const fromParam = decodeURIComponent(fileNameParam).split("/").pop();
    if (fromParam) return fromParam;
  }
  const fromPath = decodeURIComponent(url.pathname || "").split("/").pop();
  if (fromPath) return fromPath;
  return fallback;
}
async function fetchDraggedAssetFiles(event) {
  const transfer = event?.dataTransfer;
  if (!transfer) return [];
  const directFiles = filterImageFiles(transfer.files);
  if (directFiles.length) return directFiles;
  const rawPayloads = [];
  try {
    for (const item of Array.from(transfer.items || [])) {
      if (item?.kind !== "string") continue;
      const payload = await new Promise((resolve) => {
        try {
          item.getAsString((value) => resolve(value || ""));
        } catch {
          resolve("");
        }
      });
      if (payload) rawPayloads.push(payload);
    }
  } catch {
  }
  for (const type of ["text/uri-list", "text/plain"]) {
    try {
      const payload = transfer.getData(type);
      if (payload) rawPayloads.push(payload);
    } catch {
    }
  }
  const draggedUrls = uniqueStrings(
    rawPayloads.flatMap((payload) => extractUrlsFromText(payload))
  ).map((url) => resolveDraggedUrl(url)).filter((url) => url && url.origin === window.location.origin);
  const files = [];
  for (let i = 0; i < draggedUrls.length; i += 1) {
    const url = draggedUrls[i];
    try {
      const response = await fetch(url.toString(), { credentials: "same-origin" });
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!String(blob?.type || "").startsWith("image/")) continue;
      const name = inferFileNameFromUrl(url, i);
      files.push(new File([blob], name, { type: blob.type || "image/png" }));
    } catch {
    }
  }
  return files;
}
async function uploadFiles(node, files) {
  const selectedFiles = filterImageFiles(files);
  if (!selectedFiles.length) return;
  const state = getState(node);
  if (state.isUploading) return;
  state.mode = "upload";
  state.sourceDir = "";
  state.folderPath = "";
  state.previewKind = "managed";
  state.previewSubfolder = state.subfolder || MANAGED_SUBFOLDER;
  state.isUploading = true;
  state.uploadDone = 0;
  state.uploadTotal = selectedFiles.length;
  renderPanel2(node);
  app3.graph?.setDirtyCanvas?.(true, true);
  try {
    for (const file of selectedFiles) {
      const uploaded = await uploadSingle(file);
      const name = uploaded?.name || uploaded?.filename || file.name;
      if (state.files.includes(name)) {
        state.files = state.files.filter((existing) => existing !== name);
      }
      state.uploadedAt[name] = Date.now();
      state.files.unshift(name);
      state.uploadDone += 1;
      renderPanel2(node);
    }
  } finally {
    state.isUploading = false;
    state.uploadDone = 0;
    state.uploadTotal = 0;
  }
  syncUploadState(node);
  renderPanel2(node);
  app3.graph?.setDirtyCanvas?.(true, true);
}
async function handleUpload(node) {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ACCEPTED_TYPES.join(",");
  picker.multiple = true;
  picker.onchange = async () => {
    await uploadFiles(node, picker.files);
  };
  picker.click();
}
async function readClipboardImageFiles() {
  if (!navigator?.clipboard?.read) return [];
  const items = await navigator.clipboard.read();
  const files = [];
  let imageIndex = 0;
  for (const item of items) {
    const imageType = item.types.find(
      (type) => String(type).startsWith("image/")
    );
    if (!imageType) continue;
    const blob = await item.getType(imageType);
    const ext = imageType.split("/")[1] || "png";
    const fileName = `pasted_${Date.now()}_${imageIndex}.${ext}`;
    files.push(new File([blob], fileName, { type: imageType }));
    imageIndex += 1;
  }
  return files;
}
async function handlePaste(node) {
  const files = await readClipboardImageFiles();
  if (!files.length) return;
  await uploadFiles(node, files);
}
async function removeFile(node, name) {
  const state = getState(node);
  if (state.isUploading) return;
  try {
    await deleteFilesFromDisk([name]);
  } catch (err) {
    console.error("[AvataryLoadImageBatch] delete failed", err);
  }
  state.files = state.files.filter((file) => file !== name);
  if (state.uploadedAt && Object.hasOwn(state.uploadedAt, name)) {
    delete state.uploadedAt[name];
  }
  syncUploadState(node);
  renderPanel2(node);
  app3.graph?.setDirtyCanvas?.(true, true);
}
function forgetMissingFile(node, name) {
  const state = getState(node);
  if (!state.files.includes(name)) return;
  state.files = state.files.filter((file) => file !== name);
  if (state.uploadedAt && Object.hasOwn(state.uploadedAt, name)) {
    delete state.uploadedAt[name];
  }
  syncUploadState(node);
  renderPanel2(node);
  app3.graph?.setDirtyCanvas?.(true, true);
}
async function replaceFile(node, oldName) {
  const state = getState(node);
  if (state.isUploading) return;
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ACCEPTED_TYPES.join(",");
  picker.multiple = false;
  picker.onchange = async () => {
    const picked = filterImageFiles(picker.files);
    if (!picked.length) return;
    state.isUploading = true;
    state.uploadDone = 0;
    state.uploadTotal = 1;
    renderPanel2(node);
    app3.graph?.setDirtyCanvas?.(true, true);
    try {
      const uploaded = await uploadSingle(picked[0]);
      const newName = uploaded?.name || uploaded?.filename || picked[0].name;
      if (newName !== oldName) {
        try {
          await deleteFilesFromDisk([oldName]);
        } catch (err) {
          console.error("[AvataryLoadImageBatch] replace delete failed", err);
        }
      }
      state.files = state.files.filter(
        (file) => file !== oldName && file !== newName
      );
      if (state.uploadedAt && Object.hasOwn(state.uploadedAt, oldName)) {
        delete state.uploadedAt[oldName];
      }
      state.uploadedAt[newName] = Date.now();
      state.files.unshift(newName);
      state.uploadDone = 1;
    } catch (err) {
      console.error("[AvataryLoadImageBatch] replace upload failed", err);
    } finally {
      state.isUploading = false;
      state.uploadDone = 0;
      state.uploadTotal = 0;
    }
    syncUploadState(node);
    renderPanel2(node);
    app3.graph?.setDirtyCanvas?.(true, true);
  };
  picker.click();
}
async function replaceFileFromClipboard(node, oldName) {
  const state = getState(node);
  if (state.isUploading) return;
  const files = await readClipboardImageFiles();
  if (!files.length) return;
  const replacement = files[0];
  state.isUploading = true;
  state.uploadDone = 0;
  state.uploadTotal = 1;
  renderPanel2(node);
  app3.graph?.setDirtyCanvas?.(true, true);
  try {
    const uploaded = await uploadSingle(replacement);
    const newName = uploaded?.name || uploaded?.filename || replacement.name;
    if (newName !== oldName) {
      try {
        await deleteFilesFromDisk([oldName]);
      } catch (err) {
        console.error(
          "[AvataryLoadImageBatch] clipboard replace delete failed",
          err
        );
      }
    }
    state.files = state.files.filter(
      (file) => file !== oldName && file !== newName
    );
    if (state.uploadedAt && Object.hasOwn(state.uploadedAt, oldName)) {
      delete state.uploadedAt[oldName];
    }
    state.uploadedAt[newName] = Date.now();
    state.files.unshift(newName);
    state.uploadDone = 1;
  } catch (err) {
    console.error(
      "[AvataryLoadImageBatch] clipboard replace upload failed",
      err
    );
  } finally {
    state.isUploading = false;
    state.uploadDone = 0;
    state.uploadTotal = 0;
  }
  syncUploadState(node);
  renderPanel2(node);
  app3.graph?.setDirtyCanvas?.(true, true);
}
async function clearAll(node) {
  const state = getState(node);
  if (state.isUploading) return;
  const filesToDelete = [...state.files];
  try {
    await deleteFilesFromDisk(filesToDelete);
  } catch (err) {
    console.error("[AvataryLoadImageBatch] clear delete failed", err);
  }
  state.files = [];
  state.uploadedAt = {};
  syncUploadState(node);
  renderPanel2(node);
  app3.graph?.setDirtyCanvas?.(true, true);
}
function applyGridColumns(list, count) {
  if (!list) return;
  list.style.gridTemplateColumns = count === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))";
}
function applyOverflowAfterFour(list, count) {
  if (!list) return;
  if (count <= 4) {
    list.style.maxHeight = "";
    list.style.overflowY = "";
    return;
  }
  const cards = Array.from(list.querySelectorAll(".avatary-lb-item"));
  const rowHeights = [0, 0];
  for (let i = 0; i < Math.min(4, cards.length); i++) {
    const row = Math.floor(i / 2);
    rowHeights[row] = Math.max(rowHeights[row], cards[i].offsetHeight || 0);
  }
  const gapPx = 8;
  const maxHeight = rowHeights.reduce((sum, h) => sum + h, 0) + gapPx;
  if (maxHeight > 0) {
    list.style.maxHeight = `${maxHeight}px`;
    list.style.overflowY = "auto";
  }
}
function lockNodeSize(node) {
  if (!node) return;
  node.resizable = false;
  node.flags = { ...node.flags || {}, no_resize: true };
  node.size = [FIXED_NODE_WIDTH, FIXED_NODE_HEIGHT];
}
function closeViewer() {
  const existing = document.getElementById(VIEWER_ID);
  if (existing) existing.remove();
}
function openViewer(src, alt = "") {
  closeViewer();
  const overlay = document.createElement("div");
  overlay.id = VIEWER_ID;
  overlay.className = "avatary-lb-viewer";
  const content = document.createElement("div");
  content.className = "avatary-lb-viewer-content";
  const basePane = document.createElement("div");
  basePane.className = "avatary-lb-viewer-pane";
  const baseImg = document.createElement("img");
  baseImg.src = src;
  baseImg.alt = alt;
  basePane.appendChild(baseImg);
  content.appendChild(basePane);
  const compareBtn = document.createElement("button");
  compareBtn.className = "avatary-lb-compare-btn";
  compareBtn.innerHTML = '<i class="icon-[lucide--clipboard-paste]"></i>';
  compareBtn.title = "Paste image to compare";
  compareBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const files = await readClipboardImageFiles();
      if (!files.length) return;
      const existing = content.querySelector(
        '[data-avatary-compare="true"]'
      );
      if (existing) existing.remove();
      const objectUrl = URL.createObjectURL(files[0]);
      const comparePane = document.createElement("div");
      comparePane.className = "avatary-lb-viewer-pane";
      comparePane.dataset.avataryCompare = "true";
      comparePane.dataset.avataryObjectUrl = objectUrl;
      const compareImg = document.createElement("img");
      compareImg.src = objectUrl;
      compareImg.alt = "Clipboard image";
      comparePane.appendChild(compareImg);
      content.appendChild(comparePane);
      content.classList.add("compare");
    } catch (err) {
      console.error("[AvataryLoadImageBatch] viewer compare paste failed", err);
    }
  };
  overlay.onclick = () => closeViewer();
  content.onclick = (e) => e.stopPropagation();
  overlay.appendChild(content);
  overlay.appendChild(compareBtn);
  document.body.appendChild(overlay);
  const cleanupCompareUrl = () => {
    const comparePane = content.querySelector('[data-avatary-compare="true"]');
    const objectUrl = comparePane?.dataset?.avataryObjectUrl;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
  const escHandler = (e) => {
    if (e.key === "Escape") {
      cleanupCompareUrl();
      closeViewer();
      window.removeEventListener("keydown", escHandler, true);
    }
  };
  window.addEventListener("keydown", escHandler, true);
  const observer = new MutationObserver(() => {
    if (!document.getElementById(VIEWER_ID)) {
      cleanupCompareUrl();
      window.removeEventListener("keydown", escHandler, true);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
}
function renderPanel2(node) {
  ensureStyles2();
  const panel = ensurePanelWidget2(node);
  if (!panel) return;
  const state = getState(node);
  state.files = getFilesLatestFirst(state);
  panel.innerHTML = "";
  const actions = document.createElement("div");
  actions.className = "avatary-lb-actions";
  const setDragHover = (isActive) => {
    panel.classList.toggle("drag-hover", isActive);
  };
  panel.ondragenter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(true);
  };
  panel.ondragover = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(true);
  };
  panel.ondragleave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!panel.contains(e.relatedTarget)) setDragHover(false);
  };
  panel.ondrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(false);
    const droppedFiles = await fetchDraggedAssetFiles(e);
    if (!droppedFiles?.length) return;
    try {
      await uploadFiles(node, droppedFiles);
    } catch (err) {
      console.error("[AvataryLoadImageBatch] drop upload failed", err);
    }
  };
  const uploadBtn = document.createElement("button");
  uploadBtn.className = "avatary-lb-btn";
  uploadBtn.textContent = "Upload Images";
  uploadBtn.disabled = state.isUploading;
  uploadBtn.onclick = async () => {
    if (state.isUploading) return;
    try {
      await handleUpload(node);
    } catch (err) {
      console.error("[AvataryLoadImageBatch] upload failed", err);
    }
  };
  const pasteBtn = document.createElement("button");
  pasteBtn.className = "avatary-lb-btn secondary";
  pasteBtn.innerHTML = '<i class="icon-[lucide--clipboard-paste]"></i>';
  pasteBtn.title = "Paste image from clipboard";
  pasteBtn.disabled = state.isUploading;
  pasteBtn.onclick = async () => {
    if (state.isUploading) return;
    try {
      await handlePaste(node);
    } catch (err) {
      console.error("[AvataryLoadImageBatch] paste failed", err);
    }
  };
  const clearBtn = document.createElement("button");
  clearBtn.className = "avatary-lb-btn secondary";
  clearBtn.textContent = "Clear";
  clearBtn.disabled = (state.mode === "upload" ? state.files.length === 0 : String(state.folderPath || "").trim().length === 0) || state.isUploading;
  clearBtn.onclick = async () => {
    if (state.mode === "path") {
      state.folderPath = "";
      syncUploadState(node);
      renderPanel2(node);
      app3.graph?.setDirtyCanvas?.(true, true);
      return;
    }
    await clearAll(node);
  };
  const modeBtn = document.createElement("button");
  modeBtn.className = "avatary-lb-btn mode";
  modeBtn.title = state.mode === "upload" ? "Switch to folder path mode" : "Switch to upload mode";
  modeBtn.innerHTML = state.mode === "upload" ? '<i class="icon-[lucide--folder-search]"></i>' : '<i class="icon-[lucide--image]"></i>';
  modeBtn.disabled = state.isUploading;
  modeBtn.onclick = () => {
    if (state.isUploading) return;
    state.mode = state.mode === "upload" ? "path" : "upload";
    syncUploadState(node);
    renderPanel2(node);
  };
  if (state.mode === "upload") {
    actions.appendChild(uploadBtn);
    actions.appendChild(pasteBtn);
    actions.appendChild(clearBtn);
    actions.appendChild(modeBtn);
    panel.appendChild(actions);
  } else {
    actions.classList.add("path-mode");
    actions.appendChild(modeBtn);
    panel.appendChild(actions);
    const pathWrap = document.createElement("div");
    pathWrap.className = "avatary-lb-path-wrap";
    const pathInput = document.createElement("input");
    pathInput.className = "avatary-lb-path-input";
    pathInput.type = "text";
    pathInput.placeholder = "Path under ComfyUI root (e.g. input/my-folder)";
    pathInput.value = state.folderPath || "";
    pathInput.disabled = state.isUploading;
    pathInput.oninput = () => {
      state.folderPath = pathInput.value;
      syncUploadState(node);
      app3.graph?.setDirtyCanvas?.(true, true);
    };
    pathWrap.appendChild(pathInput);
    panel.appendChild(pathWrap);
    const note = document.createElement("div");
    note.className = "avatary-lb-empty";
    note.textContent = "Path mode: images will be loaded from this folder when the workflow runs.";
    panel.appendChild(note);
    lockNodeSize(node);
    return;
  }
  if (state.isUploading) {
    const loading = document.createElement("div");
    loading.className = "avatary-lb-empty";
    loading.textContent = `Uploading ${Math.min(state.uploadDone, state.uploadTotal)}/${state.uploadTotal || 0} images...`;
    panel.appendChild(loading);
  }
  const list = document.createElement("div");
  list.className = "avatary-lb-list";
  const isSingleImage = state.files.length === 1;
  if (isSingleImage) list.classList.add("single");
  applyGridColumns(list, state.files.length);
  if (!state.files.length) {
    const empty = document.createElement("div");
    empty.className = "avatary-lb-empty";
    empty.textContent = "Upload one or more images to preview and batch load.";
    panel.appendChild(empty);
  } else {
    for (const name of state.files) {
      const item = document.createElement("div");
      item.className = "avatary-lb-item";
      if (isSingleImage) item.classList.add("single");
      const thumbWrap = document.createElement("div");
      thumbWrap.className = "avatary-lb-thumb-wrap";
      const img = document.createElement("img");
      img.className = "avatary-lb-thumb";
      img.loading = "lazy";
      img.src = previewUrl(node, name);
      img.alt = name;
      img.onload = () => applyOverflowAfterFour(list, state.files.length);
      img.onerror = () => {
        forgetMissingFile(node, name);
      };
      img.ondblclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openViewer(img.src, name);
      };
      const actionsOverlay = document.createElement("div");
      actionsOverlay.className = "avatary-lb-thumb-actions";
      const replaceBtn = document.createElement("button");
      replaceBtn.className = "avatary-lb-replace";
      replaceBtn.innerHTML = '<i class="icon-[lucide--upload]"></i>';
      replaceBtn.title = "Replace image";
      replaceBtn.disabled = state.isUploading;
      replaceBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await replaceFile(node, name);
      };
      const pasteReplaceBtn = document.createElement("button");
      pasteReplaceBtn.className = "avatary-lb-replace";
      pasteReplaceBtn.innerHTML = '<i class="icon-[lucide--clipboard-paste]"></i>';
      pasteReplaceBtn.title = "Paste and replace image";
      pasteReplaceBtn.disabled = state.isUploading;
      pasteReplaceBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await replaceFileFromClipboard(node, name);
      };
      const meta = document.createElement("div");
      meta.className = "avatary-lb-meta";
      const label = document.createElement("div");
      label.className = "avatary-lb-name";
      label.title = name;
      label.textContent = name;
      const removeBtn = document.createElement("button");
      removeBtn.className = "avatary-lb-remove";
      removeBtn.textContent = "Remove";
      removeBtn.disabled = state.isUploading;
      removeBtn.onclick = async () => removeFile(node, name);
      meta.appendChild(label);
      meta.appendChild(removeBtn);
      thumbWrap.appendChild(img);
      actionsOverlay.appendChild(pasteReplaceBtn);
      actionsOverlay.appendChild(replaceBtn);
      thumbWrap.appendChild(actionsOverlay);
      item.appendChild(thumbWrap);
      item.appendChild(meta);
      item.ondblclick = (e) => {
        if (e.target === removeBtn || e.target === replaceBtn || e.target === pasteReplaceBtn)
          return;
        openViewer(img.src, name);
      };
      list.appendChild(item);
    }
    panel.appendChild(list);
    requestAnimationFrame(
      () => applyOverflowAfterFour(list, state.files.length)
    );
  }
  syncUploadState(node);
  lockNodeSize(node);
}
app3.registerExtension({
  name: "Avatary.LoadImageBatch.MultiUploadPreview",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS) return;
    const origCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function(...args) {
      const r = origCreated?.apply(this, args);
      lockNodeSize(this);
      renderPanel2(this);
      setTimeout(() => {
        try {
          lockNodeSize(this);
          renderPanel2(this);
        } catch (_err) {
        }
      }, 60);
      return r;
    };
    const origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function(...args) {
      const r = origConfigure?.apply(this, args);
      lockNodeSize(this);
      renderPanel2(this);
      return r;
    };
    const origRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function(...args) {
      if (this._avataryLbPanel?.isConnected) this._avataryLbPanel.remove();
      if (this.widgets)
        this.widgets = this.widgets.filter((w) => !w?._avataryLbPanelWidget);
      return origRemoved?.apply(this, args);
    };
  },
  loadedGraphNode(node) {
    const isTarget = node?.comfyClass === NODE_CLASS || node?.type === NODE_CLASS || node?.constructor?.type === NODE_CLASS;
    if (!isTarget) return;
    lockNodeSize(node);
    renderPanel2(node);
  }
});
function buildNodeIndex() {
  const map = /* @__PURE__ */ new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (n.comfyClass === NODE_CLASS || n.type === NODE_CLASS) {
        map.set(String(n.id), n);
      }
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app3.graph);
  return map;
}
function resolveNode(map, promptId) {
  const id = String(promptId);
  if (map.has(id)) return map.get(id);
  const tail = id.includes(":") ? id.slice(id.lastIndexOf(":") + 1) : null;
  if (tail && map.has(tail)) return map.get(tail);
  return null;
}
if (!app3._avataryLoadImagesGraphToPromptWrapped) {
  app3._avataryLoadImagesGraphToPromptWrapped = true;
  const _origGraphToPrompt3 = app3.graphToPrompt.bind(app3);
  app3.graphToPrompt = async (...args) => {
    const result = await _origGraphToPrompt3(...args);
    const out = result?.output;
    if (!out) return result;
    let index = null;
    for (const id in out) {
      const entry = out[id];
      if (!entry || entry.class_type !== NODE_CLASS) continue;
      if (!index) index = buildNodeIndex();
      const node = resolveNode(index, id);
      const state = node?.properties?.[STATE_KEY3] || {};
      entry.inputs = entry.inputs || {};
      entry.inputs[HIDDEN_INPUT_NAME] = JSON.stringify({
        subfolder: state.subfolder || MANAGED_SUBFOLDER,
        files: Array.isArray(state.files) ? state.files : [],
        mode: state.mode === "path" ? "path" : "upload",
        folder_path: String(state.folderPath || ""),
        source_dir: String(state.sourceDir || "")
      });
    }
    return result;
  };
}

// web-src/lora_stack_frontend.ts
import { app as app4 } from "/scripts/app.js";

// web-src/components/numberfield.ts
function createNumberField({
  value = 0,
  min,
  max,
  step,
  disabled = false,
  title = "",
  className = "",
  onInput,
  onChange
}) {
  const input = document.createElement("input");
  input.type = "number";
  const comfyClasses = [
    // Mirrors ComfyUI_frontend widget input conventions.
    "w-full",
    "min-w-0",
    "h-7",
    "rounded-lg",
    "border-none",
    "bg-component-node-widget-background",
    "text-component-node-foreground",
    "px-4",
    "text-xs",
    "outline-none",
    "transition-colors",
    "hover:bg-component-node-widget-background-hovered",
    "focus:bg-component-node-widget-background-hovered",
    "cursor-pointer"
  ].join(" ");
  input.className = `${comfyClasses} ${className}`.trim();
  input.value = String(value ?? 0);
  if (min !== void 0) input.min = String(min);
  if (max !== void 0) input.max = String(max);
  if (step !== void 0) input.step = String(step);
  input.disabled = disabled;
  if (title) input.title = title;
  input.addEventListener("input", () => onInput?.(Number(input.value)));
  input.addEventListener("change", () => onChange?.(Number(input.value)));
  return input;
}

// web-src/components/select.ts
var STYLE_ID2 = "avatary-select-component-styles";
function ensureSelectStyles() {
  if (document.getElementById(STYLE_ID2)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID2;
  style.textContent = `
    .avatary-select {
      min-width: 0;
      position: relative;
      width: 100%;
    }
    .avatary-select-trigger,
    .avatary-select-filter {
      box-sizing: border-box;
      min-width: 0;
      width: 100%;
      height: 28px;
      border: 0;
      background: var(--component-node-widget-background);
      color: var(--component-node-foreground);
      cursor: pointer;
      font-size: 12px;
      outline: none;
      padding: 0 12px;
      transition: background .12s ease;
    }
    .avatary-select-trigger {
      align-items: center;
      border-radius: 8px;
      display: flex;
      overflow: hidden;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .avatary-select-trigger:hover,
    .avatary-select-trigger:focus,
    .avatary-select-filter:hover,
    .avatary-select-filter:focus {
      background: var(--component-node-widget-background-hovered);
    }
    .avatary-select-menu {
      background: var(--comfy-menu-bg, #101010);
      border: 1px solid var(--p-form-field-border-color, #3c3c3c);
      border-radius: 0;
      box-shadow: 0 8px 24px rgba(0,0,0,.35);
      box-sizing: border-box;
      left: 0;
      margin-top: 4px;
      min-width: 100%;
      padding: 4px;
      position: absolute;
      right: 0;
      z-index: 10000;
    }
    .avatary-select-filter {
      background: var(--comfy-input-bg, #191919);
      border: 1px solid var(--p-primary-color, #60a5fa);
      border-radius: 0;
      cursor: text;
      margin-bottom: 6px;
      padding: 0 8px;
    }
    .avatary-select-heading {
      color: var(--component-node-foreground);
      font-size: 12px;
      line-height: 18px;
      padding: 0 0 4px;
      white-space: nowrap;
    }
    .avatary-select-options {
      max-height: 180px;
      overflow: auto;
    }
    .avatary-select-option {
      align-items: center;
      border-radius: 0;
      box-sizing: border-box;
      color: var(--component-node-foreground);
      cursor: pointer;
      display: flex;
      font-size: 12px;
      min-height: 24px;
      overflow: hidden;
      padding: 0 6px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .avatary-select-option:hover,
    .avatary-select-option.active {
      background: var(--component-node-widget-background-hovered);
      color: var(--component-node-foreground);
    }
    .avatary-select-empty {
      color: var(--component-node-foreground-secondary);
      cursor: default;
    }
  `;
  document.head.appendChild(style);
}
function normalizeOptions(options) {
  return options.map((option) => {
    const value = typeof option === "object" && option !== null ? option.value : option;
    const label = typeof option === "object" && option !== null ? option.label || option.value : option;
    return {
      value: String(value ?? ""),
      label: String(label ?? "")
    };
  });
}
function createSelect({
  options = [],
  value = "",
  disabled = false,
  title = "",
  chooserLabel = "Choose an option",
  filterPlaceholder = "Filter list",
  className = "",
  onChange
}) {
  ensureSelectStyles();
  const normalizedOptions = normalizeOptions(options);
  let selectedValue = String(value ?? "");
  let isOpen = false;
  let filteredOptions = [];
  let activeIndex = -1;
  const root = document.createElement("div");
  root.className = `avatary-select ${className}`.trim();
  if (title) root.title = title;
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "avatary-select-trigger";
  trigger.textContent = selectedValue;
  trigger.disabled = disabled;
  const menu = document.createElement("div");
  menu.className = "avatary-select-menu";
  menu.hidden = true;
  const filterInput = document.createElement("input");
  filterInput.type = "text";
  filterInput.className = "avatary-select-filter";
  filterInput.placeholder = filterPlaceholder;
  filterInput.disabled = disabled;
  filterInput.autocomplete = "off";
  filterInput.spellcheck = false;
  const heading = document.createElement("div");
  heading.className = "avatary-select-heading";
  heading.textContent = chooserLabel;
  const optionList = document.createElement("div");
  optionList.className = "avatary-select-options";
  menu.append(filterInput, heading, optionList);
  function close() {
    isOpen = false;
    menu.hidden = true;
    activeIndex = -1;
  }
  function renderOptions(filterText = "") {
    const filter = String(filterText || "").toLowerCase();
    filteredOptions = normalizedOptions.filter(
      (option) => option.label.toLowerCase().includes(filter) || option.value.toLowerCase().includes(filter)
    );
    optionList.innerHTML = "";
    if (!filteredOptions.length) {
      activeIndex = -1;
    } else {
      const selectedIndex = filteredOptions.findIndex(
        (option) => option.value === selectedValue
      );
      activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
    }
    if (!filteredOptions.length) {
      const empty = document.createElement("div");
      empty.className = "avatary-select-option avatary-select-empty";
      empty.textContent = "No matches";
      optionList.appendChild(empty);
      return;
    }
    for (const [index, option] of filteredOptions.entries()) {
      const item = document.createElement("div");
      item.className = "avatary-select-option";
      if (index === activeIndex) item.classList.add("active");
      item.dataset.index = String(index);
      item.textContent = option.label;
      item.title = option.label;
      item.addEventListener("mousedown", (event) => event.preventDefault());
      item.addEventListener("click", () => {
        selectedValue = option.value;
        trigger.textContent = selectedValue;
        close();
        onChange?.(selectedValue);
      });
      optionList.appendChild(item);
    }
  }
  function open() {
    if (disabled) return;
    isOpen = true;
    menu.hidden = false;
    filterInput.value = "";
    renderOptions("");
    requestAnimationFrame(() => filterInput.focus());
  }
  function updateActiveOption(nextIndex) {
    if (!filteredOptions.length) return;
    activeIndex = (nextIndex % filteredOptions.length + filteredOptions.length) % filteredOptions.length;
    for (const item of optionList.querySelectorAll(".avatary-select-option")) {
      const isActive = Number(item.dataset.index) === activeIndex;
      item.classList.toggle("active", isActive);
      if (isActive) item.scrollIntoView({ block: "nearest" });
    }
  }
  trigger.addEventListener("click", () => {
    if (isOpen) {
      close();
      return;
    }
    open();
  });
  filterInput.addEventListener("input", () => renderOptions(filterInput.value));
  filterInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      trigger.focus();
    }
    if (event.key === "Enter") {
      const activeOption = filteredOptions[activeIndex];
      if (activeOption) {
        event.preventDefault();
        selectedValue = activeOption.value;
        trigger.textContent = selectedValue;
        close();
        onChange?.(selectedValue);
      }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateActiveOption(activeIndex + 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      updateActiveOption(activeIndex - 1);
    }
  });
  const handleDocumentMouseDown = (event) => {
    if (!root.contains(event.target)) close();
  };
  document.addEventListener("mousedown", handleDocumentMouseDown);
  const cleanupTimer = setInterval(() => {
    if (root.isConnected) return;
    document.removeEventListener("mousedown", handleDocumentMouseDown);
    clearInterval(cleanupTimer);
  }, 1e3);
  root.append(trigger, menu);
  return root;
}

// web-src/lora_stack_frontend.ts
var NODE_CLASS2 = "AvataryLoraStack";
var STATE_INPUT = "LoraStackState";
var CATALOG_INPUT = "LoraCatalog";
var LEGACY_JSON_WIDGET = "lora_stack_json";
var LEGACY_CATALOG_WIDGET = "lora_catalog";
var STATE_KEY4 = "lora_stack_avatary_rows";
var DEFAULT_W = 420;
var STYLE_ID3 = "avatary-lora-stack-styles";
var NONE_LORA = "None";
var PANEL_PADDING_Y = 2;
var PANEL_GAP = 8;
var ROW_HEIGHT = 34;
var ROW_GAP = 6;
var EMPTY_HEIGHT = 34;
var ADD_BUTTON_HEIGHT = 28;
var NODE_VERTICAL_CHROME = 95;
function ensureStyles3() {
  if (document.getElementById(STYLE_ID3)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID3;
  style.textContent = `
		.avatary-lora-stack-panel {
			box-sizing: border-box;
			display: flex;
			flex-direction: column;
			gap: 8px;
			height: 100%;
			overflow: visible;
			padding: 1px;
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
			overflow: visible;
		}
		.avatary-lora-stack-row {
			align-items: center;
			box-sizing: border-box;
			display: grid;
			column-gap: 12px;
			grid-template-columns: 22px 38px minmax(0, 1fr) 72px 30px;
			min-height: 34px;
			padding: 0;
			position: relative;
		}
		.avatary-lora-stack-row.dragging {
			opacity: 0.55;
		}
		.avatary-lora-stack-row.drop-before::before,
		.avatary-lora-stack-row.drop-after::after {
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
		.avatary-lora-stack-row.drop-before::before {
			top: -4px;
		}
		.avatary-lora-stack-row.drop-after::after {
			bottom: -4px;
		}
		.avatary-lora-stack-handle {
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
		.avatary-lora-stack-remove {
			color: color-mix(in srgb, var(--component-node-foreground-secondary) 78%, white);
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
  return node?.comfyClass === NODE_CLASS2 || node?.type === NODE_CLASS2 || node?.constructor?.type === NODE_CLASS2;
}
function findWidget3(node, name) {
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
  const widget = findWidget3(node, CATALOG_INPUT);
  const rawValues = widget?.options?.values || widget?.options || widget?.values || widget?.type || [];
  const values = Array.isArray(rawValues) ? rawValues : [];
  return values.map((value) => String(value)).filter((value) => value && value !== NONE_LORA);
}
function normalizeRow(row) {
  const name = String(row?.name || "").trim();
  const fallbackStrength = typeof row?.strength_model === "number" ? row.strength_model : Number(row?.strength_model ?? 1);
  const strength = typeof row?.strength === "number" ? row.strength : Number(row?.strength ?? fallbackStrength);
  return {
    name,
    enabled: row?.enabled !== false,
    strength: Number.isFinite(strength) ? strength : 1
  };
}
function readRows(node) {
  if (!node) return [];
  const propertyRows = node.properties?.[STATE_KEY4];
  if (Array.isArray(propertyRows)) {
    return propertyRows.map(normalizeRow).filter((row) => row.name);
  }
  const widget = findWidget3(node, STATE_INPUT);
  try {
    const parsed = JSON.parse(String(widget?.value || "[]"));
    return Array.isArray(parsed) ? parsed.map(normalizeRow).filter((row) => row.name) : [];
  } catch (_error) {
    return [];
  }
}
function writeRows(node, rows) {
  if (!node.properties || typeof node.properties !== "object") {
    node.properties = {};
  }
  node.properties[STATE_KEY4] = rows.map(normalizeRow);
  node.setDirtyCanvas?.(true, true);
}
function migrateLegacyWidgets(node) {
  if (!node) return;
  const legacyState = findWidget3(node, LEGACY_JSON_WIDGET);
  if (!Array.isArray(node.properties?.[STATE_KEY4]) && legacyState?.value) {
    try {
      const parsed = JSON.parse(String(legacyState.value || "[]"));
      if (Array.isArray(parsed)) {
        writeRows(node, parsed);
      }
    } catch (_error) {
    }
  }
  if (node.widgets) {
    node.widgets = node.widgets.filter(
      (widget) => widget?.name !== LEGACY_JSON_WIDGET && widget?.name !== LEGACY_CATALOG_WIDGET && widget?.name !== STATE_INPUT && widget?.name !== CATALOG_INPUT
    );
  }
}
function ensurePanelWidget3(node) {
  if (node._avataryLoraStackPanel && node.widgets?.some((widget) => widget?._avataryLoraStackPanelWidget)) {
    return node._avataryLoraStackPanel;
  }
  if (node.widgets) {
    node.widgets = node.widgets.filter(
      (widget) => !widget?._avataryLoraStackPanelWidget
    );
  }
  ensureStyles3();
  ensureToggleStyles();
  const panel = document.createElement("div");
  panel.className = "avatary-lora-stack-panel";
  node._avataryLoraStackPanel = panel;
  if (typeof node.addDOMWidget === "function") {
    const widget = node.addDOMWidget("LoRAs", "lora_stack_panel", panel, {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => getPanelHeight2(node)
    });
    if (widget) {
      widget._avataryLoraStackPanelWidget = true;
      widget.serialize = false;
      return panel;
    }
  }
  return null;
}
function moveRowToInsertIndex(rows, fromIndex, insertIndex) {
  if (fromIndex < 0 || insertIndex < 0) return rows;
  const next = rows.slice();
  const [item] = next.splice(fromIndex, 1);
  const adjustedIndex = fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
  next.splice(Math.max(0, Math.min(next.length, adjustedIndex)), 0, item);
  return next;
}
function clearDropIndicators(list) {
  for (const row of list.querySelectorAll(".avatary-lora-stack-row")) {
    row.classList.remove("drop-before", "drop-after");
    delete row.dataset.dropPosition;
  }
}
function getPanelHeight2(node) {
  const rowCount = readRows(node).length;
  const listHeight = rowCount ? rowCount * ROW_HEIGHT + Math.max(0, rowCount - 1) * ROW_GAP : EMPTY_HEIGHT;
  return PANEL_PADDING_Y + listHeight + PANEL_GAP + ADD_BUTTON_HEIGHT;
}
function fitNodeHeight(node) {
  const width = Math.max(node.size?.[0] || 0, DEFAULT_W);
  const height = Math.max(140, getPanelHeight2(node) + NODE_VERTICAL_CHROME);
  if (typeof node.setSize === "function") {
    node.setSize([width, height]);
  } else {
    node.size[0] = width;
    node.size[1] = height;
  }
  node.graph?.setDirtyCanvas?.(true, true);
  app4.graph?.setDirtyCanvas?.(true, true);
}
function scheduleFitNodeHeight(node) {
  requestAnimationFrame(() => fitNodeHeight(node));
}
function renderPanel3(node) {
  migrateLegacyWidgets(node);
  const panel = ensurePanelWidget3(node);
  if (!panel) return;
  const catalog = getCatalog(node);
  const rows = readRows(node);
  panel.innerHTML = "";
  const list = document.createElement("div");
  list.className = "avatary-lora-stack-list";
  list.addEventListener("dragleave", (event) => {
    if (!list.contains(event.relatedTarget)) {
      clearDropIndicators(list);
    }
  });
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
      const rect = item.getBoundingClientRect();
      const position = event.clientY > rect.top + rect.height * 0.5 ? "after" : "before";
      clearDropIndicators(list);
      item.dataset.dropPosition = position;
      item.classList.add(position === "after" ? "drop-after" : "drop-before");
    });
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      const fromIndex = Number(event.dataTransfer.getData("text/plain"));
      const toIndex = Number(item.dataset.index);
      if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
      const insertIndex = item.dataset.dropPosition === "after" ? toIndex + 1 : toIndex;
      clearDropIndicators(list);
      writeRows(
        node,
        moveRowToInsertIndex(readRows(node), fromIndex, insertIndex)
      );
      renderPanel3(node);
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
        next[index].enabled = !next[index].enabled;
        writeRows(node, next);
        renderPanel3(node);
      }
    });
    toggle.addEventListener("pointerdown", (event) => event.stopPropagation());
    toggle.addEventListener("mousedown", (event) => event.stopPropagation());
    toggle.addEventListener("touchstart", (event) => event.stopPropagation());
    const options = catalog.includes(row.name) ? catalog : [row.name, ...catalog];
    const loraSelect = createSelect({
      options,
      value: row.name,
      title: "LoRA",
      chooserLabel: "Choose a lora",
      onChange: (value) => {
        const next = readRows(node);
        next[index].name = String(value || "").trim();
        writeRows(node, next);
        renderPanel3(node);
      }
    });
    const strength = createNumberField({
      value: row.strength,
      min: -20,
      max: 20,
      step: 0.05,
      title: "Strength",
      onChange: (value) => {
        const next = readRows(node);
        next[index].strength = value;
        writeRows(node, next);
        renderPanel3(node);
      }
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
      renderPanel3(node);
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
        strength: 1
      }
    ]);
    renderPanel3(node);
  });
  panel.appendChild(addButton);
  fitNodeHeight(node);
  scheduleFitNodeHeight(node);
}
function bindNode3(node) {
  if (!isTargetNode(node)) return;
  renderPanel3(node);
  setTimeout(() => renderPanel3(node), 80);
}
app4.registerExtension({
  name: "Avatary.LoraStack",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS2) return;
    nodeType.__avataryLoraCatalog = extractValuesFromInputSpec(
      nodeData?.input?.hidden?.[CATALOG_INPUT]
    );
    const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function(...args) {
      const result = originalOnNodeCreated?.apply(this, args);
      bindNode3(this);
      return result;
    };
    const originalOnConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function(...args) {
      const result = originalOnConfigure?.apply(this, args);
      bindNode3(this);
      return result;
    };
    const originalOnRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function(...args) {
      if (this._avataryLoraStackPanel?.isConnected) {
        this._avataryLoraStackPanel.remove();
      }
      this._avataryLoraStackPanel = null;
      if (this.widgets) {
        this.widgets = this.widgets.filter(
          (widget) => !widget?._avataryLoraStackPanelWidget
        );
      }
      return originalOnRemoved?.apply(this, args);
    };
  },
  loadedGraphNode(node) {
    bindNode3(node);
  }
});
function buildNodeIndex2() {
  const map = /* @__PURE__ */ new Map();
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
  visit(app4.graph);
  return map;
}
function resolveNode2(map, promptId) {
  const id = String(promptId);
  if (map.has(id)) return map.get(id);
  const tail = id.includes(":") ? id.slice(id.lastIndexOf(":") + 1) : null;
  if (tail && map.has(tail)) return map.get(tail);
  return null;
}
var _origGraphToPrompt = app4.graphToPrompt.bind(app4);
app4.graphToPrompt = async (...args) => {
  const result = await _origGraphToPrompt(...args);
  const out = result?.output;
  if (!out) return result;
  let index = null;
  for (const id in out) {
    const entry = out[id];
    if (!entry || entry.class_type !== NODE_CLASS2) continue;
    if (!index) index = buildNodeIndex2();
    const node = resolveNode2(index, id);
    entry.inputs = entry.inputs || {};
    entry.inputs[STATE_INPUT] = JSON.stringify(readRows(node));
  }
  return result;
};

// web-src/prompt_builder_frontend.ts
import { app as app5 } from "/scripts/app.js";

// web-src/components/textarea.ts
function createTextarea({
  value = "",
  placeholder = "",
  disabled = false,
  title = "",
  className = "",
  captureEvents = true,
  onInput,
  onChange
}) {
  const textarea = document.createElement("textarea");
  const comfyClasses = [
    "w-full",
    "min-w-0",
    "rounded-lg",
    "border-none",
    "bg-component-node-widget-background",
    "text-component-node-foreground",
    "px-4",
    "py-2",
    "text-xs",
    "outline-none",
    "transition-colors",
    "hover:bg-component-node-widget-background-hovered",
    "focus:bg-component-node-widget-background-hovered"
  ].join(" ");
  textarea.className = `${comfyClasses} ${className}`.trim();
  textarea.value = value;
  textarea.placeholder = placeholder;
  textarea.disabled = disabled;
  if (title) textarea.title = title;
  textarea.addEventListener("input", () => onInput?.(textarea.value));
  textarea.addEventListener("change", () => onChange?.(textarea.value));
  if (captureEvents) captureTextInputEvents(textarea);
  return textarea;
}

// web-src/prompt_builder_frontend.ts
var NODE_CLASS3 = "AvataryPromptBuilder";
var STATE_INPUT2 = "PromptBuilderState";
var STATE_KEY5 = "prompt_builder_avatary_sections";
var INPUT_PREFIX = "section_";
var MAX_SECTIONS = 64;
var DEFAULT_W2 = 460;
var STYLE_ID4 = "avatary-prompt-builder-styles";
var PANEL_PADDING_Y2 = 2;
var PANEL_GAP2 = 8;
var ROW_HEIGHT2 = 106;
var ROW_GAP2 = 8;
var TEXTAREA_DEFAULT_HEIGHT = 72;
var TEXTAREA_MIN_HEIGHT = 72;
var TEXTAREA_MAX_HEIGHT = 720;
var ROW_NON_TEXT_HEIGHT = ROW_HEIGHT2 - TEXTAREA_DEFAULT_HEIGHT;
var EMPTY_HEIGHT2 = 34;
var ADD_BUTTON_HEIGHT2 = 28;
var NODE_VERTICAL_CHROME2 = 95;
function ensureStyles4() {
  if (document.getElementById(STYLE_ID4)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID4;
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
function isTargetNode2(node) {
  return node?.comfyClass === NODE_CLASS3 || node?.type === NODE_CLASS3 || node?.constructor?.type === NODE_CLASS3;
}
function findWidget4(node, name) {
  return (node.widgets || []).find((widget) => widget?.name === name);
}
function inputKeyForIndex(index) {
  return `${INPUT_PREFIX}${index}`;
}
function isSectionInputName(name) {
  const match = String(name || "").match(/^section_(\d+)$/);
  return Boolean(match && Number(match[1]) >= 1 && Number(match[1]) <= MAX_SECTIONS);
}
function coerceTextHeight(value) {
  const height = Number(value);
  if (!Number.isFinite(height) || height <= 0) {
    return TEXTAREA_DEFAULT_HEIGHT;
  }
  return Math.max(TEXTAREA_MIN_HEIGHT, Math.min(TEXTAREA_MAX_HEIGHT, Math.round(height)));
}
function normalizeRow2(row, fallbackIndex = 0, usedKeys = /* @__PURE__ */ new Set()) {
  let inputKey = String(row?.input_key || "").trim();
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
    name: String(row?.name || "").trim() || `Section ${fallbackIndex + 1}`,
    text: String(row?.text || ""),
    text_height: coerceTextHeight(row?.text_height),
    input_key: inputKey
  };
}
function normalizeRows(rows) {
  const usedKeys = /* @__PURE__ */ new Set();
  return (Array.isArray(rows) ? rows : []).slice(0, MAX_SECTIONS).map((row, index) => normalizeRow2(row, index, usedKeys)).filter((row) => row.input_key);
}
function readRows2(node) {
  if (!node) return [];
  const propertyRows = node.properties?.[STATE_KEY5];
  if (Array.isArray(propertyRows)) {
    return normalizeRows(propertyRows);
  }
  const widget = findWidget4(node, STATE_INPUT2);
  try {
    const parsed = JSON.parse(String(widget?.value || "[]"));
    return normalizeRows(parsed);
  } catch (_error) {
    return [];
  }
}
function writeRows2(node, rows) {
  if (!node.properties || typeof node.properties !== "object") {
    node.properties = {};
  }
  node.properties[STATE_KEY5] = normalizeRows(rows);
  syncInputs(node);
  node.setDirtyCanvas?.(true, true);
}
function writeRowTextHeight(node, index, height) {
  const next = readRows2(node);
  if (!next[index]) return;
  const nextHeight = coerceTextHeight(height);
  if (next[index].text_height === nextHeight) return;
  next[index].text_height = nextHeight;
  writeRows2(node, next);
  scheduleFitNodeHeight2(node);
}
function bindTextareaHeightPersistence(node, index, textarea) {
  let pointerStartedInTextarea = false;
  const saveHeight = () => {
    if (!pointerStartedInTextarea) return;
    pointerStartedInTextarea = false;
    writeRowTextHeight(node, index, textarea.offsetHeight);
  };
  textarea.addEventListener("pointerdown", () => {
    pointerStartedInTextarea = true;
  });
  textarea.addEventListener("mouseup", saveHeight);
  window.addEventListener("pointerup", saveHeight, { capture: true });
}
function inputDisplayName(row, index) {
  const name = String(row?.name || "").trim();
  return name || `Section ${index + 1}`;
}
function clearDropIndicators2(list) {
  for (const row of list.querySelectorAll(".avatary-prompt-builder-row")) {
    row.classList.remove("drop-before", "drop-after");
    delete row.dataset.dropPosition;
  }
}
function moveRowToInsertIndex2(rows, fromIndex, insertIndex) {
  if (fromIndex < 0 || insertIndex < 0) return rows;
  const next = rows.slice();
  const [item] = next.splice(fromIndex, 1);
  const adjustedIndex = fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
  next.splice(Math.max(0, Math.min(next.length, adjustedIndex)), 0, item);
  return next;
}
function syncInputs(node) {
  if (!node) return;
  const rows = readRows2(node);
  const existing = Array.isArray(node.inputs) ? node.inputs : [];
  const claimedInputs = /* @__PURE__ */ new Set();
  const findExistingInput = (row, index) => {
    const displayName = inputDisplayName(row, index);
    const matchers = [
      (input) => (input?._avataryPromptBuilderInputKey || "") === row.input_key,
      (input) => String(input?.name || "") === row.input_key,
      (input) => String(input?.name || "") === displayName
    ];
    for (const matcher of matchers) {
      const input = existing.find(
        (candidate) => !claimedInputs.has(candidate) && matcher(candidate)
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
    if (!stillNeeded && typeof node.removeInput === "function") {
      try {
        node.removeInput(index);
      } catch (_error) {
      }
    }
  }
  const orderedSectionInputs = rows.map((row, index) => {
    const displayName = inputDisplayName(row, index);
    const input = findExistingInput(row, index) || {
      name: displayName,
      type: "STRING",
      link: null
    };
    input.name = displayName;
    input.type = "STRING";
    input._avataryPromptBuilderInputKey = row.input_key;
    input._avataryPromptBuilderSectionInput = true;
    return input;
  });
  node.inputs = orderedSectionInputs;
  node.graph?.setDirtyCanvas?.(true, true);
  app5.graph?.setDirtyCanvas?.(true, true);
}
function migrateWidgets(node) {
  if (!node) return;
  if (node.widgets) {
    node.widgets = node.widgets.filter((widget) => widget?.name !== STATE_INPUT2);
  }
}
function ensurePanelWidget4(node) {
  if (node._avataryPromptBuilderPanel && node.widgets?.some((widget) => widget?._avataryPromptBuilderPanelWidget)) {
    return node._avataryPromptBuilderPanel;
  }
  if (node.widgets) {
    node.widgets = node.widgets.filter(
      (widget) => !widget?._avataryPromptBuilderPanelWidget
    );
  }
  ensureStyles4();
  const panel = document.createElement("div");
  panel.className = "avatary-prompt-builder-panel";
  node._avataryPromptBuilderPanel = panel;
  if (typeof node.addDOMWidget === "function") {
    const widget = node.addDOMWidget("Sections", "prompt_builder_panel", panel, {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => getPanelHeight3(node)
    });
    if (widget) {
      widget._avataryPromptBuilderPanelWidget = true;
      widget.serialize = false;
      return panel;
    }
  }
  return null;
}
function getPanelHeight3(node) {
  const rows = readRows2(node);
  const listHeight = rows.length ? rows.reduce(
    (total, row) => total + ROW_NON_TEXT_HEIGHT + coerceTextHeight(row.text_height),
    0
  ) + Math.max(0, rows.length - 1) * ROW_GAP2 : EMPTY_HEIGHT2;
  return PANEL_PADDING_Y2 + listHeight + PANEL_GAP2 + ADD_BUTTON_HEIGHT2;
}
function fitNodeHeight2(node) {
  const width = Math.max(node.size?.[0] || 0, DEFAULT_W2);
  const height = Math.max(150, getPanelHeight3(node) + NODE_VERTICAL_CHROME2);
  if (typeof node.setSize === "function") {
    node.setSize([width, height]);
  } else if (Array.isArray(node.size)) {
    node.size[0] = width;
    node.size[1] = height;
  }
  node.graph?.setDirtyCanvas?.(true, true);
  app5.graph?.setDirtyCanvas?.(true, true);
}
function scheduleFitNodeHeight2(node) {
  requestAnimationFrame(() => fitNodeHeight2(node));
}
function renderPanel4(node) {
  migrateWidgets(node);
  const panel = ensurePanelWidget4(node);
  if (!panel) return;
  syncInputs(node);
  const rows = readRows2(node);
  panel.innerHTML = "";
  const list = document.createElement("div");
  list.className = "avatary-prompt-builder-list";
  list.addEventListener("dragleave", (event) => {
    if (!list.contains(event.relatedTarget)) {
      clearDropIndicators2(list);
    }
  });
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "avatary-prompt-builder-empty";
    empty.textContent = "Add sections to build a prompt.";
    list.appendChild(empty);
  }
  for (const [index, row] of rows.entries()) {
    const item = document.createElement("div");
    item.className = "avatary-prompt-builder-row";
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
      const rect = item.getBoundingClientRect();
      const position = event.clientY > rect.top + rect.height * 0.5 ? "after" : "before";
      clearDropIndicators2(list);
      item.dataset.dropPosition = position;
      item.classList.add(position === "after" ? "drop-after" : "drop-before");
    });
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      const fromIndex = Number(event.dataTransfer.getData("text/plain"));
      const toIndex = Number(item.dataset.index);
      if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
      const insertIndex = item.dataset.dropPosition === "after" ? toIndex + 1 : toIndex;
      clearDropIndicators2(list);
      writeRows2(
        node,
        moveRowToInsertIndex2(readRows2(node), fromIndex, insertIndex)
      );
      renderPanel4(node);
    });
    const handle = document.createElement("div");
    handle.className = "avatary-prompt-builder-handle";
    handle.title = "Drag to reorder";
    handle.textContent = "::";
    const fields = document.createElement("div");
    fields.className = "avatary-prompt-builder-fields";
    const name = createTextfield({
      value: row.name,
      placeholder: `Section ${index + 1}`,
      title: "Section name",
      onInput: (value) => {
        const next = readRows2(node);
        next[index].name = value;
        writeRows2(node, next);
      }
    });
    const text = createTextarea({
      value: row.text,
      placeholder: "Default string",
      title: "Default string",
      className: "avatary-prompt-builder-text",
      onInput: (value) => {
        const next = readRows2(node);
        next[index].text = value;
        writeRows2(node, next);
      }
    });
    text.style.height = `${coerceTextHeight(row.text_height)}px`;
    bindTextareaHeightPersistence(node, index, text);
    fields.append(name, text);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "avatary-prompt-builder-button avatary-prompt-builder-remove";
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
      const next = readRows2(node);
      next.splice(index, 1);
      writeRows2(node, next);
      renderPanel4(node);
    });
    item.append(handle, fields, remove);
    list.appendChild(item);
  }
  panel.appendChild(list);
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "avatary-prompt-builder-button avatary-prompt-builder-add";
  addButton.disabled = rows.length >= MAX_SECTIONS;
  addButton.innerHTML = rows.length >= MAX_SECTIONS ? "<span>Maximum sections reached</span>" : `
			<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M5 12h14"></path>
				<path d="M12 5v14"></path>
			</svg>
			<span>Add Section</span>
		`;
  addButton.addEventListener("click", () => {
    const next = readRows2(node);
    if (next.length >= MAX_SECTIONS) return;
    writeRows2(node, [
      ...next,
      normalizeRow2(
        {
          name: `Section ${next.length + 1}`,
          text: "",
          input_key: ""
        },
        next.length,
        new Set(next.map((row) => row.input_key))
      )
    ]);
    renderPanel4(node);
  });
  panel.appendChild(addButton);
  fitNodeHeight2(node);
  scheduleFitNodeHeight2(node);
}
function bindNode4(node) {
  if (!isTargetNode2(node)) return;
  renderPanel4(node);
  setTimeout(() => renderPanel4(node), 80);
}
app5.registerExtension({
  name: "Avatary.PromptBuilder",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS3) return;
    const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function(...args) {
      const result = originalOnNodeCreated?.apply(this, args);
      bindNode4(this);
      return result;
    };
    const originalOnConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function(...args) {
      const result = originalOnConfigure?.apply(this, args);
      bindNode4(this);
      return result;
    };
    const originalOnRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function(...args) {
      if (this._avataryPromptBuilderPanel?.isConnected) {
        this._avataryPromptBuilderPanel.remove();
      }
      this._avataryPromptBuilderPanel = null;
      if (this.widgets) {
        this.widgets = this.widgets.filter(
          (widget) => !widget?._avataryPromptBuilderPanelWidget
        );
      }
      return originalOnRemoved?.apply(this, args);
    };
  },
  loadedGraphNode(node) {
    bindNode4(node);
  }
});
function buildNodeIndex3() {
  const map = /* @__PURE__ */ new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (isTargetNode2(n)) {
        map.set(String(n.id), n);
      }
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app5.graph);
  return map;
}
function resolveNode3(map, promptId) {
  const id = String(promptId);
  if (map.has(id)) return map.get(id);
  const tail = id.includes(":") ? id.slice(id.lastIndexOf(":") + 1) : null;
  if (tail && map.has(tail)) return map.get(tail);
  return null;
}
var _origGraphToPrompt2 = app5.graphToPrompt.bind(app5);
app5.graphToPrompt = async (...args) => {
  const result = await _origGraphToPrompt2(...args);
  const out = result?.output;
  if (!out) return result;
  let index = null;
  for (const id in out) {
    const entry = out[id];
    if (!entry || entry.class_type !== NODE_CLASS3) continue;
    if (!index) index = buildNodeIndex3();
    const node = resolveNode3(index, id);
    const rows = readRows2(node);
    entry.inputs = entry.inputs || {};
    entry.inputs[STATE_INPUT2] = JSON.stringify(rows);
    for (let sectionIndex = 1; sectionIndex <= MAX_SECTIONS; sectionIndex += 1) {
      delete entry.inputs[inputKeyForIndex(sectionIndex)];
    }
    for (const [rowIndex, row] of rows.entries()) {
      const input = node?.inputs?.[rowIndex];
      if (!input || input.link == null) continue;
      const linkedValue = entry.inputs[input.name];
      delete entry.inputs[input.name];
      if (linkedValue !== void 0) {
        entry.inputs[row.input_key] = linkedValue;
      }
    }
  }
  return result;
};

// web-src/string_concatenate_frontend.ts
import { app as app6 } from "/scripts/app.js";
var NODE_CLASS4 = "AvataryStringConcatenate";
var INPUT_PREFIX2 = "string_";
var MAX_INPUTS = 64;
var DEFAULT_W3 = 340;
var NODE_VERTICAL_CHROME3 = 120;
function isTargetNode3(node) {
  return node?.comfyClass === NODE_CLASS4 || node?.type === NODE_CLASS4 || node?.constructor?.type === NODE_CLASS4;
}
function inputKeyForIndex2(index) {
  return `${INPUT_PREFIX2}${index}`;
}
function indexFromInputName(name) {
  const match = String(name || "").match(/^string_(\d+)$/);
  if (!match) return 0;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 1 && index <= MAX_INPUTS ? index : 0;
}
function getLinkForInput(input) {
  if (!input) return null;
  if (input.link != null) return input.link;
  if (Array.isArray(input.links) && input.links.length) return input.links[0];
  return null;
}
function isInputConnected(input) {
  return getLinkForInput(input) != null;
}
function visibleCountForExistingInputs(inputs) {
  let highestConnected = 0;
  for (const input of inputs || []) {
    const index = indexFromInputName(input?._avataryStringConcatInputKey || input?.name);
    if (!index || !isInputConnected(input)) continue;
    highestConnected = Math.max(highestConnected, index);
  }
  return Math.min(MAX_INPUTS, highestConnected + 1 || 1);
}
function syncInputs2(node) {
  if (!node) return;
  const existing = Array.isArray(node.inputs) ? node.inputs : [];
  const visibleCount = visibleCountForExistingInputs(existing);
  const existingByIndex = /* @__PURE__ */ new Map();
  for (const input of existing) {
    const index = indexFromInputName(input?._avataryStringConcatInputKey || input?.name);
    if (!index) continue;
    const current = existingByIndex.get(index);
    if (!current || isInputConnected(input)) {
      existingByIndex.set(index, input);
    }
  }
  const dynamicInputs = [];
  for (let index = 1; index <= visibleCount; index += 1) {
    const inputKey = inputKeyForIndex2(index);
    const input = existingByIndex.get(index) || {
      name: inputKey,
      type: "STRING",
      link: null
    };
    input.name = inputKey;
    input.type = "STRING";
    input._avataryStringConcatInputKey = inputKey;
    dynamicInputs.push(input);
  }
  node.inputs = dynamicInputs;
  node.graph?.setDirtyCanvas?.(true, true);
  app6.graph?.setDirtyCanvas?.(true, true);
}
function fitNodeHeight3(node) {
  const width = Math.max(node.size?.[0] || 0, DEFAULT_W3);
  const inputCount = Math.max(1, node.inputs?.length || 1);
  const inputHeight = inputCount * 26 + 48;
  const height = Math.max(150, inputHeight + NODE_VERTICAL_CHROME3);
  if (typeof node.setSize === "function") {
    node.setSize([width, height]);
  } else if (Array.isArray(node.size)) {
    node.size[0] = width;
    node.size[1] = height;
  }
  node.graph?.setDirtyCanvas?.(true, true);
  app6.graph?.setDirtyCanvas?.(true, true);
}
function refreshNode3(node) {
  if (!isTargetNode3(node)) return;
  syncInputs2(node);
  fitNodeHeight3(node);
}
function bindNode5(node) {
  refreshNode3(node);
  setTimeout(() => refreshNode3(node), 80);
}
app6.registerExtension({
  name: "Avatary.StringConcatenate",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS4) return;
    const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function(...args) {
      const result = originalOnNodeCreated?.apply(this, args);
      bindNode5(this);
      return result;
    };
    const originalOnConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function(...args) {
      const result = originalOnConfigure?.apply(this, args);
      bindNode5(this);
      return result;
    };
    const originalOnConnectionsChange = nodeType.prototype.onConnectionsChange;
    nodeType.prototype.onConnectionsChange = function(...args) {
      const result = originalOnConnectionsChange?.apply(this, args);
      requestAnimationFrame(() => refreshNode3(this));
      return result;
    };
  },
  loadedGraphNode(node) {
    bindNode5(node);
  }
});
