import importlib.util
import types
from pathlib import Path


def _load_root_module_for_test():
    mod_path = Path(__file__).resolve().parents[1] / "__init__.py"
    spec = importlib.util.spec_from_file_location(
        "avatary_test_root",
        mod_path,
        submodule_search_locations=[str(mod_path.parent)],
    )
    module = importlib.util.module_from_spec(spec)

    # Lightweight stubs so imports that expect ComfyUI runtime modules can load.
    fake_folder_paths = types.SimpleNamespace(
        get_output_directory=lambda: "/tmp",
    )
    fake_cli_args = types.SimpleNamespace(args=types.SimpleNamespace(disable_metadata=False))

    import sys

    sys.modules.setdefault("folder_paths", fake_folder_paths)
    sys.modules.setdefault("comfy", types.ModuleType("comfy"))
    sys.modules.setdefault("comfy.cli_args", fake_cli_args)

    fake_server = types.ModuleType("server")
    fake_server.PromptServer = types.SimpleNamespace(
        instance=types.SimpleNamespace(routes=types.SimpleNamespace(get=lambda *_a, **_k: (lambda f: f), post=lambda *_a, **_k: (lambda f: f)))
    )
    sys.modules.setdefault("server", fake_server)

    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_root_registry_contains_expected_nodes():
    module = _load_root_module_for_test()

    expected_keys = {
        "ComfyUI-Group-Bypasser",
        "AvataryFeatures",
        "NanoBananaProImage",
        "ComfyUI-Prompts",
        "SaveImageWithPromptToggle",
        "AvatarySwitch",
        "AvataryLoadImageBatch",
    }
    assert set(module.NODE_CLASS_MAPPINGS.keys()) == expected_keys
    assert module.WEB_DIRECTORY == "./web"
