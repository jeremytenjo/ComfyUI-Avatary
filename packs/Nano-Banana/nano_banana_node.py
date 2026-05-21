"""ComfyUI custom node for Nano Banana Pro image generation via Gemini API."""

from __future__ import annotations

import base64
import logging
from io import BytesIO
from typing import Any

import numpy as np
import requests
import torch
from PIL import Image

logger = logging.getLogger(__name__)


class NanoBananaProImage:
    """Generate image(s) from prompt text using Gemini Nano Banana Pro."""

    API_URL = (
        "https://generativelanguage.googleapis.com/v1beta/"
        "models/gemini-3-pro-image-preview:generateContent"
    )
    _CACHE: dict[tuple[str, str, str, str], torch.Tensor] = {}
    _ASPECT_RATIO_LABELS = (
        "9:16 (768x1344)",
        "1:1 (1024x1024)",
        "2:3 (832x1248)",
        "3:2 (1248x832)",
        "3:4 (864x1184)",
        "4:3 (1184x864)",
        "4:5 (896x1152)",
        "5:4 (1152x896)",
        "16:9 (1344x768)",
        "21:9 (1536x672)",
    )
    _ASPECT_RATIOS = tuple(label.split(" ", 1)[0] for label in _ASPECT_RATIO_LABELS)
    _RESOLUTIONS = ("1K", "2K", "4K")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "api_key": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": False,
                        "display": "API Key",
                    },
                ),
                "prompt": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": True,
                    },
                ),
                "size": (cls._ASPECT_RATIO_LABELS, {"default": "9:16 (768x1344)"}),
                "resolution": (cls._RESOLUTIONS, {"default": "1K"}),
            },
            "optional": {
                "image": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "generate_image"
    CATEGORY = "api/image"

    def generate_image(
        self,
        api_key: str,
        prompt: str,
        size: str = "9:16 (768x1344)",
        resolution: str = "1K",
        image: torch.Tensor | None = None,
    ):
        api_key = (api_key or "").strip()
        prompt = (prompt or "").strip()
        size = (size or "9:16 (768x1344)").strip()
        aspect_ratio = size.split(" ", 1)[0]
        resolution = (resolution or "1K").strip().upper()

        if not api_key:
            raise ValueError("api_key is required")
        prompts = self._split_prompts(prompt)
        if not prompts:
            raise ValueError("prompt is required")
        if aspect_ratio not in self._ASPECT_RATIOS:
            raise ValueError(f"size must be one of {', '.join(self._ASPECT_RATIO_LABELS)}")
        if resolution not in self._RESOLUTIONS:
            raise ValueError(f"resolution must be one of {', '.join(self._RESOLUTIONS)}")

        image_size = self._get_image_size(image)
        input_image_part = self._build_input_image_part(image)
        output_images: list[torch.Tensor] = []

        for single_prompt in prompts:
            cache_key = (image_size, single_prompt, aspect_ratio, resolution)
            cached = self._CACHE.get(cache_key)
            if cached is not None:
                output_images.append(cached.clone())
                continue

            image_tensor = self._generate_single(
                api_key=api_key,
                prompt=single_prompt,
                aspect_ratio=aspect_ratio,
                image_size=resolution,
                input_image_part=input_image_part,
            )
            self._CACHE[cache_key] = image_tensor.clone()
            output_images.append(image_tensor)

        return (torch.cat(output_images, dim=0),)

    @staticmethod
    def _split_prompts(prompt_text: str) -> list[str]:
        return [part.strip() for part in prompt_text.split("**") if part.strip()]

    def _build_input_image_part(self, image: torch.Tensor | None) -> dict[str, Any] | None:
        if image is None:
            return None
        image_bytes = self._comfy_tensor_to_png_bytes(image)
        return {
            "inlineData": {
                "mimeType": "image/png",
                "data": base64.b64encode(image_bytes).decode("utf-8"),
            }
        }

    def _generate_single(
        self,
        api_key: str,
        prompt: str,
        aspect_ratio: str,
        image_size: str,
        input_image_part: dict[str, Any] | None,
    ) -> torch.Tensor:
        parts: list[dict[str, Any]] = []
        if input_image_part is not None:
            parts.append(input_image_part)
        parts.append({"text": prompt})

        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {
                    "aspectRatio": aspect_ratio,
                    "imageSize": image_size,
                },
            },
        }

        try:
            response = requests.post(
                f"{self.API_URL}?key={api_key}",
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=120,
            )
        except requests.exceptions.RequestException as exc:
            logger.exception("Nano Banana API request failed")
            raise RuntimeError(f"Nano Banana API request failed: {exc}") from exc

        if not response.ok:
            message = self._extract_error_message(response)
            logger.warning("Nano Banana API error status=%s message=%s", response.status_code, message)
            raise RuntimeError(f"Nano Banana API error ({response.status_code}): {message}")

        try:
            data = response.json()
        except ValueError as exc:
            logger.exception("Failed to parse Nano Banana API JSON response")
            raise RuntimeError("Nano Banana API returned invalid JSON") from exc

        image_bytes = self._extract_first_image_bytes(data)
        return self._bytes_to_comfy_tensor(image_bytes)

    @staticmethod
    def _extract_error_message(response: requests.Response) -> str:
        try:
            payload = response.json()
            return payload.get("error", {}).get("message") or response.text[:500] or "unknown error"
        except ValueError:
            return response.text[:500] or "unknown error"

    @staticmethod
    def _extract_first_image_bytes(payload: dict[str, Any]) -> bytes:
        candidates = payload.get("candidates") or []
        for candidate in candidates:
            parts = (candidate.get("content") or {}).get("parts") or []
            for part in parts:
                inline_data = part.get("inlineData") or {}
                mime_type = (inline_data.get("mimeType") or "").lower()
                b64_data = inline_data.get("data")
                if mime_type.startswith("image/") and b64_data:
                    try:
                        return base64.b64decode(b64_data)
                    except (ValueError, TypeError) as exc:
                        raise RuntimeError("Nano Banana returned invalid base64 image data") from exc

        raise RuntimeError("Nano Banana did not return an image in the response")

    @staticmethod
    def _bytes_to_comfy_tensor(image_bytes: bytes) -> torch.Tensor:
        try:
            with Image.open(BytesIO(image_bytes)) as img:
                image = img.convert("RGB")
        except Exception as exc:
            raise RuntimeError("Failed to decode image bytes from Nano Banana response") from exc

        array = np.array(image).astype(np.float32) / 255.0
        return torch.from_numpy(array).unsqueeze(0)

    @staticmethod
    def _comfy_tensor_to_png_bytes(image: torch.Tensor) -> bytes:
        if image.ndim != 4:
            raise ValueError("Expected IMAGE tensor with shape [B, H, W, C]")
        sample = image[0].detach().cpu().numpy()
        sample = np.clip(sample, 0.0, 1.0)
        sample = (sample * 255.0).astype(np.uint8)
        pil_image = Image.fromarray(sample)
        output = BytesIO()
        pil_image.save(output, format="PNG")
        return output.getvalue()

    @staticmethod
    def _get_image_size(image: torch.Tensor | None) -> str:
        if image is None:
            return "none"
        if image.ndim != 4:
            raise ValueError("Expected IMAGE tensor with shape [B, H, W, C]")
        _, height, width, _ = image.shape
        return f"{int(width)}x{int(height)}"


NODE_CLASS_MAPPINGS = {
    "NanoBananaProImage": NanoBananaProImage,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NanoBananaProImage": "Nano Banana Pro",
}
