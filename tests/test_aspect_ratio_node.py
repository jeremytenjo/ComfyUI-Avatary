import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_aspect_ratio_backend.py"
SPEC = importlib.util.spec_from_file_location("avatary_aspect_ratio_node", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)

AspectRatio = MODULE.AspectRatio
NODE_CLASS_MAPPINGS = MODULE.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = MODULE.NODE_DISPLAY_NAME_MAPPINGS


def test_aspect_ratio_mapping_and_metadata():
    assert NODE_CLASS_MAPPINGS["AvataryAspectRatio"] is AspectRatio
    assert NODE_DISPLAY_NAME_MAPPINGS["AvataryAspectRatio"] == "Aspect Ratio Avatary"
    assert AspectRatio.CATEGORY == "👑 Avatary/Utilities"


def test_aspect_ratio_returns_selected_dimensions():
    node = AspectRatio()

    assert node.resolve("16:9: 1920×1080") == (1920, 1080)
    assert node.resolve("1:1: 1328×1328") == (1328, 1328)
    assert node.resolve("2:3: 1056×1584") == (1056, 1584)


def test_aspect_ratio_accepts_selector_output():
    node = AspectRatio()

    assert node.resolve(
        "9:16: 1080×1920",
        aspect_ratio="3:4: 1104×1472",
    ) == (1104, 1472)


def test_aspect_ratio_overrides_only_when_width_and_height_are_positive():
    node = AspectRatio()

    assert node.resolve("9:16: 1080×1920", width=1024, height=768) == (1024, 768)
    assert node.resolve("9:16: 1080×1920", width=1024, height=0) == (1080, 1920)
    assert node.resolve("9:16: 1080×1920", width=0, height=768) == (1080, 1920)
