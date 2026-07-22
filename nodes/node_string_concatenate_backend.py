from __future__ import annotations

from typing import Any


MAX_STRING_INPUTS = 64
INPUT_PREFIX = "string_"


class AvataryStringConcatenate:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, Any]:
        return {
            "required": {
                "delimiter": ("STRING", {"default": "\n\n"}),
            },
            "optional": {
                cls._input_key(index): ("STRING", {"forceInput": True})
                for index in range(1, MAX_STRING_INPUTS + 1)
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("string",)
    FUNCTION = "concatenate"
    CATEGORY = "👑 Avatary/Text"

    @staticmethod
    def _input_key(index: int) -> str:
        return f"{INPUT_PREFIX}{index}"

    @staticmethod
    def _coerce_text(value: Any) -> str:
        if value is None:
            return ""
        return str(value)

    def concatenate(self, delimiter: str = "\n\n", **kwargs: Any) -> tuple[str]:
        parts = []
        for index in range(1, MAX_STRING_INPUTS + 1):
            input_key = self._input_key(index)
            if input_key not in kwargs:
                continue
            text = self._coerce_text(kwargs[input_key])
            if text.strip():
                parts.append(text)
        return (self._coerce_text(delimiter).join(parts),)


NODE_CLASS_MAPPINGS = {
    "AvataryStringConcatenate": AvataryStringConcatenate,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AvataryStringConcatenate": "String Concatenate Avatary",
}
