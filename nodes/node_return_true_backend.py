from __future__ import annotations

from typing import Any


MAX_ARGUMENTS = 64
INPUT_PREFIX = "arg_"


class AvataryReturnTrue:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, Any]:
        return {
            "optional": {
                cls._input_key(index): ("*", {"forceInput": True})
                for index in range(1, MAX_ARGUMENTS + 1)
            },
        }

    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("value",)
    FUNCTION = "return_true"
    CATEGORY = "👑 Avatary/Utilities"

    @staticmethod
    def _input_key(index: int) -> str:
        return f"{INPUT_PREFIX}{index}"

    @staticmethod
    def _is_truthy(value: Any) -> bool:
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip())
        if hasattr(value, "numel") and callable(value.numel):
            try:
                return int(value.numel()) > 0
            except Exception:
                return True
        if hasattr(value, "size") and not callable(value.size):
            try:
                return int(value.size) > 0
            except Exception:
                return True
        try:
            return bool(value)
        except Exception:
            return True

    def return_true(self, **kwargs: Any) -> tuple[Any]:
        for index in range(1, MAX_ARGUMENTS + 1):
            input_key = self._input_key(index)
            if input_key not in kwargs:
                continue
            value = kwargs[input_key]
            if self._is_truthy(value):
                return (value,)
        return (None,)


NODE_CLASS_MAPPINGS = {
    "AvataryReturnTrue": AvataryReturnTrue,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AvataryReturnTrue": "Return True Avatary",
}
