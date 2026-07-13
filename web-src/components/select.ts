// @ts-nocheck

const STYLE_ID = 'avatary-select-component-styles';

function ensureSelectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .avatary-select {
      min-width: 0;
      position: relative;
      width: 100%;
    }
    .avatary-select-trigger,
    .avatary-select-filter {
      box-sizing: border-box;
      min-width: 0;
      width: 100%;
      height: 28px;
      border: 0;
      background: var(--component-node-widget-background);
      color: var(--component-node-foreground);
      cursor: pointer;
      font-size: 12px;
      outline: none;
      padding: 0 12px;
      transition: background .12s ease;
    }
    .avatary-select-trigger {
      align-items: center;
      border-radius: 8px;
      display: flex;
      overflow: hidden;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .avatary-select-trigger:hover,
    .avatary-select-trigger:focus,
    .avatary-select-filter:hover,
    .avatary-select-filter:focus {
      background: var(--component-node-widget-background-hovered);
    }
    .avatary-select-menu {
      background: var(--comfy-menu-bg, #101010);
      border: 1px solid var(--p-form-field-border-color, #3c3c3c);
      border-radius: 0;
      box-shadow: 0 8px 24px rgba(0,0,0,.35);
      box-sizing: border-box;
      left: 0;
      margin-top: 4px;
      min-width: 100%;
      padding: 4px;
      position: absolute;
      right: 0;
      z-index: 10000;
    }
    .avatary-select-filter {
      background: var(--comfy-input-bg, #191919);
      border: 1px solid var(--p-primary-color, #60a5fa);
      border-radius: 0;
      cursor: text;
      margin-bottom: 6px;
      padding: 0 8px;
    }
    .avatary-select-heading {
      color: var(--component-node-foreground);
      font-size: 12px;
      line-height: 18px;
      padding: 0 0 4px;
      white-space: nowrap;
    }
    .avatary-select-options {
      max-height: 180px;
      overflow: auto;
    }
    .avatary-select-option {
      align-items: center;
      border-radius: 0;
      box-sizing: border-box;
      color: var(--component-node-foreground);
      cursor: pointer;
      display: flex;
      font-size: 12px;
      min-height: 24px;
      overflow: hidden;
      padding: 0 6px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .avatary-select-option:hover,
    .avatary-select-option.active {
      background: var(--component-node-widget-background-hovered);
      color: var(--component-node-foreground);
    }
    .avatary-select-empty {
      color: var(--component-node-foreground-secondary);
      cursor: default;
    }
  `;
  document.head.appendChild(style);
}

function normalizeOptions(options) {
  return options.map((option) => {
    const value =
      typeof option === 'object' && option !== null ? option.value : option;
    const label =
      typeof option === 'object' && option !== null
        ? option.label || option.value
        : option;
    return {
      value: String(value ?? ''),
      label: String(label ?? ''),
    };
  });
}

export function createSelect({
  options = [],
  value = '',
  disabled = false,
  title = '',
  chooserLabel = 'Choose an option',
  filterPlaceholder = 'Filter list',
  className = '',
  onChange,
}) {
  ensureSelectStyles();

  const normalizedOptions = normalizeOptions(options);
  let selectedValue = String(value ?? '');
  let isOpen = false;

  const root = document.createElement('div');
  root.className = `avatary-select ${className}`.trim();
  if (title) root.title = title;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'avatary-select-trigger';
  trigger.textContent = selectedValue;
  trigger.disabled = disabled;

  const menu = document.createElement('div');
  menu.className = 'avatary-select-menu';
  menu.hidden = true;

  const filterInput = document.createElement('input');
  filterInput.type = 'text';
  filterInput.className = 'avatary-select-filter';
  filterInput.placeholder = filterPlaceholder;
  filterInput.disabled = disabled;
  filterInput.autocomplete = 'off';
  filterInput.spellcheck = false;

  const heading = document.createElement('div');
  heading.className = 'avatary-select-heading';
  heading.textContent = chooserLabel;

  const optionList = document.createElement('div');
  optionList.className = 'avatary-select-options';
  menu.append(filterInput, heading, optionList);

  function close() {
    isOpen = false;
    menu.hidden = true;
  }

  function renderOptions(filterText = '') {
    const filter = String(filterText || '').toLowerCase();
    const matches = normalizedOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(filter) ||
        option.value.toLowerCase().includes(filter),
    );
    optionList.innerHTML = '';

    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'avatary-select-option avatary-select-empty';
      empty.textContent = 'No matches';
      optionList.appendChild(empty);
      return;
    }

    for (const option of matches) {
      const item = document.createElement('div');
      item.className = 'avatary-select-option';
      if (option.value === selectedValue) item.classList.add('active');
      item.textContent = option.label;
      item.title = option.label;
      item.addEventListener('mousedown', (event) => event.preventDefault());
      item.addEventListener('click', () => {
        selectedValue = option.value;
        trigger.textContent = selectedValue;
        close();
        onChange?.(selectedValue);
      });
      optionList.appendChild(item);
    }
  }

  function open() {
    if (disabled) return;
    isOpen = true;
    menu.hidden = false;
    filterInput.value = '';
    renderOptions('');
    requestAnimationFrame(() => filterInput.focus());
  }

  trigger.addEventListener('click', () => {
    if (isOpen) {
      close();
      return;
    }
    open();
  });

  filterInput.addEventListener('input', () => renderOptions(filterInput.value));
  filterInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      trigger.focus();
    }
    if (event.key === 'Enter') {
      const firstOption = optionList.querySelector(
        '.avatary-select-option:not(.avatary-select-empty)',
      );
      if (firstOption) {
        event.preventDefault();
        firstOption.click();
      }
    }
  });

  const handleDocumentMouseDown = (event) => {
    if (!root.contains(event.target)) close();
  };
  document.addEventListener('mousedown', handleDocumentMouseDown);

  const cleanupTimer = setInterval(() => {
    if (root.isConnected) return;
    document.removeEventListener('mousedown', handleDocumentMouseDown);
    clearInterval(cleanupTimer);
  }, 1000);

  root.append(trigger, menu);
  return root;
}
