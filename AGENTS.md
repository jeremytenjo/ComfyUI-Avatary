# AGENTS.md

## Purpose
This repository uses a Pixaroma-style explicit registry for ComfyUI custom nodes.
Agents and contributors should follow this structure when adding or changing features.

## Repository Structure
- `__init__.py`: Root explicit registry and startup wiring.
- `nodes/`: Node modules only (one feature node module per file).
- `extensions/`: Non-node backend/frontend extensions (routes, utilities, side effects).
- `web/`: Consolidated frontend JS assets exposed via `WEB_DIRECTORY`.
- `tests/`: Refactor-era root tests for registry and moved nodes.
- `packs/`: Legacy source location kept for history/reference; do not add new architecture here.

## Required Node Contract
Each node module in `nodes/` must export:
- `NODE_CLASS_MAPPINGS`
- `NODE_DISPLAY_NAME_MAPPINGS`

Each node class should define standard ComfyUI fields:
- `INPUT_TYPES`
- `RETURN_TYPES` (and `RETURN_NAMES` when applicable)
- `FUNCTION`
- `CATEGORY`
- `OUTPUT_NODE` when applicable

## Category and Branding Convention
Use Avatary-branded categories and names:
- Category root: `👑 Avatary`
- Example categories: `👑 Avatary/Image`, `👑 Avatary/Text`, `👑 Avatary/API`, `👑 Avatary/Utilities`
- Display names should be Avatary-branded for new nodes.

## Registration Rules
- Register nodes explicitly in root `__init__.py`.
- Do not use dynamic import scanning or runtime `sys.path` mutation.
- Merge mappings deterministically and keep duplicate-key handling explicit.
- Keep non-node extension loading independent from node mapping aggregation.

## Extension Rules
- Backend route providers belong in `extensions/`.
- Extensions may be imported for side effects from root startup.
- Extensions must not be required for node mapping construction in test-only runtimes.

## Web Asset Rules
- Place shared frontend scripts in `web/`.
- Ensure assets remain compatible with `WEB_DIRECTORY = "./web"`.
- Avoid pack-local web wiring for new work.

## UI Component Reuse Rules
- Reuse existing UI components before creating new UI markup/styles for similar behavior.
- For frontend UI work, check shared components in `web-src/components/` first and extend existing components when possible.
- If a new UI primitive is needed, create it as a reusable module under `web-src/components/`, not inside feature-specific folders unless it is truly feature-only.
- Component modules should expose a small API (factory/setup functions) and keep their own scoped style injection.
- Avoid duplicating component CSS across files; centralize style ownership in the component module.
- For ComfyUI Nodes 2.0 controls, prefer ComfyUI frontend utility/token classes (for example `bg-component-node-widget-background`, `text-component-node-foreground`, `hover:bg-component-node-widget-background-hovered`) over custom hardcoded colors.
- Do not add fallback style blocks for these controls; treat ComfyUI frontend classes/tokens as the single source of truth.

## Testing Expectations
Before finalizing changes, run targeted tests:
- `pytest -q tests/test_registry.py`
- `pytest -q tests/test_prompt_list_node.py`
- `pytest -q packs/Prompts/tests/test_comfyui_prompt_list.py`

If you modify Downloader extension logic, also run its suite (environment permitting):
- `pytest -q packs/Downloader/tests/test_download_to_directory_extension.py`

## Migration Guidance
- Prefer creating new modules under `nodes/` and `extensions/` rather than editing legacy pack loaders.
- Preserve node class keys when possible to reduce workflow breakage.
- If display names/categories change, document the impact in `CHANGELOG.md`.
