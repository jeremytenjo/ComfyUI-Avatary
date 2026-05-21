import importlib.util
from pathlib import Path


_MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_switch.py"
_SPEC = importlib.util.spec_from_file_location("avatary_node_switch", _MODULE_PATH)
assert _SPEC and _SPEC.loader
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

AvatarySwitch = _MODULE.AvatarySwitch
NODE_CLASS_MAPPINGS = _MODULE.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = _MODULE.NODE_DISPLAY_NAME_MAPPINGS


def test_switch_mapping_and_metadata():
    assert NODE_CLASS_MAPPINGS["AvatarySwitch"] is AvatarySwitch
    assert NODE_DISPLAY_NAME_MAPPINGS["AvatarySwitch"] == "Switch Avatary"
    assert AvatarySwitch.CATEGORY == "👑 Avatary/Utilities"


def test_switch_returns_active_input():
    node = AvatarySwitch()
    (out,) = node.pick(SwitchState="2", input_1="a", input_2="b")
    assert out == "b"
