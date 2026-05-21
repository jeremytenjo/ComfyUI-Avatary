"""ComfyUI-Switch - dynamic-input switch that passes one active input through."""

from ._type_helpers import ANY

MAX_INPUTS = 32


class ComfySwitch:
    @classmethod
    def INPUT_TYPES(cls):
        optional = {
            f"input_{i}": (
                ANY,
                {
                    "forceInput": True,
                    "tooltip": "An input to route. Wire any node here; set an active row on the node and that row's value flows out unchanged.",
                },
            )
            for i in range(1, MAX_INPUTS + 1)
        }
        return {
            "required": {},
            "optional": optional,
            "hidden": {
                "SwitchState": ("STRING", {"default": "1"}),
            },
        }

    RETURN_TYPES = (ANY,)
    RETURN_NAMES = ("output",)
    FUNCTION = "pick"
    CATEGORY = "ComfyUI-Switch"

    def pick(self, SwitchState="1", **kwargs):
        try:
            idx = int(SwitchState)
        except (TypeError, ValueError):
            idx = 1

        if idx < 1 or idx > MAX_INPUTS:
            idx = 1

        key = f"input_{idx}"
        val = kwargs.get(key)
        if val is None:
            raise ValueError(
                "ComfyUI-Switch: no input is connected to the active row. "
                "Wire at least one upstream node and set that row active."
            )
        return (val,)


NODE_CLASS_MAPPINGS = {"ComfySwitch": ComfySwitch}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfySwitch": "Switch"}
