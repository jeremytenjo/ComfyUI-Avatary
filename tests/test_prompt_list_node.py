import importlib.util
from pathlib import Path


_MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_prompt_list.py"
_SPEC = importlib.util.spec_from_file_location("avatary_node_prompt_list", _MODULE_PATH)
assert _SPEC and _SPEC.loader
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

NODE_CLASS_MAPPINGS = _MODULE.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = _MODULE.NODE_DISPLAY_NAME_MAPPINGS
ComfyUIPromptList = _MODULE.ComfyUIPromptList


def test_prompt_list_display_name_and_category():
    assert NODE_CLASS_MAPPINGS["ComfyUI-Prompts"] is ComfyUIPromptList
    assert NODE_DISPLAY_NAME_MAPPINGS["ComfyUI-Prompts"] == "Prompt List Avatary"
    assert ComfyUIPromptList.CATEGORY == "👑 Avatary/Text"


def test_prompt_list_split_still_behaves():
    node = ComfyUIPromptList()
    positive, negative = node.split("positive: cat\nnegative: blur**dog", prompt_negative_default="bad")
    assert positive == ["cat", "dog"]
    assert negative == ["blur", "bad"]
