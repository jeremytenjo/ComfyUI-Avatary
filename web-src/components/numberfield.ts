// @ts-nocheck

export function createNumberField({
  value = 0,
  min,
  max,
  step,
  disabled = false,
  title = '',
  className = '',
  onInput,
  onChange,
}) {
  const input = document.createElement('input');
  input.type = 'number';

  const comfyClasses = [
    // Mirrors ComfyUI_frontend widget input conventions.
    'w-full',
    'min-w-0',
    'h-7',
    'rounded-lg',
    'border-none',
    'bg-component-node-widget-background',
    'text-component-node-foreground',
    'px-4',
    'text-xs',
    'outline-none',
    'transition-colors',
    'hover:bg-component-node-widget-background-hovered',
    'focus:bg-component-node-widget-background-hovered',
    'cursor-pointer',
  ].join(' ');

  input.className = `${comfyClasses} ${className}`.trim();
  input.value = String(value ?? 0);
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  if (step !== undefined) input.step = String(step);
  input.disabled = disabled;
  if (title) input.title = title;
  input.addEventListener('input', () => onInput?.(Number(input.value)));
  input.addEventListener('change', () => onChange?.(Number(input.value)));
  return input;
}
