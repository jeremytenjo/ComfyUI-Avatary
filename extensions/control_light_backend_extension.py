from __future__ import annotations

import asyncio
from pathlib import Path

from aiohttp import web

import folder_paths
from server import PromptServer


def _controllight_specs() -> list[dict[str, str]]:
    model_root = Path(folder_paths.models_dir).resolve()
    return [
        {
            "key": "base_model",
            "label": "FLUX.2-klein-base-9B",
            "path": str(model_root / "diffusion_models" / "FLUX.2-klein-base-9B"),
            "url": "https://huggingface.co/black-forest-labs/FLUX.2-klein-base-9B",
            "kind": "directory",
            "required_type": "Output: models/diffusion_models",
        },
        {
            "key": "lora",
            "label": "controllight.safetensors",
            "path": str(model_root / "loras" / "controllight.safetensors"),
            "url": "https://huggingface.co/ControlLight/ControlLight",
            "kind": "file",
            "required_type": "Output: models/loras",
        },
    ]


def _initialize_assets(hf_token: str = "") -> dict[str, object]:
    try:
        from huggingface_hub import hf_hub_download, snapshot_download
    except Exception as exc:
        raise RuntimeError(
            "huggingface_hub is required for Initialize. Install it in your ComfyUI environment."
        ) from exc

    model_root = Path(folder_paths.models_dir).resolve()
    diffusion_models_dir = model_root / "diffusion_models"
    loras_dir = model_root / "loras"
    diffusion_models_dir.mkdir(parents=True, exist_ok=True)
    loras_dir.mkdir(parents=True, exist_ok=True)

    token = hf_token.strip() or None
    snapshot_path = snapshot_download(
        repo_id="black-forest-labs/FLUX.2-klein-base-9B",
        local_dir=str(diffusion_models_dir / "FLUX.2-klein-base-9B"),
        token=token,
        local_dir_use_symlinks=False,
        resume_download=True,
    )
    lora_path = hf_hub_download(
        repo_id="ControlLight/ControlLight",
        filename="controllight.safetensors",
        local_dir=str(loras_dir),
        token=token,
        local_dir_use_symlinks=False,
        resume_download=True,
    )
    return {
        "ok": True,
        "base_model_path": snapshot_path,
        "lora_path": lora_path,
    }


@PromptServer.instance.routes.get("/avatary/controllight/missing-files")
async def controllight_missing_files(_request: web.Request) -> web.Response:
    items = []
    for spec in _controllight_specs():
        expected_path = Path(spec["path"]).expanduser().resolve()
        kind = spec["kind"]
        exists = expected_path.is_dir() if kind == "directory" else expected_path.is_file()
        items.append(
            {
                "key": spec["key"],
                "label": spec["label"],
                "path": spec["path"],
                "url": spec["url"],
                "kind": kind,
                "required_type": spec.get("required_type", ""),
                "missing": not exists,
            }
        )

    return web.json_response(
        {
            "ok": True,
            "items": items,
            "has_missing": any(item["missing"] for item in items),
        }
    )


@PromptServer.instance.routes.post("/avatary/controllight/initialize")
async def controllight_initialize(request: web.Request) -> web.Response:
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    hf_token = str(payload.get("hf_token", "")).strip() if isinstance(payload, dict) else ""

    try:
        result = await asyncio.to_thread(_initialize_assets, hf_token)
        return web.json_response(result)
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=400)
