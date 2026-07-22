from __future__ import annotations

import json
from typing import Any


STATE_INPUT = "PromptBuilderState"
SECTION_INPUT_PREFIX = "section_"
MAX_SECTIONS = 64


class AvataryPromptBuilder:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, Any]:
        return {
            "hidden": {
                STATE_INPUT: ("STRING", {"default": "[]"}),
            },
            "optional": {
                cls._input_key(index): ("STRING", {"forceInput": True})
                for index in range(1, MAX_SECTIONS + 1)
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "build_prompt"
    CATEGORY = "👑 Avatary/Text"

    @staticmethod
    def _input_key(index: int) -> str:
        return f"{SECTION_INPUT_PREFIX}{index}"

    @staticmethod
    def _coerce_text(value: Any) -> str:
        if value is None:
            return ""
        return str(value)

    @classmethod
    def _parse_rows(cls, payload: str) -> list[dict[str, str]]:
        try:
            raw_rows = json.loads(payload or "[]")
        except json.JSONDecodeError as exc:
            raise ValueError("Prompt Builder Avatary data is not valid JSON.") from exc

        if not isinstance(raw_rows, list):
            raise ValueError("Prompt Builder Avatary data must be a list.")

        rows: list[dict[str, str]] = []
        for raw_row in raw_rows:
            if not isinstance(raw_row, dict):
                continue
            input_key = cls._coerce_text(raw_row.get("input_key")).strip()
            if not input_key.startswith(SECTION_INPUT_PREFIX):
                continue
            rows.append(
                {
                    "name": cls._coerce_text(raw_row.get("name")),
                    "text": cls._coerce_text(raw_row.get("text")),
                    "input_key": input_key,
                }
            )
        return rows

    def build_prompt(self, PromptBuilderState: str = "[]", **kwargs: Any) -> tuple[str]:
        sections = []
        for row in self._parse_rows(PromptBuilderState):
            input_key = row["input_key"]
            text = self._coerce_text(kwargs[input_key]) if input_key in kwargs else row["text"]
            if text.strip():
                sections.append(text)
        return ("\n\n".join(sections),)


NODE_CLASS_MAPPINGS = {
    "AvataryPromptBuilder": AvataryPromptBuilder,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AvataryPromptBuilder": "Prompt Builder Avatary",
}
