# ComfyUI-Group-Bypasser

ComfyUI custom node that shows one toggle per unique frame/group name and can bypass all nodes inside matching frames.

## Behavior

- Lists unique group names in the current graph.
- Toggle label format: `Bypass {framename}`.
- Toggles default to enabled.
- When disabled, all nodes in all frames with that name are set to bypass mode.
- Duplicate frame names are treated as one row and controlled together.
