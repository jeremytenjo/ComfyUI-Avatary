// web-src/download_to_directory.ts
(() => {
  const DIALOG_ID = "download-to-directory-dialog";
  const BUTTON_ID = "download-to-directory-button";
  const RECENT_FOLDERS_KEY = "download-to-directory-recent-folders-v1";
  const ADVANCED_OPEN_KEY = "download-to-directory-advanced-open-v1";
  const HISTORY_KEY = "download-to-directory-history-v1";
  const HF_TOKEN_KEY = "download-to-directory-hf-token-v1";
  const MAX_RECENT_FOLDERS = 8;
  const MAX_HISTORY_ITEMS = 100;
  const HOT_RELOAD_POLL_MS = 800;
  const state = {
    apiPrefix: "/api",
    roots: [],
    toggleEl: null,
    dialogEl: null,
    historyEntries: [],
    missingNodes: [],
    unknownNodes: [],
    missingCheckBusy: false,
    installBusy: false,
    manualSourceOverrides: {},
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
  function ensureStyles2() {
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
      #${DIALOG_ID} #dtd-missing-warning {
        width: fit-content;
        min-width: 0;
        padding: 8px 10px;
        display: none;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, #f5bf2c 20%, var(--p-surface-900, #1a1f27));
        border-color: color-mix(in srgb, #f5bf2c 70%, var(--p-content-border-color, #434958));
        color: #ffd36a;
      }
      #${DIALOG_ID} #dtd-missing-warning.visible {
        display: inline-flex;
      }
      #${DIALOG_ID} #dtd-missing-warning:hover {
        filter: brightness(1.08);
      }
      #${DIALOG_ID} #dtd-missing-warning i {
        font-size: 15px;
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
      #${DIALOG_ID} #dtd-upload-path-confirm {
        background: var(--p-primary-color, #2587f9);
        border-color: color-mix(in srgb, var(--p-primary-color, #2587f9) 68%, #ffffff 32%);
        color: #ffffff;
      }
      #${DIALOG_ID} #dtd-upload-path-confirm:hover {
        filter: brightness(1.08);
      }
      #${DIALOG_ID} .missing-modal {
        position: fixed;
        inset: 0;
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(8, 10, 14, 0.72);
      }
      #${DIALOG_ID} .missing-modal[hidden] {
        display: none;
      }
      #${DIALOG_ID} .missing-card {
        width: min(720px, calc(100vw - 48px));
        max-height: calc(100vh - 72px);
        border-radius: 14px;
        border: 1px solid var(--p-content-border-color, #434958);
        background: var(--p-surface-900, #141922);
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.45);
        padding: 14px;
        overflow: auto;
      }
      #${DIALOG_ID} .missing-title {
        margin: 0 0 8px 0;
        font-size: 17px;
        line-height: 1.25;
        font-weight: 700;
      }
      #${DIALOG_ID} .missing-copy {
        margin: 0;
        font-size: 13px;
        line-height: 1.4;
        color: var(--p-text-muted-color, #a8afbd);
      }
      #${DIALOG_ID} .missing-list {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #${DIALOG_ID} .missing-progress {
        margin-top: 12px;
        border: 1px solid var(--p-content-border-color, #434958);
        border-radius: 10px;
        background: var(--p-surface-800, #232831);
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #${DIALOG_ID} .missing-progress-title {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
      }
      #${DIALOG_ID} .missing-progress-sub {
        margin: 0;
        font-size: 12px;
        color: var(--p-text-muted-color, #a8afbd);
        overflow-wrap: anywhere;
      }
      #${DIALOG_ID} .missing-progress progress {
        width: 100%;
        height: 12px;
      }
      #${DIALOG_ID} .missing-row {
        border: 1px solid var(--p-content-border-color, #434958);
        border-radius: 10px;
        background: var(--p-surface-800, #232831);
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #${DIALOG_ID} .missing-row-name {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: var(--p-text-color, #f5f7fb);
      }
      #${DIALOG_ID} .missing-row-meta {
        margin: 0;
        font-size: 12px;
        line-height: 1.35;
        color: var(--p-text-muted-color, #a8afbd);
      }
      #${DIALOG_ID} .missing-row-meta a {
        color: #7db9ff;
      }
      #${DIALOG_ID} .missing-row-meta b {
        color: #ffd36a;
      }
      #${DIALOG_ID} .missing-row-url {
        margin-top: 4px;
        height: 34px;
        font-size: 12px;
        border-radius: 8px;
        background: var(--p-surface-900, #1a1f27);
      }
      #${DIALOG_ID} .missing-row-url:disabled {
        opacity: 0.6;
      }
      #${DIALOG_ID} .missing-unknown {
        margin-top: 12px;
        border-top: 1px solid var(--p-content-border-color, #434958);
        padding-top: 10px;
      }
      #${DIALOG_ID} .missing-unknown h4 {
        margin: 0 0 6px 0;
        font-size: 13px;
      }
      #${DIALOG_ID} .missing-unknown ul {
        margin: 0;
        padding-left: 18px;
        color: var(--p-text-muted-color, #a8afbd);
        font-size: 12px;
      }
      #${DIALOG_ID} .missing-actions {
        margin-top: 12px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      #${DIALOG_ID} .missing-actions button {
        width: auto;
        min-width: 110px;
        height: 36px;
        padding: 8px 12px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 600;
      }
      #${DIALOG_ID} #dtd-missing-install {
        background: var(--p-primary-color, #2587f9);
        border-color: color-mix(in srgb, var(--p-primary-color, #2587f9) 68%, #ffffff 32%);
        color: #ffffff;
      }
      #${DIALOG_ID} #dtd-missing-restart {
        display: none;
        background: var(--p-surface-800, #232831);
        border-color: var(--p-content-border-color, #434958);
        color: var(--p-text-color, #f5f7fb);
      }
      #${DIALOG_ID} #dtd-missing-restart.visible {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      #${DIALOG_ID} #dtd-missing-restart:hover {
        background: var(--p-surface-700, #2c323d);
      }
      #${DIALOG_ID} #dtd-missing-install:disabled {
        opacity: 0.6;
        cursor: not-allowed;
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
  function collectCurrentWorkflowJson() {
    try {
      const graph = window.app?.graph;
      if (!graph?.serialize) return null;
      const workflow = graph.serialize();
      return workflow && typeof workflow === "object" ? workflow : null;
    } catch {
      return null;
    }
  }
  function isIgnoredUnknownNodeName(raw) {
    const value = String(raw || "").trim();
    if (!value) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )) {
      return true;
    }
    if (/^[0-9a-f]{32}$/i.test(value)) {
      return true;
    }
    return false;
  }
  function collectMissingNodeTypesFromGraph() {
    try {
      const graphNodes = Array.isArray(window.app?.graph?._nodes) ? window.app.graph._nodes : [];
      if (graphNodes.length === 0) return [];
      const registeredTypes = new Set(
        Object.keys(window.LiteGraph?.registered_node_types || {})
      );
      const virtualNodeTypes = /* @__PURE__ */ new Set(["Reroute", "Note"]);
      const missing = /* @__PURE__ */ new Set();
      for (const node of graphNodes) {
        const typeName = String(node?.type || "").trim();
        if (!typeName) continue;
        if (virtualNodeTypes.has(typeName)) continue;
        if (isIgnoredUnknownNodeName(typeName)) continue;
        if (!registeredTypes.has(typeName)) {
          missing.add(typeName);
        }
      }
      return Array.from(missing).sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }
  function normalizeMissingState(raw) {
    const value = String(raw || "").trim().toLowerCase();
    if (!value) return "unknown";
    return value;
  }
  function setMissingNodeData(payload) {
    const missing = Array.isArray(payload?.missing) ? payload.missing : [];
    const unknown = Array.isArray(payload?.unknown_nodes) ? payload.unknown_nodes : [];
    state.missingNodes = missing.map((entry) => {
      const sourceUrl = String(entry?.source_url || "").trim();
      const displayName = String(entry?.display_name || "").trim() || "unknown";
      const key = String(entry?.key || "").trim() || sourceUrl || displayName;
      return {
        key,
        display_name: displayName,
        source_url: sourceUrl,
        state: normalizeMissingState(entry?.state),
        install_target: String(entry?.install_target || "").trim() || sourceUrl || displayName
      };
    });
    state.unknownNodes = unknown.map((item) => String(item || "").trim()).filter((item) => item && !isIgnoredUnknownNodeName(item));
    updateMissingWarningVisibility();
    renderMissingNodesModalContent();
  }
  function updateMissingWarningVisibility() {
    const warningButton = document.getElementById("dtd-missing-warning");
    if (!warningButton) return;
    const count = Number(state.missingNodes.length || 0) + Number(state.unknownNodes.length || 0);
    const visible = count > 0;
    warningButton.classList.toggle("visible", visible);
    warningButton.hidden = !visible;
    warningButton.setAttribute(
      "aria-label",
      visible ? `${count} missing workflow node${count === 1 ? "" : "s"}` : "No missing custom nodes"
    );
    warningButton.title = visible ? `${count} missing workflow node${count === 1 ? "" : "s"}` : "";
  }
  function renderMissingNodesModalContent() {
    const body = document.getElementById("dtd-missing-body");
    const installButton = document.getElementById("dtd-missing-install");
    const restartButton = document.getElementById("dtd-missing-restart");
    if (!body) return;
    const disableInputs = state.installBusy;
    const progress = state.installProgress || null;
    const progressPercent = Math.max(
      0,
      Math.min(100, Number(progress?.progress_percent || 0))
    );
    const progressCompleted = Number(progress?.completed_targets || 0);
    const progressFailed = Number(progress?.failed_targets || 0);
    const progressTotal = Number(progress?.total_targets || 0);
    const progressCurrent = String(progress?.current_target || "").trim();
    const progressStatus = String(progress?.status || "").trim() || "idle";
    const progressMarkup = state.installBusy || progress ? `
      <div class="missing-progress">
        <p class="missing-progress-title">Install Progress: ${escapeHtml(progressCompleted)}/${escapeHtml(progressTotal || 0)} complete</p>
        <p class="missing-progress-sub">Status: ${escapeHtml(progressStatus)}${progressCurrent ? ` | Current: ${escapeHtml(progressCurrent)}` : ""}</p>
        <p class="missing-progress-sub">Succeeded: ${escapeHtml(progressCompleted)} | Failed: ${escapeHtml(progressFailed)}</p>
        <progress value="${escapeHtml(progressPercent)}" max="100"></progress>
      </div>
    ` : "";
    const missingMarkup = state.missingNodes.length ? state.missingNodes.map((entry) => {
      const sourceUrl = String(entry.source_url || "").trim();
      const stateText = escapeHtml(entry.state || "unknown");
      const heading = escapeHtml(entry.display_name || "unknown");
      const sourceMarkup = sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceUrl)}</a>` : "<b>source unavailable</b>";
      const disabledAttr = disableInputs ? "disabled" : "";
      const manualInput = sourceUrl.length > 0 ? "" : `<input class="missing-row-url" type="text" data-action="manual-source" data-key="${escapeHtml(entry.key)}" value="${escapeHtml(state.manualSourceOverrides[entry.key] || "")}" placeholder="Enter git URL for this node (optional)" ${disabledAttr} />`;
      return `
              <div class="missing-row">
                <p class="missing-row-name">${heading}</p>
                <p class="missing-row-meta">State: <b>${stateText}</b></p>
                <p class="missing-row-meta">Source: ${sourceMarkup}</p>
                ${manualInput}
              </div>
            `;
    }).join("") : '<p class="missing-copy">No missing custom nodes detected.</p>';
    const unknownMarkup = state.unknownNodes.length ? `
        <div class="missing-unknown">
          <h4>Unknown Node Classes</h4>
          <div class="missing-list">
            ${state.unknownNodes.map((name) => {
      const key = `unknown:${name}`;
      const value = String(state.manualSourceOverrides[key] || "");
      const disabledAttr = disableInputs ? "disabled" : "";
      return `
                  <div class="missing-row">
                    <p class="missing-row-name">${escapeHtml(name)}</p>
                    <p class="missing-row-meta">Source: <b>source unavailable</b></p>
                    <input class="missing-row-url" type="text" data-action="manual-source" data-key="${escapeHtml(key)}" value="${escapeHtml(value)}" placeholder="Enter git URL for this node (optional)" ${disabledAttr} />
                  </div>
                `;
    }).join("")}
          </div>
        </div>
      ` : "";
    body.innerHTML = `
      <p class="missing-copy">Install missing custom nodes for the currently open workflow.</p>
      ${progressMarkup}
      <div class="missing-list">${missingMarkup}</div>
      ${unknownMarkup}
    `;
    if (installButton) {
      const canInstall = buildMissingInstallTargets().length > 0 && !state.installBusy;
      installButton.disabled = !canInstall;
      installButton.textContent = state.installBusy ? "Installing..." : "Install Missing Nodes";
    }
    if (restartButton) {
      const showRestart = !state.installBusy && String(progressStatus || "").toLowerCase() === "completed" && progressCompleted > 0;
      restartButton.classList.toggle("visible", showRestart);
      restartButton.hidden = !showRestart;
    }
  }
  function refreshMissingActionButtons() {
    const installButton = document.getElementById("dtd-missing-install");
    const restartButton = document.getElementById("dtd-missing-restart");
    if (installButton) {
      const canInstall = buildMissingInstallTargets().length > 0 && !state.installBusy;
      installButton.disabled = !canInstall;
      installButton.textContent = state.installBusy ? "Installing..." : "Install Missing Nodes";
    }
    if (restartButton) {
      const progress = state.installProgress || null;
      const showRestart = !state.installBusy && String(progress?.status || "").toLowerCase() === "completed" && Number(progress?.completed_targets || 0) > 0;
      restartButton.classList.toggle("visible", showRestart);
      restartButton.hidden = !showRestart;
    }
  }
  function openMissingNodesModal() {
    const modal = document.getElementById("dtd-missing-modal");
    if (!modal) return;
    modal.hidden = false;
    renderMissingNodesModalContent();
  }
  function closeMissingNodesModal() {
    const modal = document.getElementById("dtd-missing-modal");
    if (!modal) return;
    modal.hidden = true;
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
      `/download-to-dir/missing-nodes/install-progress/${encodeURIComponent(jobId)}`,
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
    renderMissingNodesModalContent();
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
  async function refreshMissingNodes({ silent = false } = {}) {
    if (state.missingCheckBusy) return;
    const workflow = collectCurrentWorkflowJson();
    if (!workflow) {
      setMissingNodeData({ missing: [], unknown_nodes: [] });
      return;
    }
    state.missingCheckBusy = true;
    try {
      const response = await apiFetch(
        "/download-to-dir/missing-nodes/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ workflow })
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason = String(data?.reason || data?.error || data?.stderr || "").trim() || `Failed to analyze workflow dependencies (${response.status})`;
        throw new Error(reason);
      }
      setMissingNodeData(data);
      if (state.missingNodes.length === 0 && state.unknownNodes.length === 0) {
        const graphMissing = collectMissingNodeTypesFromGraph();
        if (graphMissing.length > 0) {
          setMissingNodeData({ missing: [], unknown_nodes: graphMissing });
        }
      }
    } catch (err) {
      const graphMissing = collectMissingNodeTypesFromGraph();
      if (graphMissing.length > 0) {
        setMissingNodeData({ missing: [], unknown_nodes: graphMissing });
        return;
      }
      if (!silent) {
        setStatus(err?.message || String(err), "error");
      }
    } finally {
      state.missingCheckBusy = false;
      renderMissingNodesModalContent();
    }
  }
  function buildMissingInstallTargets() {
    const targets = [];
    const seen = /* @__PURE__ */ new Set();
    for (const entry of state.missingNodes) {
      const sourceUrl = String(entry.source_url || "").trim();
      const manualSource = String(
        state.manualSourceOverrides[entry.key] || ""
      ).trim();
      const target = sourceUrl || manualSource;
      if (!target || seen.has(target)) continue;
      seen.add(target);
      targets.push(target);
    }
    for (const unknownName of state.unknownNodes) {
      const key = `unknown:${unknownName}`;
      const manualSource = String(
        state.manualSourceOverrides[key] || ""
      ).trim();
      if (!manualSource || seen.has(manualSource)) continue;
      seen.add(manualSource);
      targets.push(manualSource);
    }
    return targets;
  }
  async function handleInstallMissingNodes() {
    if (state.installBusy) return;
    const targets = buildMissingInstallTargets();
    if (targets.length === 0) {
      setStatus(
        "No install targets available. Add git URLs for rows with unavailable source.",
        "error"
      );
      return;
    }
    state.installBusy = true;
    state.installJobId = "";
    state.installResults = [];
    state.installProgress = {
      status: "queued",
      total_targets: targets.length,
      completed_targets: 0,
      failed_targets: 0,
      progress_percent: 0,
      current_target: "",
      results: []
    };
    renderMissingNodesModalContent();
    setStatus(`Installing ${targets.length} missing node(s)...`);
    try {
      const response = await apiFetch(
        "/download-to-dir/missing-nodes/install",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ targets })
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.job_id) {
        const reason = String(data?.reason || data?.error || "").trim() || `Failed to start missing-node install (${response.status})`;
        throw new Error(reason);
      }
      state.installJobId = String(data.job_id || "").trim();
      applyInstallProgress({
        ...state.installProgress || {},
        ...data
      });
      const finalProgress = await waitForInstallJobCompletion(
        state.installJobId
      );
      const finalStatus = String(finalProgress?.status || "").toLowerCase();
      const installed = Number(finalProgress?.completed_targets || 0);
      const failed = Number(finalProgress?.failed_targets || 0);
      const successfulInstalls = Array.isArray(finalProgress?.results) ? finalProgress.results.filter((entry) => Boolean(entry?.ok)) : [];
      state.installBusy = false;
      renderMissingNodesModalContent();
      if (finalStatus === "partial") {
        setStatus(
          `Installed ${installed} node(s); ${failed} failed. Review logs, then restart if needed.`,
          "error"
        );
      } else if (finalStatus === "completed") {
        setStatus(
          `Installed ${installed} missing node(s). Click Restart in this modal.`,
          "success"
        );
      } else {
        const firstError = String(
          finalProgress?.results?.find?.((entry) => !entry?.ok)?.stderr || ""
        ).trim();
        setStatus(
          firstError || `Failed to install missing nodes. ${failed} target(s) failed.`,
          "error"
        );
      }
      for (const entry of successfulInstalls) {
        const target = String(entry?.target || "").trim();
        if (!target) continue;
        const base = target.split("/").pop() || target;
        const displayName = base.toLowerCase().endsWith(".git") ? base.slice(0, -4) : base;
        addHistoryEntry({
          operation: "install",
          status: "success",
          file_name: displayName || target,
          destination_path: target,
          path: target,
          bytes_written: 0,
          total_bytes: null,
          progress_percent: null,
          error: ""
        });
      }
      await refreshMissingNodes({ silent: true });
    } catch (err) {
      setStatus(err?.message || String(err), "error");
    } finally {
      clearInstallPollTimer();
      state.installBusy = false;
      renderMissingNodesModalContent();
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
      error: String(entry?.error || "").trim()
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
    }
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
      renderMissingNodesModalContent();
      const installResp = await apiFetch(
        "/download-to-dir/missing-nodes/install",
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
      renderMissingNodesModalContent();
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
      updateHistoryEntry(historyEntryId, {
        status,
        bytes_written: bytesWritten,
        total_bytes: totalBytes,
        progress_percent: Number.isFinite(percent) ? percent : null
      });
      if (status === "completed") {
        return data;
      } else if (status === "failed") {
        throw new Error(String(data.error || "Download failed."));
      }
      await sleep(350);
    }
  }
  function buildRetryAttemptFromEntry(entry) {
    const formValues = readDownloadFormValues();
    const retryPath = String(getEntryPath(entry) || "").trim();
    return {
      url: String(entry?.url || "").trim(),
      selected_root_value: "",
      root_key: "",
      folder: retryPath,
      subdirectory: "",
      filename: String(entry?.filename || entry?.file_name || "").trim(),
      overwrite: Boolean(entry?.overwrite),
      huggingface_token: String(formValues?.huggingface_token || "").trim()
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
  async function handleUpload(files, options = {}) {
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
    const resp = await apiFetch("/download-to-dir/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: exportPath })
    });
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
        `Export failed (${resp.status})`
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
        try {
          await refreshMissingNodes({ silent: true });
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
    ensureStyles2();
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
            <button id="dtd-missing-warning" type="button" hidden>
              <i class="icon-[lucide--triangle-alert]"></i>
            </button>
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
            <div id="dtd-upload-dropzone" class="upload-dropzone" role="button" tabindex="0">Drop files here to upload</div>
            <div class="upload-path-actions">
              <button id="dtd-upload-path-cancel" type="button">Cancel</button>
              <button id="dtd-upload-path-confirm" type="button">Choose Files</button>
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
        <div id="dtd-missing-modal" class="missing-modal" hidden>
          <div class="missing-card">
            <h3 class="missing-title">Missing Custom Nodes</h3>
            <div id="dtd-missing-body"></div>
            <div class="missing-actions">
              <button id="dtd-missing-close" type="button">Close</button>
              <button id="dtd-missing-restart" type="button" hidden>Restart</button>
              <button id="dtd-missing-install" type="button">Install Missing Nodes</button>
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
        refreshMissingNodes({ silent: true }).catch(() => {
        });
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
    updateMissingWarningVisibility();
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
        const input = event.target instanceof Element ? event.target.closest('input[data-action="edit-path"][data-id]') : null;
        if (!(input instanceof HTMLInputElement)) return;
        const entryId = input.dataset.id || "";
        const updatedPath = String(input.value || "").trim();
        writeHistoryEntries(
          state.historyEntries.map((entry) => {
            if (entry.id !== entryId) return entry;
            return { ...entry, path: updatedPath };
          })
        );
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
    const missingWarning = document.getElementById("dtd-missing-warning");
    if (missingWarning) {
      missingWarning.addEventListener("click", () => {
        openMissingNodesModal();
        refreshMissingNodes({ silent: true }).catch(() => {
        });
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
        handleUpload(files, { uploadFolder: state.uploadFolder }).catch(
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
    const uploadPathConfirm = document.getElementById(
      "dtd-upload-path-confirm"
    );
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
    if (uploadPathConfirm) {
      uploadPathConfirm.addEventListener("click", () => {
        const currentValue = String(uploadPathInput?.value || "").trim();
        closeUploadPathModal(currentValue);
      });
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
        handleUpload(selectedFiles, { uploadFolder: state.uploadFolder }).catch(
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
    const missingModal = document.getElementById("dtd-missing-modal");
    const missingClose = document.getElementById("dtd-missing-close");
    const missingRestart = document.getElementById("dtd-missing-restart");
    const missingInstall = document.getElementById("dtd-missing-install");
    if (missingModal) {
      missingModal.addEventListener("click", (event) => {
        if (event.target === missingModal) closeMissingNodesModal();
      });
      missingModal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeMissingNodesModal();
        }
      });
      missingModal.addEventListener("input", (event) => {
        const input = event.target instanceof Element ? event.target.closest(
          'input[data-action="manual-source"][data-key]'
        ) : null;
        if (!(input instanceof HTMLInputElement)) return;
        const key = String(input.dataset.key || "").trim();
        if (!key) return;
        state.manualSourceOverrides[key] = String(input.value || "").trim();
        refreshMissingActionButtons();
      });
    }
    if (missingClose) {
      missingClose.addEventListener("click", () => closeMissingNodesModal());
    }
    if (missingRestart) {
      missingRestart.addEventListener("click", () => {
        handleRestart({ confirm: false }).catch(
          (err) => setStatus(err.message || String(err), "error")
        );
      });
    }
    if (missingInstall) {
      missingInstall.addEventListener("click", () => {
        handleInstallMissingNodes().catch(
          (err) => setStatus(err.message || String(err), "error")
        );
      });
    }
    const close = document.getElementById("dtd-close-icon");
    if (close) {
      close.addEventListener("click", () => closeDialogAnimated(dialog));
    }
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        closeMissingNodesModal();
        closeConfirmModal(false);
        closeDialogAnimated(dialog);
      }
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeMissingNodesModal();
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

// web-src/switch/index.ts
import { app as app2 } from "/scripts/app.js";

// web-src/components/theme.ts
var theme = {
  colors: {
    primary: "#076a23"
  }
};

// web-src/components/toggle.ts
var TOGGLE_STYLE_ID = "avatary-switch-toggle-styles";
function ensureToggleStyles() {
  if (document.getElementById(TOGGLE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = TOGGLE_STYLE_ID;
  style.textContent = `
    .avatary-switch-toggle {
      flex: 0 0 auto;
      width: 44px;
      height: 24px;
      border-radius: 999px;
      border: 1px solid #555d71;
      background: #2e3442;
      position: relative;
      cursor: pointer;
      box-sizing: border-box;
      transition: background .15s ease, border-color .15s ease;
    }
    .avatary-switch-toggle .knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #f1f3f7;
      box-shadow: 0 1px 2px rgba(0,0,0,.35);
      transition: left .15s ease;
    }
    .avatary-switch-toggle.active {
      background: ${theme.colors.primary};
      border-color: ${theme.colors.primary};
    }
    .avatary-switch-toggle.active .knob { left: 22px; }
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

// web-src/switch/index.ts
var NODE_CLASS = "AvatarySwitch";
var STATE_KEY2 = "switchState";
var HIDDEN_INPUT_NAME = "SwitchState";
var MAX_INPUTS = 32;
var DEFAULT_W = 340;
var PANEL_HEIGHT = 220;
var STYLE_ID = "avatary-switch-panel-styles";
var TOGGLE_STYLE_ID_FALLBACK = "avatary-switch-toggle-styles-fallback";
function ensureToggleStylesFallback() {
  if (document.getElementById(TOGGLE_STYLE_ID_FALLBACK)) return;
  const style = document.createElement("style");
  style.id = TOGGLE_STYLE_ID_FALLBACK;
  style.textContent = `
    .avatary-switch-toggle {
      flex: 0 0 auto;
      width: 44px;
      height: 24px;
      border-radius: 999px;
      border: 1px solid #555d71;
      background: #2e3442;
      position: relative;
      cursor: pointer;
      box-sizing: border-box;
      transition: background .15s ease, border-color .15s ease;
    }
    .avatary-switch-toggle .knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #f1f3f7;
      box-shadow: 0 1px 2px rgba(0,0,0,.35);
      transition: left .15s ease;
    }
    .avatary-switch-toggle.active {
      background: ${theme.colors.primary};
      border-color: ${theme.colors.primary};
    }
    .avatary-switch-toggle.active .knob { left: 22px; }
    .avatary-switch-toggle.disabled {
      opacity: .4;
      cursor: default;
    }
  `;
  document.head.appendChild(style);
}
function createToggleFallback({ active, disabled, title, onToggle }) {
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
var _toggleApi = {
  ensureToggleStyles: ensureToggleStyles || ensureToggleStylesFallback,
  createToggle: createToggle || createToggleFallback
};
function rowName(i) {
  return `input_${i}`;
}
function getState(node) {
  if (!node.properties) node.properties = {};
  if (!node.properties[STATE_KEY2]) {
    node.properties[STATE_KEY2] = {
      activeIndex: 1,
      labels: {},
      visibleCount: 1
    };
  }
  return node.properties[STATE_KEY2];
}
function _iterGraphLinks(graph) {
  const links = graph?.links;
  if (!links) return [];
  if (typeof links.values === "function") {
    return Array.from(links.values());
  }
  return Object.values(links);
}
function isInputConnected(node, slotIdx0) {
  const slot = node.inputs?.[slotIdx0];
  if (slot && slot.link != null) return true;
  const nodeId = node?.id;
  if (nodeId == null) return false;
  for (const link of _iterGraphLinks(node.graph)) {
    if (!link) continue;
    if (link.target_id === nodeId && link.target_slot === slotIdx0) return true;
  }
  return false;
}
function connectedCount(node) {
  let n = 0;
  const inputs = node.inputs || [];
  for (let i = 0; i < inputs.length; i++) {
    if (isInputConnected(node, i)) n += 1;
  }
  return n;
}
function connectionSignature(node) {
  const parts = [];
  const inputs = node.inputs || [];
  for (let i = 0; i < inputs.length; i++) {
    const link = inputs[i]?.link;
    parts.push(`${i + 1}:${link == null ? "x" : String(link)}`);
  }
  return parts.join("|");
}
function forEachSwitchNode(fn) {
  const seen = /* @__PURE__ */ new Set();
  const visit = (graph) => {
    if (!graph || seen.has(graph)) return;
    seen.add(graph);
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (n.comfyClass === NODE_CLASS || n.type === NODE_CLASS) fn(n);
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app2.graph);
}
function normalizeInputs(node) {
  if (!node.inputs) node.inputs = [];
  const state = getState(node);
  const connected = connectedCount(node);
  const target = Math.min(
    Math.max(connected + (connected < MAX_INPUTS ? 1 : 0), 1),
    MAX_INPUTS
  );
  while (node.inputs.length > target) {
    const lastIdx = node.inputs.length - 1;
    if (isInputConnected(node, lastIdx)) break;
    node.removeInput(node.inputs.length - 1);
  }
  while (node.inputs.length < target) {
    node.addInput(rowName(node.inputs.length + 1), "*");
  }
  for (let i = 0; i < node.inputs.length; i++) {
    const slot = node.inputs[i];
    slot.name = rowName(i + 1);
    slot.type = "*";
    slot.label = "\u200B";
  }
  state.visibleCount = node.inputs.length;
  if (state.activeIndex < 1 || state.activeIndex > node.inputs.length) {
    const firstConnected = (node.inputs || []).findIndex(
      (_, idx) => isInputConnected(node, idx)
    );
    state.activeIndex = firstConnected >= 0 ? firstConnected + 1 : 1;
  }
  for (const key of Object.keys(state.labels || {})) {
    const idx = Number(key);
    if (!Number.isFinite(idx) || idx < 1 || idx > node.inputs.length)
      delete state.labels[key];
  }
}
function upstreamType(node, idx1) {
  const slot = node.inputs?.[idx1 - 1];
  const linkId = slot?.link;
  if (linkId == null) return "";
  let link = node.graph?.links?.[linkId];
  if (!link && typeof node.graph?.links?.get === "function")
    link = node.graph.links.get(linkId);
  if (!link) return "";
  const up = node.graph?.getNodeById?.(link.origin_id);
  return up?.outputs?.[link.origin_slot]?.type || "";
}
function getRows(node) {
  const state = getState(node);
  const rows = [];
  for (let i = 1; i <= (node.inputs?.length || 0); i++) {
    const connected = isInputConnected(node, i - 1);
    const trailing = !connected && i === node.inputs.length;
    const upType = upstreamType(node, i) || "";
    if (trailing) continue;
    rows.push({
      i,
      connected,
      trailing,
      active: state.activeIndex === i,
      label: state.labels[i] || "",
      type: upType
    });
  }
  return rows;
}
function ensurePanelWidget(node) {
  if (node._avatarySwitchPanel && node.widgets?.some((w) => w?._avatarySwitchPanelWidget)) {
    return node._avatarySwitchPanel;
  }
  if (node.widgets) {
    node.widgets = node.widgets.filter((w) => !w?._avatarySwitchPanelWidget);
  }
  node._avatarySwitchPanel = null;
  const panel = document.createElement("div");
  panel.className = "avatary-switch-panel";
  panel.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "gap:8px",
    "padding:8px",
    "height:100%",
    "overflow:auto",
    "box-sizing:border-box",
    "font:12px Inter, system-ui, sans-serif"
  ].join(";");
  node._avatarySwitchPanel = panel;
  if (typeof node.addDOMWidget === "function") {
    const w = node.addDOMWidget("Switch", "switch_panel", panel, {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => PANEL_HEIGHT
    });
    if (w) {
      w._avatarySwitchPanelWidget = true;
      w.serialize = false;
      node._avatarySwitchUsesDom = true;
      return panel;
    }
  }
  node._avatarySwitchUsesDom = false;
  return null;
}
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .avatary-switch-panel { font-family: Inter, system-ui, sans-serif; }
    .avatary-switch-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
    .avatary-switch-input {
      flex: 1 1 auto;
      min-width: 0;
      height: 30px;
      border-radius: 10px;
      border: 1px solid #4b5266;
      background: #272d3b;
      color: #d9dce4;
      padding: 0 10px;
      outline: none;
      box-sizing: border-box;
    }
    .avatary-switch-input::placeholder { color: #8d95a8; }
  `;
  document.head.appendChild(style);
}
function renderPanel(node) {
  const state = getState(node);
  ensureStyles();
  _toggleApi.ensureToggleStyles();
  const panel = ensurePanelWidget(node);
  const rows = getRows(node);
  if (!panel) {
    renderFallbackWidgets(node, rows, state);
    return;
  }
  clearFallbackWidgets(node);
  panel.innerHTML = "";
  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "Connect an input to start";
    empty.style.cssText = "color:#8d95a8;font-size:12px;padding:6px 2px;user-select:none;";
    panel.appendChild(empty);
    return;
  }
  for (const row of rows) {
    const wrap = document.createElement("div");
    wrap.className = "avatary-switch-row";
    const input = document.createElement("input");
    input.type = "text";
    input.value = row.label;
    input.placeholder = row.type || "Label";
    input.disabled = row.trailing;
    input.className = "avatary-switch-input";
    input.addEventListener("change", () => {
      const v = String(input.value || "").trim();
      if (!v) delete state.labels[row.i];
      else state.labels[row.i] = v;
      app2.graph?.setDirtyCanvas?.(true, true);
      renderPanel(node);
    });
    const disabled = row.trailing || !row.connected;
    const toggle = _toggleApi.createToggle({
      active: row.active,
      disabled,
      title: row.label || row.type || `Row ${row.i}`,
      onToggle: () => {
        state.activeIndex = row.i;
        app2.graph?.setDirtyCanvas?.(true, true);
        renderPanel(node);
      }
    });
    wrap.appendChild(input);
    wrap.appendChild(toggle);
    panel.appendChild(wrap);
  }
}
function clearFallbackWidgets(node) {
  if (!node.widgets) return;
  node.widgets = node.widgets.filter((w) => !w?._avatarySwitchFallbackWidget);
}
function renderFallbackWidgets(node, rows, state) {
  clearFallbackWidgets(node);
  for (const row of rows) {
    const disabled = row.trailing || !row.connected;
    const label = node.addWidget(
      "text",
      `Label ${row.i}`,
      row.label || "",
      (v) => {
        const s = String(v || "").trim();
        if (!s) delete state.labels[row.i];
        else state.labels[row.i] = s;
      },
      { placeholder: row.type || "Label", disabled }
    );
    label._avatarySwitchFallbackWidget = true;
    label.serialize = false;
    const btnText = disabled ? "Waiting" : state.activeIndex === row.i ? "ON" : "OFF";
    const btn = node.addWidget(
      "button",
      `Switch ${row.i}: ${btnText}`,
      null,
      () => {
        if (disabled) return;
        state.activeIndex = row.i;
        renderPanel(node);
      }
    );
    btn._avatarySwitchFallbackWidget = true;
    btn.serialize = false;
  }
}
function clearLegacySwitchWidgets(node) {
  if (!node.widgets) return;
  node.widgets = node.widgets.filter(
    (w) => !w?._avatarySwitchLegacyWidget && !w?._avatarySwitchFallbackWidget
  );
}
function refreshNode2(node) {
  normalizeInputs(node);
  clearLegacySwitchWidgets(node);
  renderPanel(node);
  node.size[0] = Math.max(node.size?.[0] || 0, DEFAULT_W);
  node.size[1] = Math.max(node.size?.[1] || 0, PANEL_HEIGHT + 90);
  node._avatarySwitchConnSig = connectionSignature(node);
  app2.graph?.setDirtyCanvas?.(true, true);
}
app2.registerExtension({
  name: "Avatary.Switch.Nodes2CustomPanel",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS) return;
    const _origCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function(...args) {
      _origCreated?.apply(this, args);
      refreshNode2(this);
      setTimeout(() => {
        try {
          refreshNode2(this);
        } catch (_e) {
        }
      }, 0);
      setTimeout(() => {
        try {
          refreshNode2(this);
        } catch (_e) {
        }
      }, 200);
    };
    const _origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function(...args) {
      const r = _origConfigure?.apply(this, args);
      refreshNode2(this);
      return r;
    };
    const _origConn = nodeType.prototype.onConnectionsChange;
    nodeType.prototype.onConnectionsChange = function(...args) {
      const r = _origConn?.apply(this, args);
      refreshNode2(this);
      return r;
    };
    const _origDraw = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function(...args) {
      const r = _origDraw?.apply(this, args);
      const sig = connectionSignature(this);
      if (sig !== this._avatarySwitchConnSig) {
        try {
          refreshNode2(this);
        } catch (_e) {
        }
      }
      return r;
    };
    const _origRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function(...args) {
      if (this._avatarySwitchPanel?.isConnected)
        this._avatarySwitchPanel.remove();
      this._avatarySwitchPanel = null;
      if (this.widgets) {
        this.widgets = this.widgets.filter(
          (w) => !w?._avatarySwitchPanelWidget
        );
      }
      return _origRemoved?.apply(this, args);
    };
  }
});
if (app2?.loadGraphData && !app2._avatarySwitchLoadGraphWrapped) {
  app2._avatarySwitchLoadGraphWrapped = true;
  const _origLoadGraphData = app2.loadGraphData.bind(app2);
  app2.loadGraphData = (...args) => {
    const result = _origLoadGraphData(...args);
    Promise.resolve(result).finally(() => {
      setTimeout(() => {
        forEachSwitchNode((node) => {
          try {
            refreshNode2(node);
          } catch (_e) {
          }
        });
      }, 250);
      setTimeout(() => {
        forEachSwitchNode((node) => {
          try {
            refreshNode2(node);
          } catch (_e) {
          }
        });
      }, 900);
    });
    return result;
  };
}
function buildNodeIndex() {
  const map = /* @__PURE__ */ new Map();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      if (!n) continue;
      if (n.comfyClass === NODE_CLASS || n.type === NODE_CLASS)
        map.set(String(n.id), n);
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner);
    }
  };
  visit(app2.graph);
  return map;
}
function resolveNode(map, promptId) {
  const id = String(promptId);
  if (map.has(id)) return map.get(id);
  const tail = id.includes(":") ? id.slice(id.lastIndexOf(":") + 1) : null;
  if (tail && map.has(tail)) return map.get(tail);
  return null;
}
var _origGraphToPrompt = app2.graphToPrompt.bind(app2);
app2.graphToPrompt = async (...args) => {
  const result = await _origGraphToPrompt(...args);
  const out = result?.output;
  if (!out) return result;
  let index = null;
  for (const id in out) {
    const entry = out[id];
    if (!entry || entry.class_type !== NODE_CLASS) continue;
    if (!index) index = buildNodeIndex();
    const node = resolveNode(index, id);
    const state = node?.properties?.[STATE_KEY2];
    entry.inputs = entry.inputs || {};
    entry.inputs[HIDDEN_INPUT_NAME] = String(state?.activeIndex || 1);
  }
  return result;
};
