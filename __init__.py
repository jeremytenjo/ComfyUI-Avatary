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


def _try_load_controllight_extension() -> None:
    try:
        from .extensions import control_light_backend_extension as _control_light_extension  # noqa: F401
    except Exception:
        try:
            import extensions.control_light_backend_extension as _control_light_extension  # noqa: F401
        except Exception as exc:
            print(
                "[ComfyUI-Avatary] ControlLight extension not loaded in this runtime: "
                f"{exc}"
            )


_try_load_controllight_extension()

try:
    from .nodes.node_group_bypasser import NODE_CLASS_MAPPINGS as _MAPS_GROUP_BYPASSER
    from .nodes.node_group_bypasser import (
        NODE_DISPLAY_NAME_MAPPINGS as _NAMES_GROUP_BYPASSER,
    )
    from .nodes.node_features_avatary import NODE_CLASS_MAPPINGS as _MAPS_FEATURES_AVATARY
    from .nodes.node_features_avatary import (
        NODE_DISPLAY_NAME_MAPPINGS as _NAMES_FEATURES_AVATARY,
    )
    from .nodes.node_nano_banana import NODE_CLASS_MAPPINGS as _MAPS_NANO_BANANA
    from .nodes.node_nano_banana import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_NANO_BANANA
    from .nodes.node_prompt_list import NODE_CLASS_MAPPINGS as _MAPS_PROMPT_LIST
    from .nodes.node_prompt_list import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_PROMPT_LIST
    from .nodes.node_save_image_avatary_backend import (
        NODE_CLASS_MAPPINGS as _MAPS_SAVE_IMAGE_ULTRA,
    )
    from .nodes.node_save_image_avatary_backend import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_SAVE_IMAGE_ULTRA
    from .nodes.node_switch import NODE_CLASS_MAPPINGS as _MAPS_SWITCH
    from .nodes.node_switch import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_SWITCH
    from .nodes.node_load_images_avatary import NODE_CLASS_MAPPINGS as _MAPS_LOAD_IMAGE_BATCH
    from .nodes.node_load_images_avatary import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_LOAD_IMAGE_BATCH
    from .nodes.node_lora_stack_backend import NODE_CLASS_MAPPINGS as _MAPS_LORA_STACK
    from .nodes.node_lora_stack_backend import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_LORA_STACK
    from .nodes.node_control_light_backend import NODE_CLASS_MAPPINGS as _MAPS_CONTROL_LIGHT
    from .nodes.node_control_light_backend import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_CONTROL_LIGHT
    from .nodes.node_aspect_ratio_backend import NODE_CLASS_MAPPINGS as _MAPS_ASPECT_RATIO
    from .nodes.node_aspect_ratio_backend import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_ASPECT_RATIO
    from .nodes.node_carousel_split_backend import NODE_CLASS_MAPPINGS as _MAPS_CAROUSEL_SPLIT
    from .nodes.node_carousel_split_backend import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_CAROUSEL_SPLIT
    from .nodes.node_load_checkpoint_or_diffusion_model_backend import (
        NODE_CLASS_MAPPINGS as _MAPS_LOAD_CHECKPOINT_OR_DIFFUSION_MODEL,
    )
    from .nodes.node_load_checkpoint_or_diffusion_model_backend import (
        NODE_DISPLAY_NAME_MAPPINGS as _NAMES_LOAD_CHECKPOINT_OR_DIFFUSION_MODEL,
    )
except ImportError:
    from nodes.node_group_bypasser import NODE_CLASS_MAPPINGS as _MAPS_GROUP_BYPASSER
    from nodes.node_group_bypasser import (
        NODE_DISPLAY_NAME_MAPPINGS as _NAMES_GROUP_BYPASSER,
    )
    from nodes.node_features_avatary import NODE_CLASS_MAPPINGS as _MAPS_FEATURES_AVATARY
    from nodes.node_features_avatary import (
        NODE_DISPLAY_NAME_MAPPINGS as _NAMES_FEATURES_AVATARY,
    )
    from nodes.node_nano_banana import NODE_CLASS_MAPPINGS as _MAPS_NANO_BANANA
    from nodes.node_nano_banana import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_NANO_BANANA
    from nodes.node_prompt_list import NODE_CLASS_MAPPINGS as _MAPS_PROMPT_LIST
    from nodes.node_prompt_list import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_PROMPT_LIST
    from nodes.node_save_image_avatary_backend import (
        NODE_CLASS_MAPPINGS as _MAPS_SAVE_IMAGE_ULTRA,
    )
    from nodes.node_save_image_avatary_backend import (
        NODE_DISPLAY_NAME_MAPPINGS as _NAMES_SAVE_IMAGE_ULTRA,
    )
    from nodes.node_switch import NODE_CLASS_MAPPINGS as _MAPS_SWITCH
    from nodes.node_switch import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_SWITCH
    from nodes.node_load_images_avatary import NODE_CLASS_MAPPINGS as _MAPS_LOAD_IMAGE_BATCH
    from nodes.node_load_images_avatary import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_LOAD_IMAGE_BATCH
    from nodes.node_lora_stack_backend import NODE_CLASS_MAPPINGS as _MAPS_LORA_STACK
    from nodes.node_lora_stack_backend import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_LORA_STACK
    from nodes.node_control_light_backend import NODE_CLASS_MAPPINGS as _MAPS_CONTROL_LIGHT
    from nodes.node_control_light_backend import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_CONTROL_LIGHT
    from nodes.node_aspect_ratio_backend import NODE_CLASS_MAPPINGS as _MAPS_ASPECT_RATIO
    from nodes.node_aspect_ratio_backend import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_ASPECT_RATIO
    from nodes.node_carousel_split_backend import NODE_CLASS_MAPPINGS as _MAPS_CAROUSEL_SPLIT
    from nodes.node_carousel_split_backend import NODE_DISPLAY_NAME_MAPPINGS as _NAMES_CAROUSEL_SPLIT
    from nodes.node_load_checkpoint_or_diffusion_model_backend import (
        NODE_CLASS_MAPPINGS as _MAPS_LOAD_CHECKPOINT_OR_DIFFUSION_MODEL,
    )
    from nodes.node_load_checkpoint_or_diffusion_model_backend import (
        NODE_DISPLAY_NAME_MAPPINGS as _NAMES_LOAD_CHECKPOINT_OR_DIFFUSION_MODEL,
    )


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
    _MAPS_FEATURES_AVATARY,
    _MAPS_NANO_BANANA,
    _MAPS_PROMPT_LIST,
    _MAPS_SAVE_IMAGE_ULTRA,
    _MAPS_SWITCH,
    _MAPS_LOAD_IMAGE_BATCH,
    _MAPS_LORA_STACK,
    _MAPS_CONTROL_LIGHT,
    _MAPS_ASPECT_RATIO,
    _MAPS_CAROUSEL_SPLIT,
    _MAPS_LOAD_CHECKPOINT_OR_DIFFUSION_MODEL,
)

NODE_DISPLAY_NAME_MAPPINGS = _merge_mapping_dicts(
    _NAMES_GROUP_BYPASSER,
    _NAMES_FEATURES_AVATARY,
    _NAMES_NANO_BANANA,
    _NAMES_PROMPT_LIST,
    _NAMES_SAVE_IMAGE_ULTRA,
    _NAMES_SWITCH,
    _NAMES_LOAD_IMAGE_BATCH,
    _NAMES_LORA_STACK,
    _NAMES_CONTROL_LIGHT,
    _NAMES_ASPECT_RATIO,
    _NAMES_CAROUSEL_SPLIT,
    _NAMES_LOAD_CHECKPOINT_OR_DIFFUSION_MODEL,
)

WEB_DIRECTORY = "./web"

print(f"[ComfyUI-Avatary] Loaded {len(NODE_CLASS_MAPPINGS)} nodes from explicit registry.")

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
