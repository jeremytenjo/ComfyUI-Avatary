# Changelog

All notable changes to internal packs are documented in this file.

## Downloader

### 2026-05-19

- Added an `Export` button between `Download` and `Upload`.
- Added an export-path modal so users can type a file/folder path to export.
- Added backend export route to zip the selected file/folder and download it as a `.zip`.

### 2026-04-28

- Added an upload-path modal that opens when clicking `Upload`, so users can input the output folder before choosing files.
- Improved multi-file upload progress feedback with clearer loading states, including processed count and how many uploads remain.

### 2026-04-24

- Renamed the project branding to `ComfyUI-Downloader` across docs and UI labels.
- Added an `Update` action in Downloads history for custom node entries that removes the installed node from disk and reinstalls it.
- Updated delete handling to allow directory deletion only inside `custom_nodes`, which enables safe custom-node update/reinstall flow while keeping other directories protected.

### 2026-04-08

- Added missing custom-node detection for the currently open workflow.
- Added a yellow warning button between `Download` and `Upload` when missing nodes are detected.
- Added a missing-nodes modal with node status, source links, and manual Git URL inputs when source is unavailable.
- Added backend routes to analyze workflow dependencies and install missing nodes through `comfy node install`.
- Added bulk install flow for missing nodes with restart prompt integration.
- Added live per-node install progress for missing-node installs (current target, completed/total, success/failure counts, and progress bar).
- Added successful missing-node installs to the Downloads accordion history.
- Expanded `custom_nodes` git install detection to clone from repository page URLs (GitHub and Hugging Face, including `/tree/<branch>` links), not only `.git` URLs.
- Improved auto-filename handling for direct download links (for example Civitai numeric model URLs) by using server `Content-Disposition` filenames when no filename override is provided.
- Fixed false-positive unknown node classes caused by UUID-like internal IDs appearing in missing-node analysis/fallback detection.

### 2026-04-05

- Added an `Upload` button to the downloader modal.
- Added support for cloning `.git` URLs directly into `custom_nodes` instead of downloading.
- Cloned `.git` repositories now automatically install their `requirements.txt` dependencies by default (when present).
- Added a Restart button.

## Group-Bypasser

### [Unreleased]

#### Changed

- Sort Group Bypasser group toggles alphabetically using a case-insensitive, numeric-aware collator for consistent ordering.

### 2026-05-12

- Include frames/groups from nested subgraphs when listing toggles and applying bypass states.

## Nano-Banana

### [Unreleased]

#### Added

- Optional `image` input for image-conditioned generation requests.
- In-memory response cache.

#### Changed

- Node now skips API calls and returns cached output when the same image size, prompt, size, and resolution are provided.
