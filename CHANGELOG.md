# Changelog

All notable changes to internal packs are documented in this file.

## Avatary Core

### 2026-07-22

- Added new `Prompt Builder Avatary` node:
  - Builds one prompt from ordered named sections.
  - Provides default multiline section text and optional linked string inputs per section.
  - Connected section strings override their default text and non-empty sections are joined with newlines.
- Added new `String Concatenate Avatary` node:
  - Concatenates an expandable set of linked strings with a configurable delimiter.
  - Auto-grows linked string inputs so workflows do not need to chain two-input concatenate nodes.

### 2026-07-16

- Added new `Load Checkpoint or Diffusion Model Avatary` node:
  - Shows one dropdown combining files from `checkpoints` and `diffusion_models`.
  - Outputs `model`, `clip`, and `vae`.
  - Checkpoint selections load model, CLIP, and VAE; diffusion-model selections load the model and leave CLIP/VAE empty.
- Removed `Switch Avatary` and `ControlLight Avatary` from the active node set:
  - Removed their Python node modules, registry wiring, frontend entries, tests, and ControlLight backend routes.

### 2026-07-13

- Added new `Lora Stack Avatary` node:
  - Takes a `model` input and returns the LoRA-applied `model`.
  - Provides an inline custom UI for LoRA dropdown selection, strength editing, enable toggles, row removal, and drag-and-drop ordering.
  - Added reusable frontend `select` and `numberfield` components for future node UIs.

### 2026-07-12

- Removed the `Aspect Ratio Selector Avatary` node from the explicit node registry.

### 2026-07-04

- Enhanced `Features Avatary` with per-feature rules:
  - Added a compact `Rules` button beside each feature toggle.
  - Added rule modals for creating regex-based `Toggle Group` and `Toggle Node` rules.
  - `Toggle Group` targets matching group names; `Toggle Node` targets matching node titles/types.

### 2026-07-01

- Added new `Carousel Split Avatary` node:
  - Uses an image-only interface with fully automatic detection; manual direction controls were removed.
  - Auto-detects carousel/grid separators using solid-gutter detection first, then seamless global seam projection as fallback.
  - Outputs split `images` as a ComfyUI list output so uneven panels preserve full native dimensions without black padding or center cropping.
  - Provides a `preview` output with red panel boxes for checking detected cuts.

### 2026-06-10

- Added new `Aspect Ratio Avatary` node:
  - Provides preset width/height outputs for common aspect ratios.
  - Supports optional positive `width` and `height` inputs that override the selected preset only when both are greater than zero.
- Added new `Aspect Ratio Selector Avatary` node with the same aspect-ratio preset dropdown for routing a selected preset into `Aspect Ratio Avatary`.

### 2026-05-31

- Added new `ControlLight Avatary` node for low-light enhancement with a strict minimal interface:
  - Inputs: `image`, `scale` (`0..1` mapped to ControlLight `alpha`)
  - Output: enhanced `image`
  - Fixed expected model locations under `models/ControlLight/`
- Added a reusable node-body `Missing Files` UI component for model-dependent nodes:
  - Shows missing files/directories, exact destination paths, and download URLs.
  - Includes a one-click path copy action with copied-state checkmark feedback.
- Added ControlLight backend route `GET /avatary/controllight/missing-files` to power inline missing-file status in the node body.

### 2026-05-27

- Enhanced `Load Images Avatary` fullscreen preview with an in-view compare workflow:
  - Added a center-right Compare/Paste button in fullscreen preview.
  - Clicking the button pastes a clipboard image and displays it side-by-side with the current fullscreen image.
  - Updated the compare button placement to stay `20px` from the displayed image edge for tighter alignment.
- Fixed `Load Images Avatary` drag-and-drop from the Generated assets panel:
  - Added drop payload fallback handling for internal drag data (`text/uri-list`, `text/plain`, and string drag items).
  - Resolved dropped asset URLs to same-origin images, converted them to `File` objects, and sent them through the existing upload pipeline.

### 2026-05-25

- Added new `Features Avatary` node with inverted toggle semantics (`Enabled` = not bypassed, `Disabled` = bypassed) and no hardcoded group names.
- Updated Prompt List UI so `prompt_positive_prefix` stays multiline but auto-resizes to fit its content.
- Extracted reusable textarea autosize utilities into `web-src/components/textarea.ts` and reused them in Prompt List.
- Expanded `Load Images Avatary` actions:
  - Added a Paste button between Upload and Clear for clipboard image uploads.
  - Added dual top-right card actions: replace from file picker and replace from clipboard paste.
  - Switched overlay and paste button icons to Lucide.
- Improved `Load Images Avatary` preview behavior:
  - Broken/missing images are automatically removed from node state instead of showing broken tiles.
  - Filename/Remove row is pinned to the bottom of each card.
  - Thumbnails preserve aspect ratio (no stretching).
- Added `Load Images Avatary` folder-path mode with a single mode-toggle icon:
  - Path mode hides the image grid and shows a single path textfield.
  - Uses images from that folder path when the workflow runs (newest-first by mtime).
  - Restricts folder paths to ComfyUI root.

### 2026-05-24

- Added new `Load Images Avatary` node with built-in drag-and-drop uploads.
- Added clear drag-hover visual feedback so drops feel instant and obvious.
- New uploads are now sorted latest-first automatically.
- Locked the node to a stable fixed size and restored the 4-image viewport cap for a cleaner, predictable layout.
- Kept quick actions simple: upload, preview, remove, and clear all in one place.
- Added a top-right replace icon on each image card to upload a new file and swap that image in place.

### 2026-05-21

- Added `Switch Avatary`, ported from Pixaroma's dynamic Switch (Python + frontend JS modules) and wired into the explicit Avatary registry.
- Refactored root loader from dynamic pack import to explicit Pixaroma-style node registry.
- Added unified `nodes/` namespace and migrated node-bearing modules into normalized node files.
- Added `extensions/` namespace and wired Downloader as an explicit side-effect extension import.
- Consolidated frontend web assets under top-level `web/` and switched root `WEB_DIRECTORY` to `./web`.
- Unified node branding with Avatary-prefixed display names and `👑 Avatary/...` category taxonomy.

## Downloader

### 2026-07-16

- Removed the missing custom-nodes workflow scanner from Downloader:
  - Removed the warning button from the Downloader action row.
  - Removed the missing-nodes modal, workflow dependency analysis route, and install-missing-nodes flow.
  - Kept custom-node history updates working through a generic custom-node install endpoint.

### 2026-07-04

- Improved Hugging Face auth handling in Downloader:
  - Prompt for a Hugging Face token immediately when an async download fails with auth/access errors.
  - Retry the same download automatically after a token is entered.
  - Allow replacing an existing expired/invalid token before showing the failed history state.

### 2026-06-01

- Improved Hugging Face auth-failure handling for downloads:
  - When a Hugging Face download fails with auth/permission errors (such as HTTP 401/403), the UI now prompts for a Hugging Face token immediately.
  - Entered token is saved for the current browser session and reused for subsequent download attempts.
  - After entering a token in the prompt, the failed download is retried automatically.

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
