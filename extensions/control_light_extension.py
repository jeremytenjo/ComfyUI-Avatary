from __future__ import annotations

from pathlib import Path

from aiohttp import web

import folder_paths
from server import PromptServer


def _controllight_specs() -> list[dict[str, str]]:
    comfy_root = Path(folder_paths.base_path).resolve()
    model_path = comfy_root / "models" / "ControlLight" / "FLUX.2-klein-base-9B"
    lora_path = comfy_root / "models" / "ControlLight" / "controllight.safetensors"
    return [
        {
            "key": "base_model",
            "label": "FLUX.2-klein-base-9B",
            "path": str(model_path),
            "url": "https://huggingface.co/black-forest-labs/FLUX.2-klein-base-9B",
            "kind": "directory",
        },
        {
            "key": "lora",
            "label": "ControlLight LoRA (controllight.safetensors)",
            "path": str(lora_path),
            "url": "https://huggingface.co/ControlLight/ControlLight",
            "kind": "file",
        },
    ]


@PromptServer.instance.routes.get("/avatary/controllight/missing-files")
async def controllight_missing_files(_request: web.Request) -> web.Response:
    items = []
    for spec in _controllight_specs():
        expected_path = Path(spec["path"])
        kind = spec["kind"]
        exists = expected_path.is_dir() if kind == "directory" else expected_path.is_file()
        items.append(
            {
                "key": spec["key"],
                "label": spec["label"],
                "path": spec["path"],
                "url": spec["url"],
                "kind": kind,
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
