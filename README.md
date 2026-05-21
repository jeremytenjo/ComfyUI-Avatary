# ComfyUI-Avatary

`ComfyUI-Avatary` now uses a Pixaroma-style explicit registry:

- Unified node modules live in `nodes/`
- Non-node backend/frontend utilities live in `extensions/`
- Root `__init__.py` explicitly imports and merges node mappings
- Downloader is loaded as an explicit side-effect extension

## Included Nodes

- `Group Bypasser Avatary`
- `Nano Banana Pro Avatary`
- `Prompt List Avatary`
- `Save Image Ultra Avatary`

## Category Taxonomy

Nodes are grouped under a branded Pixaroma-like root:

- `👑 Avatary/Utilities`
- `👑 Avatary/API`
- `👑 Avatary/Text`
- `👑 Avatary/Image`

## Web Assets

Frontend assets are consolidated under `web/` and exposed via:

- `WEB_DIRECTORY = "./web"`

## Notes

- `Downloader` remains an extension module (routes/web utilities), not a node mapping provider.
- This refactor is branding-first and may require workflow UI metadata adjustments for renamed display/category labels.
