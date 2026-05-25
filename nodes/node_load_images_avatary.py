import hashlib
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

import folder_paths
import torch


class AvataryLoadImageBatch:
    MANAGED_SUBFOLDER = "avatary_load_image_batch"
    VALID_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {
                "UploadState": ("STRING", {"default": ""}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("IMAGE",)
    OUTPUT_IS_LIST = (True,)
    FUNCTION = "load_images"
    CATEGORY = "👑 Avatary/Image"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        state = cls._parse_upload_state(kwargs.get("UploadState") or "")
        digest = hashlib.sha256()
        digest.update(json.dumps(state, sort_keys=True).encode("utf-8"))
        return digest.hexdigest()

    @classmethod
    def _parse_upload_state(cls, raw_state: str) -> dict:
        if not raw_state:
            return {}
        try:
            parsed = json.loads(raw_state)
        except (TypeError, ValueError):
            return {}
        if not isinstance(parsed, dict):
            return {}
        return parsed

    @classmethod
    def _resolve_upload_files(cls, upload_state: str) -> tuple[str, list[str]]:
        state = cls._parse_upload_state(upload_state)
        mode = str(state.get("mode") or "").strip().lower()
        if mode == "path":
            return cls._resolve_path_mode_files(state)

        files = state.get("files")
        if not isinstance(files, list) or not files:
            raise FileNotFoundError("No uploaded images were selected.")
        source_dir = str(state.get("source_dir") or "").strip()
        if source_dir:
            base_dir = os.path.abspath(source_dir)
        else:
            subfolder = str(state.get("subfolder") or cls.MANAGED_SUBFOLDER).strip("/\\")
            base_dir = os.path.join(folder_paths.get_input_directory(), subfolder)

        existing = []
        for name in files:
            filename = Path(str(name or "")).name
            if not filename:
                continue
            ext = Path(filename).suffix.lower()
            if ext not in cls.VALID_EXTENSIONS:
                continue
            full = os.path.join(base_dir, filename)
            if os.path.isfile(full):
                existing.append(filename)

        if not existing:
            raise FileNotFoundError(f"No valid uploaded images found in '{base_dir}'.")

        return (base_dir, existing)

    @classmethod
    def _resolve_path_mode_files(cls, state: dict) -> tuple[str, list[str]]:
        folder_path = str(state.get("folder_path") or "").strip()
        if not folder_path:
            raise FileNotFoundError("Path mode is enabled but no folder path was provided.")

        comfy_root = os.path.realpath(os.path.abspath(folder_paths.base_path))
        base_dir = os.path.realpath(os.path.abspath(folder_path))
        if os.path.commonpath([base_dir, comfy_root]) != comfy_root:
            raise FileNotFoundError("Folder path must be inside ComfyUI root.")
        if not os.path.isdir(base_dir):
            raise FileNotFoundError(f"Folder path does not exist: '{base_dir}'.")

        entries = []
        for name in os.listdir(base_dir):
            filename = Path(str(name or "")).name
            if not filename:
                continue
            ext = Path(filename).suffix.lower()
            if ext not in cls.VALID_EXTENSIONS:
                continue
            full = os.path.join(base_dir, filename)
            if not os.path.isfile(full):
                continue
            try:
                mtime = os.path.getmtime(full)
            except OSError:
                continue
            entries.append((float(mtime), filename))

        if not entries:
            raise FileNotFoundError(f"No valid images found in path folder '{base_dir}'.")

        entries.sort(key=lambda item: (-item[0], item[1].lower()))
        return (base_dir, [filename for _, filename in entries])

    def load_images(self, UploadState: str = ""):
        source_dir, image_files = self._resolve_upload_files(UploadState)

        images = []
        for filename in image_files:
            img_path = os.path.join(source_dir, filename)
            try:
                image = ImageOps.exif_transpose(Image.open(img_path)).convert("RGB")
                image = torch.from_numpy(np.array(image).astype(np.float32) / 255.0)[None,]
                images.append(image)
            except Exception as exc:
                print(f"\033[91mError loading {filename}: {str(exc)}\033[0m")
                continue

        if not images:
            raise FileNotFoundError(f"No loadable uploaded images found in '{source_dir}'.")

        return (images,)


NODE_CLASS_MAPPINGS = {
    "AvataryLoadImageBatch": AvataryLoadImageBatch,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AvataryLoadImageBatch": "Load Images Avatary",
}
