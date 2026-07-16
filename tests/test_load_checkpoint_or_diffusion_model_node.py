import importlib.util
import sys
import types
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "nodes"
    / "node_load_checkpoint_or_diffusion_model_backend.py"
)
SPEC = importlib.util.spec_from_file_location(
    "avatary_load_checkpoint_or_diffusion_model_node",
    MODULE_PATH,
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)

LoadCheckpointOrDiffusionModel = MODULE.LoadCheckpointOrDiffusionModel


def test_input_types_combines_checkpoints_and_diffusion_models(monkeypatch):
    fake_folder_paths = types.SimpleNamespace(
        get_filename_list=lambda kind: {
            "checkpoints": ["dream.safetensors"],
            "diffusion_models": ["flux.safetensors"],
        }[kind],
    )
    monkeypatch.setitem(sys.modules, "folder_paths", fake_folder_paths)

    inputs = LoadCheckpointOrDiffusionModel.INPUT_TYPES()

    assert inputs["required"]["model_name"][0] == [
        "checkpoints/dream.safetensors",
        "diffusion_models/flux.safetensors",
    ]


def test_loads_checkpoint_with_clip_and_vae(monkeypatch):
    fake_folder_paths = types.SimpleNamespace(
        get_full_path_or_raise=lambda kind, name: f"/models/{kind}/{name}",
        get_folder_paths=lambda kind: [f"/models/{kind}"],
    )

    def fake_load_checkpoint_guess_config(
        ckpt_path,
        output_vae=True,
        output_clip=True,
        embedding_directory=None,
    ):
        return (
            f"model:{ckpt_path}",
            f"clip:{output_clip}:{embedding_directory}",
            f"vae:{output_vae}",
            "ignored",
        )

    fake_sd = types.SimpleNamespace(
        load_checkpoint_guess_config=fake_load_checkpoint_guess_config,
    )
    fake_comfy = types.ModuleType("comfy")
    fake_comfy.sd = fake_sd

    monkeypatch.setitem(sys.modules, "folder_paths", fake_folder_paths)
    monkeypatch.setitem(sys.modules, "comfy", fake_comfy)
    monkeypatch.setitem(sys.modules, "comfy.sd", fake_sd)

    result = LoadCheckpointOrDiffusionModel().load_model(
        "checkpoints/dream.safetensors"
    )

    assert result == (
        "model:/models/checkpoints/dream.safetensors",
        "clip:True:['/models/embeddings']",
        "vae:True",
    )


def test_loads_diffusion_model_without_clip_or_vae(monkeypatch):
    fake_folder_paths = types.SimpleNamespace(
        get_full_path_or_raise=lambda kind, name: f"/models/{kind}/{name}",
    )
    fake_sd = types.SimpleNamespace(
        load_diffusion_model=lambda path: f"model:{path}",
    )
    fake_comfy = types.ModuleType("comfy")
    fake_comfy.sd = fake_sd

    monkeypatch.setitem(sys.modules, "folder_paths", fake_folder_paths)
    monkeypatch.setitem(sys.modules, "comfy", fake_comfy)
    monkeypatch.setitem(sys.modules, "comfy.sd", fake_sd)

    result = LoadCheckpointOrDiffusionModel().load_model(
        "diffusion_models/flux.safetensors"
    )

    assert result == (
        "model:/models/diffusion_models/flux.safetensors",
        None,
        None,
    )
