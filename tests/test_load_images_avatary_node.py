import importlib.util
import json
import os
import time
from pathlib import Path

import pytest
from PIL import Image


MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_load_images_avatary.py"
SPEC = importlib.util.spec_from_file_location("avatary_load_image_batch_node", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)

AvataryLoadImageBatch = MODULE.AvataryLoadImageBatch


def _make_image(path: Path, color: tuple[int, int, int]):
    img = Image.new("RGB", (8, 8), color=color)
    img.save(path)


def test_missing_upload_state_raises():
    node = AvataryLoadImageBatch()
    with pytest.raises(FileNotFoundError):
        node.load_images("")


def test_loads_only_valid_existing_uploaded_files(tmp_path: Path, monkeypatch):
    managed = tmp_path / "input" / "avatary_load_image_batch"
    managed.mkdir(parents=True, exist_ok=True)
    _make_image(managed / "a.png", (255, 0, 0))
    _make_image(managed / "b.jpg", (0, 255, 0))
    (managed / "c.txt").write_text("skip", encoding="utf-8")

    monkeypatch.setattr(MODULE.folder_paths, "get_input_directory", lambda: str(tmp_path / "input"))

    node = AvataryLoadImageBatch()
    state = '{"subfolder":"avatary_load_image_batch","files":["a.png","missing.webp","c.txt","b.jpg"]}'
    (images,) = node.load_images(state)

    assert len(images) == 2


def test_keeps_upload_order(tmp_path: Path, monkeypatch):
    managed = tmp_path / "input" / "avatary_load_image_batch"
    managed.mkdir(parents=True, exist_ok=True)
    _make_image(managed / "x.png", (10, 10, 10))
    _make_image(managed / "y.webp", (20, 20, 20))

    monkeypatch.setattr(MODULE.folder_paths, "get_input_directory", lambda: str(tmp_path / "input"))

    node = AvataryLoadImageBatch()
    state = '{"subfolder":"avatary_load_image_batch","files":["y.webp","x.png"]}'
    source_dir, files = node._resolve_upload_files(state)

    assert Path(source_dir).name == "avatary_load_image_batch"
    assert files == ["y.webp", "x.png"]


def test_no_valid_files_raises(tmp_path: Path, monkeypatch):
    managed = tmp_path / "input" / "avatary_load_image_batch"
    managed.mkdir(parents=True, exist_ok=True)
    (managed / "readme.md").write_text("no image", encoding="utf-8")

    monkeypatch.setattr(MODULE.folder_paths, "get_input_directory", lambda: str(tmp_path / "input"))

    node = AvataryLoadImageBatch()
    state = '{"subfolder":"avatary_load_image_batch","files":["readme.md"]}'
    with pytest.raises(FileNotFoundError):
        node.load_images(state)


def test_path_mode_loads_newest_first(tmp_path: Path, monkeypatch):
    comfy_root = tmp_path / "ComfyUI"
    target = comfy_root / "input" / "path_mode_set"
    target.mkdir(parents=True, exist_ok=True)
    older = target / "a.png"
    newer = target / "b.jpg"
    _make_image(older, (10, 10, 10))
    _make_image(newer, (20, 20, 20))
    now = time.time()
    os.utime(older, (now - 60, now - 60))
    os.utime(newer, (now - 10, now - 10))

    monkeypatch.setattr(MODULE.folder_paths, "base_path", str(comfy_root))

    node = AvataryLoadImageBatch()
    state = json.dumps({"mode": "path", "folder_path": str(target)})
    source_dir, files = node._resolve_upload_files(state)
    assert Path(source_dir) == target
    assert files == ["b.jpg", "a.png"]


def test_path_mode_rejects_outside_comfy_root(tmp_path: Path, monkeypatch):
    comfy_root = tmp_path / "ComfyUI"
    comfy_root.mkdir(parents=True, exist_ok=True)
    outside = tmp_path / "outside_folder"
    outside.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(MODULE.folder_paths, "base_path", str(comfy_root))

    node = AvataryLoadImageBatch()
    state = json.dumps({"mode": "path", "folder_path": str(outside)})
    with pytest.raises(FileNotFoundError):
        node._resolve_upload_files(state)
