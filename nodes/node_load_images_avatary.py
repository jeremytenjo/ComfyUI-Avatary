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
        files = state.get("files")
        if not isinstance(files, list) or not files:
            raise FileNotFoundError("No uploaded images were selected.")

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
