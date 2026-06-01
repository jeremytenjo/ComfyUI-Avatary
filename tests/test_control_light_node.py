import importlib.util
from pathlib import Path

import pytest
import torch


MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_control_light.py"
SPEC = importlib.util.spec_from_file_location("avatary_control_light_node", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

ControlLight = MODULE.ControlLight
NODE_CLASS_MAPPINGS = MODULE.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = MODULE.NODE_DISPLAY_NAME_MAPPINGS


def test_control_light_mapping_and_metadata():
    assert NODE_CLASS_MAPPINGS["ControlLight"] is ControlLight
    assert NODE_DISPLAY_NAME_MAPPINGS["ControlLight"] == "ControlLight Avatary"
    assert ControlLight.CATEGORY == "👑 Avatary/Image"


def test_scale_validation_bounds():
    node = ControlLight()
    image = torch.zeros((1, 8, 8, 3), dtype=torch.float32)
    model_dir = "/tmp/flux_2_klein_base_9B"
    lora_path = "/tmp/controllight.safetensors"
    with pytest.raises(ValueError, match="scale must be in \\[0, 1\\]"):
        node.enhance(image, -0.1, model_dir, lora_path)
    with pytest.raises(ValueError, match="scale must be in \\[0, 1\\]"):
        node.enhance(image, 1.1, model_dir, lora_path)


def test_missing_model_paths_raise():
    with pytest.raises(RuntimeError, match="ControlLight model path not found"):
        ControlLight._resolve_model_paths("/path/that/does/not/exist", "/tmp/controllight.safetensors")


def test_dependency_missing_error(monkeypatch, tmp_path: Path):
    model_dir = tmp_path / "flux_2_klein_base_9B"
    lora_path = tmp_path / "controllight.safetensors"
    model_dir.mkdir(parents=True, exist_ok=True)
    lora_path.write_bytes(b"fake")

    def _raise_import_error():
        raise RuntimeError("ControlLightPipeline is unavailable")

    monkeypatch.setattr(ControlLight, "_import_pipeline", staticmethod(_raise_import_error))
    with pytest.raises(RuntimeError, match="ControlLightPipeline is unavailable"):
        ControlLight._get_pipeline(
            device="cpu",
            dtype=torch.float32,
            flux_2_klein_base_9B=str(model_dir),
            controllight=str(lora_path),
        )
