// @ts-nocheck

export function createTextfield({
	value = "",
	placeholder = "",
	disabled = false,
	title = "",
	className = "",
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
	input.addEventListener("change", () => onChange?.(input.value));
	return input;
}
