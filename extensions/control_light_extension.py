from __future__ import annotations

from pathlib import Path

from aiohttp import web

import folder_paths
from server import PromptServer


def _controllight_specs(flux_2_klein_base_9B: str, controllight: str) -> list[dict[str, str]]:
    return [
        {
            "key": "base_model",
            "label": "FLUX.2-klein-base-9B",
            "path": flux_2_klein_base_9B,
            "url": "https://huggingface.co/black-forest-labs/FLUX.2-klein-base-9B",
            "kind": "directory",
            "required_type": "Required type: diffusion_models / MODEL",
        },
        {
            "key": "lora",
            "label": "controllight.safetensors",
            "path": controllight,
            "url": "https://huggingface.co/ControlLight/ControlLight",
            "kind": "file",
            "required_type": "Required type: loras / LORA",
        },
    ]


@PromptServer.instance.routes.get("/avatary/controllight/missing-files")
async def controllight_missing_files(request: web.Request) -> web.Response:
    flux_2_klein_base_9B = str(request.query.get("flux_2_klein_base_9B", "")).strip()
    controllight = str(request.query.get("controllight", "")).strip()
    resolved_model = folder_paths.get_full_path("diffusion_models", flux_2_klein_base_9B)
    resolved_lora = folder_paths.get_full_path("loras", controllight)
    items = []
    for spec in _controllight_specs(
        resolved_model or flux_2_klein_base_9B, resolved_lora or controllight
    ):
        expected_path = Path(spec["path"]).expanduser().resolve()
        kind = spec["kind"]
        exists = bool(spec["path"]) and expected_path.exists()
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
