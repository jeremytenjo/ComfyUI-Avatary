"""ComfyUI-Avatary meta pack.

Loads selected custom node packs and exposes their nodes through one package.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

BASE_DIR = Path(__file__).resolve().parent
PACKS_DIR = BASE_DIR / "packs"

# Highlighted packs from your screenshot.
PACKS = [
    "Downloader",
    "Group-Bypasser",
    "Nano-Banana",
    "Prompts",
    "Save-Image-Ultra",
    "Switch",
]

NODE_CLASS_MAPPINGS: dict[str, object] = {}
NODE_DISPLAY_NAME_MAPPINGS: dict[str, str] = {}


def _load_module_from_init(pack_dir: Path, unique_name: str) -> ModuleType | None:
    init_path = pack_dir / "__init__.py"
    if not init_path.exists():
        print(f"[ComfyUI-Avatary] Skipping {pack_dir.name}: missing __init__.py")
        return None

    spec = importlib.util.spec_from_file_location(
        unique_name,
        init_path,
        submodule_search_locations=[str(pack_dir)],
    )
    if spec is None or spec.loader is None:
        print(f"[ComfyUI-Avatary] Failed to build import spec for {pack_dir.name}")
        return None

    module = importlib.util.module_from_spec(spec)
    # Required for packages that use relative imports from their __init__.py
    # (e.g. `from .node_mappings import ...`).
    sys.modules[unique_name] = module
    added_path = str(pack_dir)
    if added_path not in sys.path:
        sys.path.insert(0, added_path)
    try:
        spec.loader.exec_module(module)
    except Exception as exc:
        print(f"[ComfyUI-Avatary] Failed to load {pack_dir.name}: {exc}")
        return None
    finally:
        if added_path in sys.path:
            sys.path.remove(added_path)
    return module


def _merge_from(module: ModuleType, pack_name: str) -> None:
    class_map = getattr(module, "NODE_CLASS_MAPPINGS", {}) or {}

    # Support both naming styles used by custom nodes.
    display_map = (
        getattr(module, "NODE_DISPLAY_NAME_MAPPINGS", None)
        or getattr(module, "NODE_DISPLAY_NAMES", None)
        or {}
    )

    for key, value in class_map.items():
        if key in NODE_CLASS_MAPPINGS:
            print(
                f"[ComfyUI-Avatary] Duplicate node key '{key}' from {pack_name}; keeping first occurrence."
            )
            continue
        NODE_CLASS_MAPPINGS[key] = value
        if key in display_map:
            NODE_DISPLAY_NAME_MAPPINGS[key] = display_map[key]


for idx, pack_name in enumerate(PACKS, start=1):
    pack_dir = PACKS_DIR / pack_name
    if not pack_dir.exists():
        print(f"[ComfyUI-Avatary] Missing pack: {pack_name}")
        continue

    module = _load_module_from_init(pack_dir, f"comfyui_avatary_pack_{idx}")
    if module is None:
        continue
    _merge_from(module, pack_name)

print(
    f"[ComfyUI-Avatary] Loaded {len(NODE_CLASS_MAPPINGS)} nodes from {len(PACKS)} packs."
)

# Expose web assets from embedded packs under ComfyUI-Avatary's web route.
WEB_DIRECTORY = "./packs"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
