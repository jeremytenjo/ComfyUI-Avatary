// @ts-nocheck
import { captureTextInputEvents } from "./textfield.js";

export function createTextarea({
	value = "",
	placeholder = "",
	disabled = false,
	title = "",
	className = "",
	captureEvents = true,
	onInput,
	onChange,
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
		"focus:bg-component-node-widget-background-hovered",
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
