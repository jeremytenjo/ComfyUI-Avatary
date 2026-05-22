// @ts-nocheck
const TEXTFIELD_STYLE_ID = "avatary-textfield-styles";

export function ensureTextfieldStyles() {
	if (document.getElementById(TEXTFIELD_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = TEXTFIELD_STYLE_ID;
	style.textContent = `
    .avatary-textfield {
      width: 100%;
      min-height: 30px;
      height: 30px;
      border-radius: 10px;
      border: 1px solid var(--p-form-field-border-color, transparent);
      background: var(--component-node-widget-background, #3a3d48);
      color: var(--component-node-foreground, #d9dce4);
      padding: 0 10px;
      font-size: 12px;
      line-height: 1;
      letter-spacing: 0;
      text-transform: none;
      box-sizing: border-box;
      outline: none;
      transition: background .12s ease, box-shadow .12s ease, border-color .12s ease;
    }
    .avatary-textfield:hover {
      background: var(--component-node-widget-background-hovered, #4a4e5e);
    }
    .avatary-textfield::placeholder {
      color: var(--component-node-foreground-secondary, #8d95a8);
      opacity: 1;
    }
    .avatary-textfield:focus {
      border-color: var(--p-form-field-border-color, transparent);
      background: var(--component-node-widget-background-hovered, #4a4e5e);
      box-shadow: 0 0 0 1px var(--component-node-widget-background-highlighted, #4b5563);
    }
    .avatary-textfield:disabled {
      background: var(--component-node-widget-background-disabled, #2a2d36);
      color: var(--component-node-foreground-secondary, #8d95a8);
      opacity: .75;
      cursor: default;
    }
  `;
	document.head.appendChild(style);
}

export function createTextfield({
	value = "",
	placeholder = "",
	disabled = false,
	title = "",
	className = "",
	onChange,
}) {
	ensureTextfieldStyles();
	const input = document.createElement("input");
	input.type = "text";
	input.className = `avatary-textfield ${className}`.trim();
	input.value = value;
	input.placeholder = placeholder;
	input.disabled = disabled;
	if (title) input.title = title;
	input.addEventListener("change", () => onChange?.(input.value));
	return input;
}
