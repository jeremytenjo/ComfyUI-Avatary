// @ts-nocheck

const STYLE_ID = 'avatary-missing-files-styles';

export function ensureMissingFilesStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .avatary-missing-files {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      border-radius: 10px;
      background: var(--component-node-widget-background);
    }
    .avatary-missing-files-title {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--component-node-foreground);
    }
    .avatary-missing-files-copy {
      margin: 0;
      font-size: 11px;
      color: var(--component-node-foreground-secondary);
      line-height: 1.4;
    }
    .avatary-missing-files-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .avatary-missing-files-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--component-node-widget-background-highlighted);
      background: var(--component-node-background);
    }
    .avatary-missing-files-item-title {
      margin: 0;
      font-size: 11px;
      color: var(--component-node-foreground);
      word-break: break-word;
    }
    .avatary-missing-files-item-path {
      margin: 0;
      font-size: 10px;
      color: var(--component-node-foreground-secondary);
      word-break: break-all;
    }
    .avatary-missing-files-item-path-row {
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    .avatary-missing-files-copy-btn {
      flex: 0 0 auto;
      width: 20px;
      height: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: transparent;
      color: var(--component-node-foreground-secondary);
      transition: background .12s ease, color .12s ease;
      margin-top: 1px;
    }
    .avatary-missing-files-copy-btn:hover {
      background: var(--component-node-widget-background-hovered);
      color: var(--component-node-foreground);
    }
    .avatary-missing-files-copy-btn.copied {
      color: var(--p-primary-color);
    }
    .avatary-missing-files-copy-btn i {
      width: 12px;
      height: 12px;
      font-size: 12px;
      display: inline-block;
    }
    .avatary-missing-files-item-link {
      width: fit-content;
      font-size: 11px;
      color: var(--p-primary-color);
      text-decoration: underline;
    }
    .avatary-missing-files-empty {
      margin: 0;
      font-size: 11px;
      color: var(--component-node-foreground-secondary);
    }
  `;
  document.head.appendChild(style);
}

export function renderMissingFiles({
  container,
  title = 'Missing Files',
  description = '',
  items = [],
}) {
  ensureMissingFilesStyles();
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'avatary-missing-files';

  const titleEl = document.createElement('p');
  titleEl.className = 'avatary-missing-files-title';
  titleEl.textContent = `⚠️ ${String(title || 'Missing Files')}`;
  root.appendChild(titleEl);

  if (description) {
    const copyEl = document.createElement('p');
    copyEl.className = 'avatary-missing-files-copy';
    copyEl.textContent = String(description);
    root.appendChild(copyEl);
  }

  if (!Array.isArray(items) || items.length === 0) {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'avatary-missing-files-empty';
    emptyEl.textContent = 'All required files are available.';
    root.appendChild(emptyEl);
    container.appendChild(root);
    return;
  }

  const list = document.createElement('div');
  list.className = 'avatary-missing-files-list';

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'avatary-missing-files-item';

    const itemTitle = document.createElement('p');
    itemTitle.className = 'avatary-missing-files-item-title';
    itemTitle.textContent = String(item?.label || 'Missing file');
    row.appendChild(itemTitle);

    const itemPathRow = document.createElement('div');
    itemPathRow.className = 'avatary-missing-files-item-path-row';

    const itemPath = document.createElement('p');
    itemPath.className = 'avatary-missing-files-item-path';
    itemPath.textContent = String(item?.path || '');
    itemPathRow.appendChild(itemPath);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'avatary-missing-files-copy-btn';
    copyBtn.type = 'button';
    copyBtn.title = 'Copy path';
    copyBtn.innerHTML = '<i class="icon-[lucide--copy]"></i>';
    copyBtn.addEventListener('click', async () => {
      const pathText = String(item?.path || '').trim();
      if (!pathText) return;
      try {
        await navigator.clipboard.writeText(pathText);
        copyBtn.classList.add('copied');
        copyBtn.title = 'Copied';
        copyBtn.innerHTML = '<i class="icon-[lucide--check]"></i>';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.title = 'Copy path';
          copyBtn.innerHTML = '<i class="icon-[lucide--copy]"></i>';
        }, 1200);
      } catch (_err) {
        // Keep silent; clipboard can be unavailable in restricted contexts.
      }
    });
    itemPathRow.appendChild(copyBtn);
    row.appendChild(itemPathRow);

    const url = String(item?.url || '').trim();
    if (url) {
      const link = document.createElement('a');
      link.className = 'avatary-missing-files-item-link';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Download';
      row.appendChild(link);
    }

    list.appendChild(row);
  }

  root.appendChild(list);
  container.appendChild(root);
}
