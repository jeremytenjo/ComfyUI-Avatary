from __future__ import annotations

from typing import Any


CHECKPOINT_PREFIX = "checkpoints/"
DIFFUSION_MODEL_PREFIX = "diffusion_models/"
NO_MODEL = "None"


def _filename_list(folder_name: str) -> list[str]:
    try:
        import folder_paths

        return list(folder_paths.get_filename_list(folder_name))
    except Exception:
        return []


def _available_models() -> list[str]:
    checkpoints = [
        f"{CHECKPOINT_PREFIX}{name}" for name in _filename_list("checkpoints")
    ]
    diffusion_models = [
        f"{DIFFUSION_MODEL_PREFIX}{name}"
        for name in _filename_list("diffusion_models")
    ]
    return checkpoints + diffusion_models or [NO_MODEL]


class LoadCheckpointOrDiffusionModel:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, Any]:
        return {
            "required": {
                "model_name": (
                    _available_models(),
                    {
                        "tooltip": (
                            "Select a file from checkpoints or diffusion_models. "
                            "Diffusion model files do not contain CLIP or VAE data."
                        )
                    },
                ),
            },
        }

    RETURN_TYPES = ("MODEL", "CLIP", "VAE")
    RETURN_NAMES = ("model", "clip", "vae")
    OUTPUT_TOOLTIPS = (
        "The loaded checkpoint or diffusion model.",
        "The CLIP model. This is only available for checkpoint selections.",
        "The VAE model. This is only available for checkpoint selections.",
    )
    FUNCTION = "load_model"
    CATEGORY = "👑 Avatary/API"
    DESCRIPTION = (
        "Loads from checkpoints or diffusion_models with a single selector. "
        "Only checkpoints can provide CLIP and VAE outputs."
    )
    SEARCH_ALIASES = [
        "load checkpoint",
        "load diffusion model",
        "checkpoint",
        "diffusion model",
        "model loader",
    ]

    def load_model(
        self,
        model_name: str,
    ) -> tuple[object, object | None, object | None]:
        import comfy.sd
        import folder_paths

        if model_name.startswith(CHECKPOINT_PREFIX):
            ckpt_name = model_name.removeprefix(CHECKPOINT_PREFIX)
            ckpt_path = folder_paths.get_full_path_or_raise("checkpoints", ckpt_name)
            out = comfy.sd.load_checkpoint_guess_config(
                ckpt_path,
                output_vae=True,
                output_clip=True,
                embedding_directory=folder_paths.get_folder_paths("embeddings"),
            )
            return tuple(out[:3])

        if model_name.startswith(DIFFUSION_MODEL_PREFIX):
            diffusion_model_name = model_name.removeprefix(DIFFUSION_MODEL_PREFIX)
            diffusion_model_path = folder_paths.get_full_path_or_raise(
                "diffusion_models",
                diffusion_model_name,
            )
            model = comfy.sd.load_diffusion_model(diffusion_model_path)
            return (model, None, None)

        raise ValueError(
            "Select a model from checkpoints or diffusion_models before running this node."
        )


NODE_CLASS_MAPPINGS = {
    "AvataryLoadCheckpointOrDiffusionModel": LoadCheckpointOrDiffusionModel,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AvataryLoadCheckpointOrDiffusionModel": "Load Checkpoint or Diffusion Model Avatary",
}
