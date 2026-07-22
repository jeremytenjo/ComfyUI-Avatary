import importlib.util
import pytest
from pathlib import Path


_MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_prompt_builder_backend.py"
_SPEC = importlib.util.spec_from_file_location("avatary_node_prompt_builder", _MODULE_PATH)
assert _SPEC and _SPEC.loader
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

NODE_CLASS_MAPPINGS = _MODULE.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = _MODULE.NODE_DISPLAY_NAME_MAPPINGS
AvataryPromptBuilder = _MODULE.AvataryPromptBuilder


def test_prompt_builder_display_name_and_category():
    assert NODE_CLASS_MAPPINGS["AvataryPromptBuilder"] is AvataryPromptBuilder
    assert NODE_DISPLAY_NAME_MAPPINGS["AvataryPromptBuilder"] == "Prompt Builder Avatary"
    assert AvataryPromptBuilder.CATEGORY == "👑 Avatary/Text"


def test_prompt_builder_empty_state_returns_empty_string():
    node = AvataryPromptBuilder()

    (prompt,) = node.build_prompt(PromptBuilderState="[]")

    assert prompt == ""


def test_prompt_builder_joins_default_section_texts_in_order():
    node = AvataryPromptBuilder()

    (prompt,) = node.build_prompt(
        PromptBuilderState=(
            "["
            '{"name":"Subject","text":"portrait of a person","input_key":"section_1"},'
            '{"name":"Style","text":"cinematic lighting","input_key":"section_2"}'
            "]"
        )
    )

    assert prompt == "portrait of a person\n\ncinematic lighting"


def test_prompt_builder_section_names_are_ui_only():
    node = AvataryPromptBuilder()

    (prompt,) = node.build_prompt(
        PromptBuilderState='[{"name":"Visible Label","text":"only this text","input_key":"section_1"}]'
    )

    assert prompt == "only this text"
    assert "Visible Label" not in prompt


def test_prompt_builder_linked_string_overrides_default_text():
    node = AvataryPromptBuilder()

    (prompt,) = node.build_prompt(
        PromptBuilderState='[{"name":"Subject","text":"default text","input_key":"section_1"}]',
        section_1="connected text",
    )

    assert prompt == "connected text"


def test_prompt_builder_linked_empty_string_overrides_and_is_skipped():
    node = AvataryPromptBuilder()

    (prompt,) = node.build_prompt(
        PromptBuilderState=(
            "["
            '{"name":"Subject","text":"default text","input_key":"section_1"},'
            '{"name":"Style","text":"style text","input_key":"section_2"}'
            "]"
        ),
        section_1="",
    )

    assert prompt == "style text"


def test_prompt_builder_invalid_json_raises_clear_error():
    node = AvataryPromptBuilder()

    with pytest.raises(ValueError, match="Prompt Builder Avatary data is not valid JSON"):
        node.build_prompt(PromptBuilderState="{bad json")
