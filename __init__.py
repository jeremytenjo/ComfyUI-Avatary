"""ComfyUI-Avatary explicit node registry.

Pixaroma-style startup wiring:
- explicit node module imports
- centralized mapping merge
- explicit side-effect extension imports
"""

from __future__ import annotations

# Side-effect import: registers Downloader backend routes/utilities.
def _try_load_downloader_extension() -> None:
    try:
        from .extensions import downloader_extension as _downloader_extension  # noqa: F401
    except Exception:
        try:
            import extensions.downloader_extension as _downloader_extension  # noqa: F401
        except Exception as exc:
            print(
                "[ComfyUI-Avatary] Downloader extension not loaded in this runtime: "
                f"{exc}"
            )


_try_load_downloader_extension()

try:
    from .nodes.node_group_bypasser import NODE_CLASS_MAPPINGS as _MAPS_GROUP_BYPASSER
    from .nodes.node_group_bypasser import (
        NODE_DISPLAY_NAME_MAPPINGS as _NAMES_GROUP_BYPASSER,
    )
    from .nodes.node_nano_banana import NODE_CLASS_MAPPINGS as _MAPS_NANO_BANANA
    from .nodes.node_nano_banana import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_NANO_BANANA
    from .nodes.node_prompt_list import NODE_CLASS_MAPPINGS as _MAPS_PROMPT_LIST
    from .nodes.node_prompt_list import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_PROMPT_LIST
    from .nodes.node_save_image_ultra import (
        NODE_CLASS_MAPPINGS as _MAPS_SAVE_IMAGE_ULTRA,
    )
    from .nodes.node_save_image_ultra import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_SAVE_IMAGE_ULTRA
    from .nodes.node_switch import NODE_CLASS_MAPPINGS as _MAPS_SWITCH
    from .nodes.node_switch import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_SWITCH
except ImportError:
    from nodes.node_group_bypasser import NODE_CLASS_MAPPINGS as _MAPS_GROUP_BYPASSER
    from nodes.node_group_bypasser import (
        NODE_DISPLAY_NAME_MAPPINGS as _NAMES_GROUP_BYPASSER,
    )
    from nodes.node_nano_banana import NODE_CLASS_MAPPINGS as _MAPS_NANO_BANANA
    from nodes.node_nano_banana import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_NANO_BANANA
    from nodes.node_prompt_list import NODE_CLASS_MAPPINGS as _MAPS_PROMPT_LIST
    from nodes.node_prompt_list import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_PROMPT_LIST
    from nodes.node_save_image_ultra import (
        NODE_CLASS_MAPPINGS as _MAPS_SAVE_IMAGE_ULTRA,
    )
    from nodes.node_save_image_ultra import (
        NODE_DISPLAY_NAME_MAPPINGS as _NAMES_SAVE_IMAGE_ULTRA,
    )
    from nodes.node_switch import NODE_CLASS_MAPPINGS as _MAPS_SWITCH
    from nodes.node_switch import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_SWITCH


def _merge_mapping_dicts(*mapping_dicts: dict[str, object]) -> dict[str, object]:
    merged: dict[str, object] = {}
    for mapping in mapping_dicts:
        for key, value in mapping.items():
            if key in merged:
                print(
                    f"[ComfyUI-Avatary] Duplicate node key '{key}' detected; keeping first occurrence."
                )
                continue
            merged[key] = value
    return merged


NODE_CLASS_MAPPINGS = _merge_mapping_dicts(
    _MAPS_GROUP_BYPASSER,
    _MAPS_NANO_BANANA,
    _MAPS_PROMPT_LIST,
    _MAPS_SAVE_IMAGE_ULTRA,
    _MAPS_SWITCH,
)

NODE_DISPLAY_NAME_MAPPINGS = _merge_mapping_dicts(
    _NAMES_GROUP_BYPASSER,
    _NAMES_NANO_BANANA,
    _NAMES_PROMPT_LIST,
    _NAMES_SAVE_IMAGE_ULTRA,
    _NAMES_SWITCH,
)

WEB_DIRECTORY = "./web"

print(f"[ComfyUI-Avatary] Loaded {len(NODE_CLASS_MAPPINGS)} nodes from explicit registry.")

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
