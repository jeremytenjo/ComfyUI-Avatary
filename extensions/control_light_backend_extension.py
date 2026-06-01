from __future__ import annotations

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
