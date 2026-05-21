const TOGGLE_STYLE_ID = "avatary-switch-toggle-styles";

export function ensureToggleStyles() {
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
      background: #f66744;
      border-color: #f66744;
    }
    .avatary-switch-toggle.active .knob { left: 22px; }
    .avatary-switch-toggle.disabled {
      opacity: .4;
      cursor: default;
    }
  `;
  document.head.appendChild(style);
}

export function createToggle({ active, disabled, title, onToggle }) {
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
