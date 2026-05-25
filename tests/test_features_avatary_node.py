import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_features_avatary.py"
SPEC = importlib.util.spec_from_file_location("avatary_node_features", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

AvataryFeatures = MODULE.AvataryFeatures
NODE_CLASS_MAPPINGS = MODULE.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = MODULE.NODE_DISPLAY_NAME_MAPPINGS


def test_features_mapping_and_metadata():
    assert NODE_CLASS_MAPPINGS["AvataryFeatures"] is AvataryFeatures
    assert NODE_DISPLAY_NAME_MAPPINGS["AvataryFeatures"] == "Features Avatary"
    assert AvataryFeatures.CATEGORY == "👑 Avatary/Utilities"


def test_features_noop_returns_empty_tuple():
    node = AvataryFeatures()
    assert node.noop() == ()
