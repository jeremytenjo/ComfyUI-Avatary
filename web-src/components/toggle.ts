// @ts-nocheck

const TOGGLE_STYLE_ID = 'avatary-switch-toggle-styles';

export function ensureToggleStyles() {
  if (document.getElementById(TOGGLE_STYLE_ID)) return;
  const style = document.createElement('style');
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

export function createToggle({ active, disabled, title, onToggle }) {
  const toggle = document.createElement('div');
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', active ? 'true' : 'false');
  if (title) toggle.title = title;
  toggle.className = 'avatary-switch-toggle';
  if (active) toggle.classList.add('active');
  if (disabled) toggle.classList.add('disabled');

  const knob = document.createElement('span');
  knob.className = 'knob';
  toggle.appendChild(knob);

  toggle.addEventListener('click', () => {
    if (disabled) return;
    onToggle?.();
  });

  return toggle;
}
