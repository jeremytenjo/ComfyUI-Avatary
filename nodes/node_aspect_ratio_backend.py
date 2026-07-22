from __future__ import annotations

from typing import Any


ASPECT_RATIO_DIMENSIONS = {
    "9:16: 1080×1920": (1080, 1920),
    "16:9: 1920×1080": (1920, 1080),
    "1:1: 1328×1328": (1328, 1328),
    "2 img carousel: 2160×1920": (2160, 1920),
    "3 img carousel: 3240×1920": (3240, 1920),
    "4 img carousel: 4320×1920": (4320, 1920),
    "4:3: 1472×1104": (1472, 1104),
    "3:4: 1104×1472": (1104, 1472),
    "3:2: 1584×1056": (1584, 1056),
    "2:3: 1056×1584": (1056, 1584),
    "21:9: 1520×656": (1520, 656),
}
ASPECT_RATIO_TYPE = "AVATARY_ASPECT_RATIO"
DEFAULT_ASPECT_RATIO = "9:16: 1080×1920"


class AspectRatio:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, Any]:
        return {
            "required": {
                "aspect_ratio_selector": (list(ASPECT_RATIO_DIMENSIONS.keys()),),
            },
            "optional": {
                "aspect_ratio": (ASPECT_RATIO_TYPE,),
                "width": (
                    "INT",
                    {
                        "default": 0,
                        "min": 0,
                        "max": 16384,
                        "step": 1,
                    },
                ),
                "height": (
                    "INT",
                    {
                        "default": 0,
                        "min": 0,
                        "max": 16384,
                        "step": 1,
                    },
                ),
            },
        }

    RETURN_TYPES = ("INT", "INT")
    RETURN_NAMES = ("width", "height")
    FUNCTION = "resolve"
    CATEGORY = "👑 Avatary/Utilities"

    def resolve(
        self,
        aspect_ratio_selector: str,
        aspect_ratio: str | None = None,
        width: int = 0,
        height: int = 0,
    ) -> tuple[int, int]:
        selected_aspect_ratio = aspect_ratio or aspect_ratio_selector
        selected_width, selected_height = ASPECT_RATIO_DIMENSIONS.get(
            selected_aspect_ratio,
            ASPECT_RATIO_DIMENSIONS[DEFAULT_ASPECT_RATIO],
        )

        if int(width or 0) > 0 and int(height or 0) > 0:
            return (int(width), int(height))

        return (selected_width, selected_height)


NODE_CLASS_MAPPINGS = {
    "AvataryAspectRatio": AspectRatio,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AvataryAspectRatio": "Aspect Ratio Avatary",
}
