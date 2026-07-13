// @ts-nocheck

export function createSelect({
	options = [],
	value = "",
	disabled = false,
	title = "",
	className = "",
	onChange,
}) {
	const select = document.createElement("select");

	const comfyClasses = [
		// Mirrors ComfyUI_frontend widget select conventions.
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

	select.className = `${comfyClasses} ${className}`.trim();
	select.style.appearance = "none";
	select.style.backgroundImage = "none";
	select.disabled = disabled;
	if (title) select.title = title;

	for (const option of options) {
		const optionValue =
			typeof option === "object" && option !== null ? option.value : option;
		const optionLabel =
			typeof option === "object" && option !== null
				? option.label || option.value
				: option;
		const optionElement = document.createElement("option");
		optionElement.value = String(optionValue ?? "");
		optionElement.textContent = String(optionLabel ?? "");
		select.appendChild(optionElement);
	}

	select.value = String(value ?? "");
	select.addEventListener("change", () => onChange?.(select.value));
	return select;
}
