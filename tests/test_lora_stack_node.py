import importlib.util
import sys
import types
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes" / "node_lora_stack_backend.py"
SPEC = importlib.util.spec_from_file_location("avatary_lora_stack_node", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)

AvataryLoraStack = MODULE.AvataryLoraStack


def test_lora_stack_parses_enabled_rows_in_order():
    node = AvataryLoraStack()

    rows = node._parse_rows(
        (
            "["
            '{"name":"b.safetensors","strength":0.5},'
            '{"name":"a.safetensors","strength":0.8},'
            '{"name":"disabled.safetensors","enabled":false}'
            "]"
        )
    )

    assert rows == [
        ("b.safetensors", 0.5),
        ("a.safetensors", 0.8),
    ]


def test_lora_stack_returns_original_model_when_empty():
    node = AvataryLoraStack()
    model = object()

    (result,) = node.apply_loras(
        model=model,
        LoraStackState="[]",
        LoraCatalog="None",
    )

    assert result is model


def test_lora_stack_applies_loras_to_model_in_order(monkeypatch):
    calls = []
    node = AvataryLoraStack()

    fake_folder_paths = types.SimpleNamespace(
        get_full_path_or_raise=lambda kind, name: f"/models/{kind}/{name}"
    )
    fake_utils = types.SimpleNamespace(
        load_torch_file=lambda path, safe_load=True: {"path": path, "safe": safe_load}
    )

    def fake_load_lora_for_models(model, clip, lora, strength_model, strength_clip):
        calls.append((model, clip, lora, strength_model, strength_clip))
        return (f"{model}+{lora['path']}@{strength_model}", clip)

    fake_sd = types.SimpleNamespace(load_lora_for_models=fake_load_lora_for_models)
    fake_comfy = types.ModuleType("comfy")
    fake_comfy.utils = fake_utils
    fake_comfy.sd = fake_sd

    monkeypatch.setitem(sys.modules, "folder_paths", fake_folder_paths)
    monkeypatch.setitem(sys.modules, "comfy", fake_comfy)
    monkeypatch.setitem(sys.modules, "comfy.utils", fake_utils)
    monkeypatch.setitem(sys.modules, "comfy.sd", fake_sd)

    (result,) = node.apply_loras(
        model="base",
        LoraStackState=(
            "["
            '{"name":"first.safetensors","strength":0.75},'
            '{"name":"second.safetensors","strength":1.25}'
            "]"
        ),
        LoraCatalog="None",
    )

    assert result == "base+/models/loras/first.safetensors@0.75+/models/loras/second.safetensors@1.25"
    assert calls == [
        (
            "base",
            None,
            {"path": "/models/loras/first.safetensors", "safe": True},
            0.75,
            0.0,
        ),
        (
            "base+/models/loras/first.safetensors@0.75",
            None,
            {"path": "/models/loras/second.safetensors", "safe": True},
            1.25,
            0.0,
        ),
    ]
