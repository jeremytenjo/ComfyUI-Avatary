// @ts-nocheck

export function createTextarea({
	value = "",
	placeholder = "",
	disabled = false,
	title = "",
	className = "",
	autosize = false,
	minHeight = 30,
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

	const applyAutosize = () => {
		if (!autosize) return;
		textarea.style.overflowY = "hidden";
		textarea.style.height = "auto";
		textarea.style.height = `${Math.max(minHeight, textarea.scrollHeight)}px`;
	};

	textarea.addEventListener("input", () => {
		applyAutosize();
		onInput?.(textarea.value);
	});
	textarea.addEventListener("change", () => {
		applyAutosize();
		onChange?.(textarea.value);
	});

	applyAutosize();
	return textarea;
}

export function autosizeTextarea(textarea, { minHeight = 30 } = {}) {
	if (!textarea) return;
	textarea.style.overflowY = "hidden";
	textarea.style.height = "auto";
	textarea.style.height = `${Math.max(minHeight, textarea.scrollHeight)}px`;
}

export function bindTextareaAutosize(textarea, { minHeight = 30 } = {}) {
	if (!textarea || textarea.__avataryTextareaAutosizeBound) return;
	textarea.__avataryTextareaAutosizeBound = true;
	const apply = () => autosizeTextarea(textarea, { minHeight });
	textarea.addEventListener("input", apply);
	textarea.addEventListener("change", apply);
	apply();
}
