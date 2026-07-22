import importlib.util
from pathlib import Path


_MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_return_true_backend.py"
_SPEC = importlib.util.spec_from_file_location("avatary_node_return_true", _MODULE_PATH)
assert _SPEC and _SPEC.loader
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

NODE_CLASS_MAPPINGS = _MODULE.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = _MODULE.NODE_DISPLAY_NAME_MAPPINGS
AvataryReturnTrue = _MODULE.AvataryReturnTrue


def test_return_true_display_name_and_category():
    assert NODE_CLASS_MAPPINGS["AvataryReturnTrue"] is AvataryReturnTrue
    assert NODE_DISPLAY_NAME_MAPPINGS["AvataryReturnTrue"] == "Return True Avatary"
    assert AvataryReturnTrue.CATEGORY == "👑 Avatary/Utilities"
    assert AvataryReturnTrue.RETURN_TYPES == ("*",)


def test_return_true_returns_first_truthy_argument_in_order():
    node = AvataryReturnTrue()

    (result,) = node.return_true(
        arg_1="",
        arg_2=0,
        arg_3="selected",
        arg_4="ignored",
    )

    assert result == "selected"


def test_return_true_returns_none_when_no_argument_is_truthy():
    node = AvataryReturnTrue()

    (result,) = node.return_true(arg_1="", arg_2=False, arg_3=None)

    assert result is None


def test_return_true_treats_opaque_connected_values_as_truthy():
    class Opaque:
        def __bool__(self):
            raise RuntimeError("ambiguous")

    value = Opaque()
    node = AvataryReturnTrue()

    (result,) = node.return_true(arg_1=value)

    assert result is value
