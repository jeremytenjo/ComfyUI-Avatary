# ComfyUI-Avatary

`ComfyUI-Avatary` is a meta custom node pack that aggregates these highlighted packs into one loader:

- `Downloader`
- `Group-Bypasser`
- `Nano-Banana`
- `Prompts`
- `Save-Image-Ultra`
- `Switch`

## How it works

- On ComfyUI startup, `ComfyUI-Avatary` dynamically imports each pack's `__init__.py`.
- It merges their `NODE_CLASS_MAPPINGS` and display mappings.
- If two packs expose the same node key, Avatary keeps the first one and logs a warning.

## Notes

- Packs are embedded under `ComfyUI-Avatary/packs`.
- Restart ComfyUI after adding/removing packs.
