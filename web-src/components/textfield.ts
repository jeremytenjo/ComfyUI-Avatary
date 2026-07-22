// @ts-nocheck

const COMFY_TEXT_INPUT_EVENTS = [
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
	"wheel",
];

export function captureTextInputEvents(element) {
	const stop = (event) => event.stopPropagation();
	for (const eventName of COMFY_TEXT_INPUT_EVENTS) {
		element.addEventListener(eventName, stop);
	}
}

export function createTextfield({
	value = "",
	placeholder = "",
	disabled = false,
	title = "",
	className = "",
	captureEvents = true,
	onInput,
	onChange,
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
		"focus:bg-component-node-widget-background-hovered",
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
