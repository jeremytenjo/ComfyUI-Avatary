import importlib.util
from pathlib import Path


_MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_string_concatenate_backend.py"
_SPEC = importlib.util.spec_from_file_location("avatary_node_string_concatenate", _MODULE_PATH)
assert _SPEC and _SPEC.loader
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

NODE_CLASS_MAPPINGS = _MODULE.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = _MODULE.NODE_DISPLAY_NAME_MAPPINGS
AvataryStringConcatenate = _MODULE.AvataryStringConcatenate


def test_string_concatenate_display_name_and_category():
    assert NODE_CLASS_MAPPINGS["AvataryStringConcatenate"] is AvataryStringConcatenate
    assert NODE_DISPLAY_NAME_MAPPINGS["AvataryStringConcatenate"] == "String Concatenate Avatary"
    assert AvataryStringConcatenate.CATEGORY == "👑 Avatary/Text"


def test_string_concatenate_joins_inputs_in_order():
    node = AvataryStringConcatenate()

    (result,) = node.concatenate(
        delimiter="\n\n",
        string_2="second",
        string_1="first",
        string_3="third",
    )

    assert result == "first\n\nsecond\n\nthird"


def test_string_concatenate_skips_missing_and_empty_inputs():
    node = AvataryStringConcatenate()

    (result,) = node.concatenate(
        delimiter=", ",
        string_1="first",
        string_2="",
        string_4="fourth",
    )

    assert result == "first, fourth"
