# ComfyUI-Avatary

`ComfyUI-Avatary` now uses a Pixaroma-style explicit registry:

- Unified node modules live in `nodes/`
- Non-node backend/frontend utilities live in `extensions/`
- Root `__init__.py` explicitly imports and merges node mappings
- Downloader is loaded as an explicit side-effect extension

## Included Nodes

- `Group Bypasser Avatary`
- `Features Avatary`
- `Load Images Avatary`
- `Nano Banana Pro Avatary`
- `Prompt List Avatary`
- `Save Image Ultra Avatary`
- `Switch Avatary`
- `ControlLight Avatary`
- `Aspect Ratio Avatary`
- `Aspect Ratio Selector Avatary`
- `Carousel Split Avatary`

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
- Downloader now prompts for a Hugging Face token when HF downloads fail with auth errors (for example 401/403), saves it for the current browser session, and retries automatically after token entry.
- `ControlLight Avatary` includes inline missing-file guidance in the node body with expected install paths, source URLs, and one-click path copy.
- `Aspect Ratio Avatary` outputs width and height from common aspect-ratio presets, accepts `Aspect Ratio Selector Avatary` output through its optional `aspect_ratio` input, and supports optional positive width/height inputs for explicit overrides.
- `Carousel Split Avatary` has an image-only UI and auto-detects carousel/grid separators using solid-gutter detection with seamless seam fallback. It outputs split `images` as a list so uneven panels keep their native dimensions, and provides a marked `preview`.
- This refactor is branding-first and may require workflow UI metadata adjustments for renamed display/category labels.
