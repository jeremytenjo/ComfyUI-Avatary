# ComfyUI-Downloader

Download files from HTTP/HTTPS URLs directly into selected ComfyUI folders, with progress tracking and safer path handling.

## Features

- Toolbar button + modal downloader UI.
- Async downloads with live progress.
- Human-friendly error messages.
- GitHub `blob` URL normalization to raw content URLs.
- Recent folders history (`optgroup` in destination selector).
- Optional typed folder input relative to ComfyUI root.
- Session history accordion for successful/failed downloads with retry/remove actions.
- File deletion from history for successful downloads.
- Advanced accordion state persisted per browser session.

## Safety defaults

- Only `http` / `https` URLs are allowed.
- Path traversal is blocked (`..` and escaping root).

## Install

Clone into `ComfyUI/custom_nodes/`:

```bash
cd ComfyUI/custom_nodes
git clone <your-repo-url> ComfyUI-Downloader
```

Install optional dependency:

```bash
pip install -r custom_nodes/ComfyUI-Downloader/requirements.txt
```

Restart ComfyUI.

## Notes

- TLS certificate failures use a `certifi` fallback when available.
- On successful download, the extension attempts to refresh node definitions using the same command path as pressing `R`.

## Manual Verification Checklist

- Advanced accordion open/closed state persists after modal close/reopen and page refresh in the same browser session.
- Advanced accordion state resets after ending the browser session.
- Successful download adds a history item with `Delete from disk` and `Remove`.
- `Delete from disk` shows a confirmation prompt and removes the file from disk when confirmed.
- Failed download adds a history item with `Retry` and `Remove`.
- `Retry` pre-fills form fields without auto-starting a new download.
- History persists across refresh in the same session and clears after session end.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
