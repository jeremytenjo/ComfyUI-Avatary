import importlib.util
from pathlib import Path

import pytest
import torch


MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_control_light_backend.py"
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
    with pytest.raises(ValueError, match="scale must be in \\[0, 1\\]"):
        node.enhance(image, -0.1)
    with pytest.raises(ValueError, match="scale must be in \\[0, 1\\]"):
        node.enhance(image, 1.1)


def test_missing_model_paths_raise(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(MODULE.folder_paths, "models_dir", str(tmp_path))
    with pytest.raises(RuntimeError, match="ControlLight model path not found"):
        ControlLight._resolve_model_paths()


def test_dependency_missing_error(monkeypatch, tmp_path: Path):
    model_dir = tmp_path / "diffusion_models" / "FLUX.2-klein-base-9B"
    lora_path = tmp_path / "loras" / "controllight.safetensors"
    model_dir.mkdir(parents=True, exist_ok=True)
    lora_path.parent.mkdir(parents=True, exist_ok=True)
    lora_path.write_bytes(b"fake")

    def _raise_import_error():
        raise RuntimeError("ControlLightPipeline is unavailable")

    monkeypatch.setattr(ControlLight, "_import_pipeline", staticmethod(_raise_import_error))
    monkeypatch.setattr(MODULE.folder_paths, "models_dir", str(tmp_path))
    with pytest.raises(RuntimeError, match="ControlLightPipeline is unavailable"):
        ControlLight._get_pipeline(device="cpu", dtype=torch.float32)
