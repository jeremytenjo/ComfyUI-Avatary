from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

import folder_paths
import torch


class ControlLight:
    DEFAULT_PROMPT = (
        "Enhance this low-light image by lifting exposure and recovering visible details "
        "while preserving identity, geometry, atmosphere, natural colors, and avoiding halos, "
        "noise, over-sharpening, or overexposure."
    )
    DEFAULT_STEPS = 20
    DEFAULT_GUIDANCE = 1.0
    DEFAULT_SEED = 42
    _PIPELINE_CACHE: dict[tuple[str, str], object] = {}

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "scale": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.01}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "enhance"
    CATEGORY = "👑 Avatary/Image"

    @classmethod
    def _resolve_model_paths(cls) -> tuple[Path, Path]:
        comfy_root = Path(folder_paths.base_path).resolve()
        model_path = (comfy_root / "models" / "ControlLight" / "FLUX.2-klein-base-9B").resolve()
        lora_path = (comfy_root / "models" / "ControlLight" / "controllight.safetensors").resolve()
        if not model_path.is_dir():
            raise RuntimeError(
                "ControlLight model path not found: "
                f"'{model_path}'. Expected '<ComfyUI root>/models/ControlLight/FLUX.2-klein-base-9B'."
            )
        if not lora_path.is_file():
            raise RuntimeError(
                "ControlLight LoRA path not found: "
                f"'{lora_path}'. Expected '<ComfyUI root>/models/ControlLight/controllight.safetensors'."
            )
        return model_path, lora_path

    @staticmethod
    def _import_pipeline():
        try:
            from diffusers import ControlLightPipeline  # type: ignore
        except Exception as exc:
            raise RuntimeError(
                "ControlLightPipeline is unavailable. Install the patched ControlLight diffusers package "
                "from https://github.com/yfyang007/ControlLight."
            ) from exc
        return ControlLightPipeline

    @classmethod
    def _get_pipeline(cls, device: str, dtype: torch.dtype):
        model_path, lora_path = cls._resolve_model_paths()
        cache_key = (device, str(dtype))
        cached = cls._PIPELINE_CACHE.get(cache_key)
        if cached is not None:
            return cached

        ControlLightPipeline = cls._import_pipeline()
        pipe = ControlLightPipeline.from_pretrained(
            str(model_path),
            torch_dtype=dtype,
            default_lora_path=str(lora_path),
            default_prompt=cls.DEFAULT_PROMPT,
            default_num_inference_steps=cls.DEFAULT_STEPS,
            default_guidance_scale=cls.DEFAULT_GUIDANCE,
        )
        if device.startswith("cuda"):
            pipe.enable_model_cpu_offload(device=device)
        else:
            pipe.to(device)
        cls._PIPELINE_CACHE[cache_key] = pipe
        return pipe

    @staticmethod
    def _tensor_to_pil(image: torch.Tensor) -> Image.Image:
        arr = image.detach().cpu().numpy()
        arr = np.clip(arr, 0.0, 1.0)
        arr = (arr * 255.0).astype(np.uint8)
        return Image.fromarray(arr, mode="RGB")

    @staticmethod
    def _pil_to_tensor(image: Image.Image) -> torch.Tensor:
        arr = np.array(image.convert("RGB")).astype(np.float32) / 255.0
        return torch.from_numpy(arr)

    def enhance(self, image: torch.Tensor, scale: float):
        try:
            alpha = float(scale)
        except (TypeError, ValueError) as exc:
            raise ValueError("scale must be a float in [0, 1]") from exc
        if alpha < 0.0 or alpha > 1.0:
            raise ValueError("scale must be in [0, 1]")
        if image.ndim != 4:
            raise ValueError("Expected IMAGE tensor with shape [B, H, W, C]")

        use_cuda = torch.cuda.is_available()
        device = "cuda" if use_cuda else "cpu"
        dtype = torch.bfloat16 if use_cuda else torch.float32
        pipe = self._get_pipeline(device=device, dtype=dtype)

        outputs: list[torch.Tensor] = []
        for idx in range(image.shape[0]):
            input_image = self._tensor_to_pil(image[idx])
            result = pipe(
                image=input_image,
                alpha=alpha,
                prompt=self.DEFAULT_PROMPT,
                seed=self.DEFAULT_SEED,
                num_inference_steps=self.DEFAULT_STEPS,
                guidance_scale=self.DEFAULT_GUIDANCE,
            )
            output_image = result.images[0]
            outputs.append(self._pil_to_tensor(output_image))

        return (torch.stack(outputs, dim=0),)


NODE_CLASS_MAPPINGS = {
    "ControlLight": ControlLight,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ControlLight": "ControlLight Avatary",
}
