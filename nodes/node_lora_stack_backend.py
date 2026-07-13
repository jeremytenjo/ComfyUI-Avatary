from __future__ import annotations

import json
from typing import Any


NONE_LORA = "None"
STATE_INPUT = "LoraStackState"
CATALOG_INPUT = "LoraCatalog"


def _available_loras() -> list[str]:
    try:
        import folder_paths

        names = list(folder_paths.get_filename_list("loras"))
    except Exception:
        names = []
    return names or [NONE_LORA]


class AvataryLoraStack:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, Any]:
        return {
            "required": {
                "model": ("MODEL",),
            },
            "hidden": {
                STATE_INPUT: ("STRING", {"default": "[]"}),
                CATALOG_INPUT: (_available_loras(),),
            },
        }

    RETURN_TYPES = ("MODEL",)
    RETURN_NAMES = ("model",)
    FUNCTION = "apply_loras"
    CATEGORY = "👑 Avatary/API"

    @staticmethod
    def _coerce_strength(value: Any) -> float:
        try:
            strength = float(value)
        except (TypeError, ValueError):
            strength = 1.0
        return max(-20.0, min(20.0, strength))

    @classmethod
    def _parse_rows(cls, payload: str) -> list[tuple[str, float]]:
        try:
            raw_rows = json.loads(payload or "[]")
        except json.JSONDecodeError as exc:
            raise ValueError("Lora Stack Avatary data is not valid JSON.") from exc

        if not isinstance(raw_rows, list):
            raise ValueError("Lora Stack Avatary data must be a list.")

        rows: list[tuple[str, float]] = []
        for raw_row in raw_rows:
            if not isinstance(raw_row, dict):
                continue
            if raw_row.get("enabled", True) is False:
                continue
            name = str(raw_row.get("name") or "").strip()
            if not name or name == NONE_LORA:
                continue
            strength = cls._coerce_strength(raw_row.get("strength", 1.0))
            rows.append((name, strength))
        return rows

    @staticmethod
    def _load_lora(name: str) -> dict[str, Any]:
        import comfy.utils
        import folder_paths

        lora_path = folder_paths.get_full_path_or_raise("loras", name)
        return comfy.utils.load_torch_file(lora_path, safe_load=True)

    def apply_loras(
        self,
        model: object,
        LoraStackState: str = "[]",
        LoraCatalog: str = NONE_LORA,
    ) -> tuple[object]:
        import comfy.sd

        patched_model = model
        rows = self._parse_rows(LoraStackState)
        for name, strength in rows:
            if strength == 0.0:
                continue
            lora = self._load_lora(name)
            patched_model, _clip = comfy.sd.load_lora_for_models(
                patched_model,
                None,
                lora,
                strength,
                0.0,
            )
        return (patched_model,)


NODE_CLASS_MAPPINGS = {
    "AvataryLoraStack": AvataryLoraStack,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AvataryLoraStack": "Lora Stack Avatary",
}
