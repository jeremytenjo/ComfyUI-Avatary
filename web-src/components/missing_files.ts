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
    .avatary-missing-files-item-url {
      margin: 0;
      font-size: 10px;
      color: var(--component-node-foreground-secondary);
      word-break: break-all;
    }
    .avatary-missing-files-item-url-row {
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

    const itemUrlRow = document.createElement('div');
    itemUrlRow.className = 'avatary-missing-files-item-url-row';

    const itemUrl = document.createElement('a');
    itemUrl.className = 'avatary-missing-files-item-url';
    itemUrl.href = String(item?.url || '').trim();
    itemUrl.target = '_blank';
    itemUrl.rel = 'noopener noreferrer';
    itemUrl.textContent = String(item?.url || '');
    itemUrlRow.appendChild(itemUrl);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'avatary-missing-files-copy-btn';
    copyBtn.type = 'button';
    copyBtn.title = 'Copy download URL';
    copyBtn.innerHTML = '<i class="icon-[lucide--copy]"></i>';
    copyBtn.addEventListener('click', async () => {
      const urlText = String(item?.url || '').trim();
      if (!urlText) return;
      try {
        await navigator.clipboard.writeText(urlText);
        copyBtn.classList.add('copied');
        copyBtn.title = 'Copied';
        copyBtn.innerHTML = '<i class="icon-[lucide--check]"></i>';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.title = 'Copy download URL';
          copyBtn.innerHTML = '<i class="icon-[lucide--copy]"></i>';
        }, 1200);
      } catch (_err) {
        // Keep silent; clipboard can be unavailable in restricted contexts.
      }
    });
    itemUrlRow.appendChild(copyBtn);
    row.appendChild(itemUrlRow);

    list.appendChild(row);
  }

  root.appendChild(list);
  container.appendChild(root);
}
