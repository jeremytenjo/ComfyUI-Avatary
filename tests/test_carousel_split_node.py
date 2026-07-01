import importlib.util
from pathlib import Path

import pytest
import torch


MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_carousel_split_backend.py"
SPEC = importlib.util.spec_from_file_location("avatary_carousel_split_node", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

CarouselSplit = MODULE.CarouselSplit
NODE_CLASS_MAPPINGS = MODULE.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = MODULE.NODE_DISPLAY_NAME_MAPPINGS


def _make_grid_image(height: int = 64, panel_width: int = 64, panels: int = 3) -> torch.Tensor:
    panel_images = []
    for panel_index in range(panels):
        value = (panel_index + 1) / 4.0
        panel_images.append(torch.full((height, panel_width, 3), value, dtype=torch.float32))
    return torch.cat(panel_images, dim=1).unsqueeze(0)


def _make_grid_image_with_gaps(
    height: int = 64,
    panel_width: int = 64,
    panels: int = 3,
    gap: int = 4,
) -> torch.Tensor:
    panel_images = []
    gap_image = torch.zeros((height, gap, 3), dtype=torch.float32)
    for panel_index in range(panels):
        value = (panel_index + 1) / 4.0
        panel_images.append(torch.full((height, panel_width, 3), value, dtype=torch.float32))
        if panel_index < panels - 1:
            panel_images.append(gap_image)
    return torch.cat(panel_images, dim=1).unsqueeze(0)


def _make_horizontal_grid_image(width: int = 64, panel_height: int = 64, panels: int = 3) -> torch.Tensor:
    panel_images = []
    for panel_index in range(panels):
        value = (panel_index + 1) / 4.0
        panel_images.append(torch.full((panel_height, width, 3), value, dtype=torch.float32))
    return torch.cat(panel_images, dim=0).unsqueeze(0)


def test_carousel_split_mapping_and_metadata():
    assert NODE_CLASS_MAPPINGS["GridSplit"] is CarouselSplit
    assert NODE_DISPLAY_NAME_MAPPINGS["GridSplit"] == "Carousel Split Avatary"
    assert CarouselSplit.RETURN_TYPES == ("IMAGE", "INT", "IMAGE")
    assert CarouselSplit.RETURN_NAMES == ("panels", "count", "preview")
    assert CarouselSplit.CATEGORY == "👑 Avatary/Image"
    assert set(CarouselSplit.INPUT_TYPES()["required"].keys()) == {"image", "direction"}


def test_auto_detects_three_zero_gap_panels_and_draws_preview_lines():
    node = CarouselSplit()
    image = _make_grid_image()

    panels, count, preview = node.split(image)

    assert count == 3
    assert panels.shape == (3, 64, 64, 3)
    assert preview.shape == image.shape
    assert torch.allclose(panels[0], image[0, :, 0:64, :])
    assert torch.allclose(panels[1], image[0, :, 64:128, :])
    assert torch.allclose(panels[2], image[0, :, 128:192, :])
    assert torch.all(preview[0, :, 63:66, 0] == 1.0)
    assert torch.all(preview[0, :, 127:130, 0] == 1.0)
    assert torch.all(preview[0, :, 63:66, 1:] == 0.0)


def test_horizontal_direction_detects_stacked_panels_and_draws_preview_lines():
    node = CarouselSplit()
    image = _make_horizontal_grid_image()

    panels, count, preview = node.split(image, direction="horizontal")

    assert count == 3
    assert panels.shape == (3, 64, 64, 3)
    assert preview.shape == image.shape
    assert torch.allclose(panels[0], image[0, 0:64, :, :])
    assert torch.allclose(panels[1], image[0, 64:128, :, :])
    assert torch.allclose(panels[2], image[0, 128:192, :, :])
    assert torch.all(preview[0, 63:66, :, 0] == 1.0)
    assert torch.all(preview[0, 127:130, :, 0] == 1.0)
    assert torch.all(preview[0, 63:66, :, 1:] == 0.0)


def test_auto_detects_and_excludes_separator_gap_pixels():
    node = CarouselSplit()
    image = _make_grid_image_with_gaps()

    panels, count, preview = node.split(image)

    assert count == 3
    assert panels.shape == (3, 64, 64, 3)
    assert torch.allclose(panels[0], image[0, :, 0:64, :])
    assert torch.allclose(panels[1], image[0, :, 68:132, :])
    assert torch.allclose(panels[2], image[0, :, 136:200, :])
    assert torch.all(preview[0, :, 63:66, 0] == 1.0)
    assert torch.all(preview[0, :, 67:70, 0] == 1.0)
    assert torch.all(preview[0, :, 131:134, 0] == 1.0)
    assert torch.all(preview[0, :, 135:138, 0] == 1.0)


def test_auto_ignores_partial_height_internal_edges():
    node = CarouselSplit()
    image = _make_grid_image()
    image[0, 12:36, 32:34, :] = 0.0
    image[0, 28:52, 160:162, :] = 0.0

    panels, count, _preview = node.split(image)

    assert count == 3
    assert panels.shape == (3, 64, 64, 3)


def test_invalid_image_rank_raises_clear_error():
    node = CarouselSplit()
    with pytest.raises(ValueError, match="Expected IMAGE tensor with shape \\[B, H, W, C\\]"):
        node.split(torch.zeros((8, 8, 3), dtype=torch.float32))


def test_no_detected_seams_returns_original_image_as_single_panel():
    node = CarouselSplit()
    image = torch.full((1, 64, 192, 3), 0.5, dtype=torch.float32)

    panels, count, preview = node.split(image)

    assert count == 1
    assert panels.shape == image.shape
    assert torch.allclose(panels, image)
    assert torch.allclose(preview, image)
