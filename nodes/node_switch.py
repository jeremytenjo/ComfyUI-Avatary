"""Switch Avatary - Nodes 2.0 rewrite with dynamic rows and active selection."""


class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


ANY = AnyType("*")
MAX_INPUTS = 32


class AvatarySwitch:
    DESCRIPTION = (
        "Switch Avatary routes one selected input to output. "
        "Rows are managed in the frontend and active row is sent via hidden SwitchState."
    )

    @classmethod
    def INPUT_TYPES(cls):
        optional = {
            f"input_{i}": (
                ANY,
                {
                    "forceInput": True,
                    "lazy": True,
                    "tooltip": "Optional source input slot.",
                },
            )
            for i in range(1, MAX_INPUTS + 1)
        }
        return {
            "required": {},
            "optional": optional,
            "hidden": {
                "SwitchState": ("STRING", {"default": "1"}),
                "BypassOthers": ("STRING", {"default": "1"}),
            },
        }

    RETURN_TYPES = (ANY,)
    RETURN_NAMES = ("output",)
    OUTPUT_TOOLTIPS = ("The selected input value, passed through unchanged.",)
    FUNCTION = "pick"
    CATEGORY = "👑 Avatary/Utilities"

    def check_lazy_status(self, SwitchState="1", **kwargs):
        try:
            idx = int(SwitchState)
        except (TypeError, ValueError):
            idx = 1
        if idx < 1 or idx > MAX_INPUTS:
            idx = 1
        return [f"input_{idx}"]

    def pick(self, SwitchState="1", **kwargs):
        try:
            idx = int(SwitchState)
        except (TypeError, ValueError):
            idx = 1

        if idx < 1 or idx > MAX_INPUTS:
            idx = 1

        key = f"input_{idx}"
        val = kwargs.get(key)
        return (val,)


NODE_CLASS_MAPPINGS = {"AvatarySwitch": AvatarySwitch}
NODE_DISPLAY_NAME_MAPPINGS = {"AvatarySwitch": "Switch Avatary"}
