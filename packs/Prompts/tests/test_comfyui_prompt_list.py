import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from comfyui_prompt_list import (  # noqa: E402
    NODE_CLASS_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS,
    ComfyUIPromptList,
)


def test_input_types_contains_text_and_divider():
    input_types = ComfyUIPromptList.INPUT_TYPES()
    required = input_types["required"]
    optional = input_types["optional"]

    assert list(required.keys()) == ["text", "divider"]
    assert required["divider"][1]["default"] == "**"
    assert list(optional.keys()) == [
        "prompt_positive_prefix",
        "prompt_negative_default",
    ]
    assert optional["prompt_positive_prefix"][1]["default"] == ""
    assert optional["prompt_positive_prefix"][1]["multiline"] is True
    assert optional["prompt_negative_default"][1]["default"] == ""


def test_split_basic_default_separator():
    node = ComfyUIPromptList()
    positive, negative = node.split("a**b")
    assert positive == ["a", "b"]
    assert negative == ["", ""]


def test_split_preserves_multiline_chunks():
    node = ComfyUIPromptList()
    positive, negative = node.split("first line\nsecond line**third line\nfourth line")
    assert positive == ["first line\nsecond line", "third line\nfourth line"]
    assert negative == ["", ""]


def test_split_normalizes_windows_newlines_and_trims():
    node = ComfyUIPromptList()
    positive, negative = node.split("  one\r\nline  **\r\n\r\n  two\rthree  ")
    assert positive == ["one\nline", "two\nthree"]
    assert negative == ["", ""]


def test_split_extra_chunks_are_kept_as_additional_items():
    node = ComfyUIPromptList()
    positive, negative = node.split("alpha**beta**gamma")
    assert positive == ["alpha", "beta", "gamma"]
    assert negative == ["", "", ""]


def test_split_empty_input_falls_back_to_empty_strings():
    node = ComfyUIPromptList()
    positive, negative = node.split("   \r\n  **   \n")
    assert positive == [""]
    assert negative == [""]


def test_split_supports_custom_divider():
    node = ComfyUIPromptList()
    positive, negative = node.split("a***b***c", divider="***")
    assert positive == ["a", "b", "c"]
    assert negative == ["", "", ""]


def test_split_applies_default_negative_to_unlabeled_blocks():
    node = ComfyUIPromptList()
    positive, negative = node.split("a**b", prompt_negative_default="bad, lowres")
    assert positive == ["a", "b"]
    assert negative == ["bad, lowres", "bad, lowres"]


def test_split_parses_labeled_positive_negative():
    node = ComfyUIPromptList()
    text = "positive: cat photo\nnegative: blurry, lowres"
    positive, negative = node.split(text)
    assert positive == ["cat photo"]
    assert negative == ["blurry, lowres"]


def test_split_parses_labeled_multiline_sections():
    node = ComfyUIPromptList()
    text = (
        "positive: cinematic portrait\n"
        "red dress\n"
        "negative: lowres\n"
        "bad hands"
    )
    positive, negative = node.split(text)
    assert positive == ["cinematic portrait\nred dress"]
    assert negative == ["lowres\nbad hands"]


def test_split_labeled_blocks_work_across_multiple_items():
    node = ComfyUIPromptList()
    text = (
        "positive: prompt a\nnegative: neg a\n"
        "**\n"
        "positive: prompt b\nnegative: neg b"
    )
    positive, negative = node.split(text)
    assert positive == ["prompt a", "prompt b"]
    assert negative == ["neg a", "neg b"]


def test_split_labeled_negative_preserved_when_non_empty():
    node = ComfyUIPromptList()
    text = "positive: prompt\nnegative: custom"
    positive, negative = node.split(text, prompt_negative_default="bad, lowres")
    assert positive == ["prompt"]
    assert negative == ["custom"]


def test_split_labeled_empty_negative_uses_default():
    node = ComfyUIPromptList()
    text = "positive: prompt\nnegative:"
    positive, negative = node.split(text, prompt_negative_default="bad, lowres")
    assert positive == ["prompt"]
    assert negative == ["bad, lowres"]


def test_split_without_labels_defaults_to_positive_only():
    node = ComfyUIPromptList()
    positive, negative = node.split("plain prompt text")
    assert positive == ["plain prompt text"]
    assert negative == [""]


def test_split_applies_positive_prefix_to_multiple_items():
    node = ComfyUIPromptList()
    positive, negative = node.split("a**b", prompt_positive_prefix="::PREFIX")
    assert positive == ["::PREFIXa", "::PREFIXb"]
    assert negative == ["", ""]


def test_outputs_are_marked_as_lists():
    assert ComfyUIPromptList.OUTPUT_IS_LIST == (True, True)


def test_node_mappings_export_expected_values():
    assert NODE_CLASS_MAPPINGS["ComfyUI-Prompts"] is ComfyUIPromptList
    assert NODE_DISPLAY_NAME_MAPPINGS["ComfyUI-Prompts"] == "Prompts"
