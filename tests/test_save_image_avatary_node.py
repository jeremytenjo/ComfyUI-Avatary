import importlib.util
import sys
import types
from pathlib import Path

import numpy as np
from PIL import Image


class _FakeTensor:
    def __init__(self, arr):
        self._arr = arr
        self.shape = arr.shape

    def cpu(self):
        return self

    def numpy(self):
        return self._arr


def _load_module(tmp_path: Path, disable_metadata: bool):
    module_path = Path(__file__).resolve().parents[1] / "nodes" / "node_save_image_avatary_backend.py"
    spec = importlib.util.spec_from_file_location("avatary_save_image_ultra_node", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader

    fake_folder_paths = types.SimpleNamespace(
        get_output_directory=lambda: str(tmp_path),
        get_save_image_path=lambda *_args, **_kwargs: (str(tmp_path), "ComfyUI", 1, "", None),
    )
    fake_cli_args = types.SimpleNamespace(args=types.SimpleNamespace(disable_metadata=disable_metadata))

    sys.modules["folder_paths"] = fake_folder_paths
    sys.modules["comfy"] = types.ModuleType("comfy")
    sys.modules["comfy.cli_args"] = fake_cli_args

    spec.loader.exec_module(module)
    return module


def _run_save(node, attach_prompt_metadata: bool, prompt):
    image = _FakeTensor(np.zeros((4, 4, 3), dtype=np.float32))
    result = node.save_images([image], attach_prompt_metadata=attach_prompt_metadata, prompt=prompt)
    filename = result["ui"]["images"][0]["filename"]
    return filename


def test_save_image_ultra_strips_metadata_by_default(tmp_path: Path):
    module = _load_module(tmp_path, disable_metadata=False)
    node = module.SaveImageWithPromptToggle()

    filename = _run_save(node, attach_prompt_metadata=False, prompt={"text": "hello"})
    img = Image.open(tmp_path / filename)

    assert "prompt" not in img.info
    assert "workflow" not in img.info


def test_save_image_ultra_writes_only_prompt_metadata_when_enabled(tmp_path: Path):
    module = _load_module(tmp_path, disable_metadata=False)
    node = module.SaveImageWithPromptToggle()

    filename = _run_save(
        node,
        attach_prompt_metadata=True,
        prompt={"node": {"text": "portrait prompt"}},
    )
    img = Image.open(tmp_path / filename)

    assert img.info == {"prompt": "portrait prompt"}


def test_save_image_ultra_respects_disable_metadata_flag(tmp_path: Path):
    module = _load_module(tmp_path, disable_metadata=True)
    node = module.SaveImageWithPromptToggle()

    filename = _run_save(node, attach_prompt_metadata=True, prompt={"text": "kept out"})
    img = Image.open(tmp_path / filename)

    assert "prompt" not in img.info
