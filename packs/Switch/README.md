# ComfyUI-Switch

A dynamic multi-input switch custom node for ComfyUI, modeled after **Switch Pixaroma** behavior.

## Node

- `Switch` (`ComfySwitch`)
- Category: `ComfyUI-Switch`

## Behavior

- Accepts **any ComfyUI wire type** (`MODEL`, `IMAGE`, `CLIP`, `STRING`, `LATENT`, etc.).
- Starts with one input row and auto-grows as you connect cables (up to 32).
- Always keeps one trailing empty row.
- Only one row can be active at a time (toggle on node body).
- Click label area to rename row labels.
- If active row is disconnected, active selection auto-adjusts to a connected neighbor when possible.
- Hidden `SwitchState` is injected at prompt submission time so Python execution routes the selected row.

## Files

- `nodes/node_switch.py` - Python execution logic
- `js/switch/*` - dynamic row UI, labels, toggle rendering, prompt hook

## Install

1. Keep this folder at:
   - `ComfyUI/custom_nodes/ComfyUI-Switch`
2. Restart ComfyUI.
3. Add node: `ComfyUI-Switch -> Switch`
