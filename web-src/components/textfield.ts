// @ts-nocheck
const TEXTFIELD_STYLE_ID = "avatary-textfield-styles";

export function ensureTextfieldStyles() {
	if (document.getElementById(TEXTFIELD_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = TEXTFIELD_STYLE_ID;
	style.textContent = `
    .avatary-textfield {
      width: 100%;
      min-height: 40px;
      border-radius: 24px;
      border: 3px solid #4c5c86;
      background: #222b3f;
      color: #b6bfd8;
      padding: 0 24px;
      font-size: 46px;
      line-height: 1;
      letter-spacing: .03em;
      text-transform: uppercase;
      box-sizing: border-box;
      outline: none;
      transition: border-color .16s ease, box-shadow .16s ease;
    }
    .avatary-textfield::placeholder { color: #99a2ba; }
    .avatary-textfield:focus {
      border-color: #6a7fb5;
      box-shadow: 0 0 0 2px rgba(106,127,181,.22);
    }
    .avatary-textfield:disabled {
      opacity: .55;
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
