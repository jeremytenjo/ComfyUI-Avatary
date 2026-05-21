import importlib
import json
from pathlib import Path
import sys
import types
import asyncio
import time

from aiohttp import web
import pytest

# Load the extension with a lightweight fake PromptServer so tests don't depend
# on the full ComfyUI server initialization chain.
fake_server = types.ModuleType("server")
fake_server.PromptServer = types.SimpleNamespace(
    instance=types.SimpleNamespace(routes=web.RouteTableDef())
)
sys.modules["server"] = fake_server

dtd = importlib.import_module("custom_nodes.download_to_directory_extension")


def test_normalize_download_url_github_blob():
    url = "https://github.com/org/repo/blob/main/path/file.yaml"
    normalized = dtd._normalize_download_url(url)
    assert normalized == "https://raw.githubusercontent.com/org/repo/main/path/file.yaml"


def test_normalize_download_url_huggingface_blob():
    url = "https://huggingface.co/org/repo/blob/main/path/model.safetensors"
    normalized = dtd._normalize_download_url(url)
    assert (
        normalized
        == "https://huggingface.co/org/repo/resolve/main/path/model.safetensors?download=true"
    )


def test_safe_path_from_root_blocks_escape(tmp_path: Path):
    with pytest.raises(web.HTTPBadRequest):
        dtd._safe_path_from_root(str(tmp_path), "../outside.txt")


def test_prepare_download_request_allows_comfy_root_subfolders_and_localhost(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    comfy_root = tmp_path
    models_dir = comfy_root / "models"
    custom_nodes_dir = comfy_root / "custom_nodes"
    models_dir.mkdir(parents=True, exist_ok=True)
    custom_nodes_dir.mkdir(parents=True, exist_ok=True)

    roots = {
        "input": str(comfy_root / "input"),
        "output": str(comfy_root / "output"),
        "user": str(comfy_root / "user"),
        "comfy_root": str(comfy_root),
        "models": str(models_dir),
        "custom_nodes": str(custom_nodes_dir),
    }
    for path in roots.values():
        Path(path).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(dtd, "_build_root_map", lambda: roots)

    prepared = dtd._prepare_download_request(
        {
            "url": "http://127.0.0.1:8188/model.safetensors",
            "folder": "app/config",
            "overwrite": True,
            "huggingface_token": "hf_test_token",
        }
    )
    assert prepared["root_key"] == "comfy_root"
    assert prepared["destination_path"].startswith(str(comfy_root / "app" / "config"))
    assert prepared["huggingface_token"] == "hf_test_token"
    assert prepared["mode"] == "download"


def test_prepare_download_request_uses_git_clone_for_custom_nodes_git_urls(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    comfy_root = tmp_path / "comfy"
    custom_nodes_dir = comfy_root / "custom_nodes"
    custom_nodes_dir.mkdir(parents=True, exist_ok=True)

    roots = {
        "input": str(comfy_root / "input"),
        "output": str(comfy_root / "output"),
        "user": str(comfy_root / "user"),
        "comfy_root": str(comfy_root),
        "custom_nodes": str(custom_nodes_dir),
    }
    for path in roots.values():
        Path(path).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(dtd, "_build_root_map", lambda: roots)
    monkeypatch.setattr(
        dtd.folder_paths,
        "get_folder_paths",
        lambda key: [str(custom_nodes_dir)] if key == "custom_nodes" else [],
    )

    prepared = dtd._prepare_download_request(
        {
            "url": "https://github.com/org/example-node.git",
            "root_key": "custom_nodes",
            "overwrite": False,
        }
    )
    assert prepared["mode"] == "git_clone"
    assert prepared["destination_path"] == str(custom_nodes_dir / "example-node")


def test_prepare_download_request_uses_git_clone_for_custom_nodes_github_tree_url(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    comfy_root = tmp_path / "comfy"
    custom_nodes_dir = comfy_root / "custom_nodes"
    custom_nodes_dir.mkdir(parents=True, exist_ok=True)

    roots = {
        "input": str(comfy_root / "input"),
        "output": str(comfy_root / "output"),
        "user": str(comfy_root / "user"),
        "comfy_root": str(comfy_root),
        "custom_nodes": str(custom_nodes_dir),
    }
    for path in roots.values():
        Path(path).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(dtd, "_build_root_map", lambda: roots)
    monkeypatch.setattr(
        dtd.folder_paths,
        "get_folder_paths",
        lambda key: [str(custom_nodes_dir)] if key == "custom_nodes" else [],
    )

    prepared = dtd._prepare_download_request(
        {
            "url": "https://github.com/org/example-node/tree/main",
            "root_key": "custom_nodes",
            "overwrite": False,
        }
    )
    assert prepared["mode"] == "git_clone"
    assert prepared["download_url"] == "https://github.com/org/example-node.git"
    assert prepared["clone_branch"] == "main"
    assert prepared["destination_path"] == str(custom_nodes_dir / "example-node")


def test_prepare_download_request_uses_git_clone_for_custom_nodes_hf_space_tree_url(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    comfy_root = tmp_path / "comfy"
    custom_nodes_dir = comfy_root / "custom_nodes"
    custom_nodes_dir.mkdir(parents=True, exist_ok=True)

    roots = {
        "input": str(comfy_root / "input"),
        "output": str(comfy_root / "output"),
        "user": str(comfy_root / "user"),
        "comfy_root": str(comfy_root),
        "custom_nodes": str(custom_nodes_dir),
    }
    for path in roots.values():
        Path(path).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(dtd, "_build_root_map", lambda: roots)
    monkeypatch.setattr(
        dtd.folder_paths,
        "get_folder_paths",
        lambda key: [str(custom_nodes_dir)] if key == "custom_nodes" else [],
    )

    prepared = dtd._prepare_download_request(
        {
            "url": "https://huggingface.co/spaces/Huslyo123/comfyui-Huslyo123RealismNode-V2/tree/main",
            "root_key": "custom_nodes",
            "overwrite": False,
        }
    )
    assert prepared["mode"] == "git_clone"
    assert (
        prepared["download_url"]
        == "https://huggingface.co/spaces/Huslyo123/comfyui-Huslyo123RealismNode-V2"
    )
    assert prepared["clone_branch"] == "main"
    assert prepared["destination_path"] == str(
        custom_nodes_dir / "comfyui-Huslyo123RealismNode-V2"
    )


def test_prepare_download_request_git_url_non_custom_nodes_stays_download(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    comfy_root = tmp_path / "comfy"
    models_dir = comfy_root / "models"
    custom_nodes_dir = comfy_root / "custom_nodes"
    models_dir.mkdir(parents=True, exist_ok=True)
    custom_nodes_dir.mkdir(parents=True, exist_ok=True)

    roots = {
        "input": str(comfy_root / "input"),
        "output": str(comfy_root / "output"),
        "user": str(comfy_root / "user"),
        "comfy_root": str(comfy_root),
        "models": str(models_dir),
        "custom_nodes": str(custom_nodes_dir),
    }
    for path in roots.values():
        Path(path).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(dtd, "_build_root_map", lambda: roots)
    monkeypatch.setattr(
        dtd.folder_paths,
        "get_folder_paths",
        lambda key: [str(custom_nodes_dir)] if key == "custom_nodes" else [],
    )

    prepared = dtd._prepare_download_request(
        {
            "url": "https://github.com/org/example-node.git",
            "root_key": "models",
            "overwrite": True,
        }
    )
    assert prepared["mode"] == "download"
    assert prepared["destination_path"].endswith("example-node.git")


class _FakeRequest:
    def __init__(self, body: dict):
        self._body = body

    async def json(self) -> dict:
        return self._body


def test_delete_downloaded_file_deletes_and_is_idempotent(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    comfy_root = tmp_path / "comfy"
    user_dir = comfy_root / "user"
    user_dir.mkdir(parents=True, exist_ok=True)
    target_file = user_dir / "model.safetensors"
    target_file.write_text("content", encoding="utf-8")

    roots = {
        "input": str(comfy_root / "input"),
        "output": str(comfy_root / "output"),
        "user": str(user_dir),
        "comfy_root": str(comfy_root),
    }
    for path in roots.values():
        Path(path).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(dtd, "_build_root_map", lambda: roots)

    response = asyncio.run(
        dtd.delete_downloaded_file(_FakeRequest({"path": str(target_file)}))
    )
    payload = json.loads(response.text)
    assert payload["ok"] is True
    assert payload["deleted"] is True
    assert target_file.exists() is False

    response_again = asyncio.run(
        dtd.delete_downloaded_file(_FakeRequest({"path": str(target_file)}))
    )
    payload_again = json.loads(response_again.text)
    assert payload_again["ok"] is True
    assert payload_again["deleted"] is False


def test_delete_downloaded_file_rejects_path_outside_roots(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    comfy_root = tmp_path / "comfy"
    user_dir = comfy_root / "user"
    user_dir.mkdir(parents=True, exist_ok=True)

    roots = {
        "input": str(comfy_root / "input"),
        "output": str(comfy_root / "output"),
        "user": str(user_dir),
        "comfy_root": str(comfy_root),
    }
    for path in roots.values():
        Path(path).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(dtd, "_build_root_map", lambda: roots)

    with pytest.raises(web.HTTPBadRequest):
        asyncio.run(
            dtd.delete_downloaded_file(
                _FakeRequest({"path": str(tmp_path / "outside.bin")})
            )
        )


def test_delete_downloaded_file_allows_custom_nodes_directory(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    comfy_root = tmp_path / "comfy"
    custom_nodes_dir = comfy_root / "custom_nodes"
    custom_nodes_dir.mkdir(parents=True, exist_ok=True)
    target_dir = custom_nodes_dir / "example-node"
    target_dir.mkdir(parents=True, exist_ok=True)
    (target_dir / "README.md").write_text("ok", encoding="utf-8")

    roots = {
        "input": str(comfy_root / "input"),
        "output": str(comfy_root / "output"),
        "user": str(comfy_root / "user"),
        "comfy_root": str(comfy_root),
        "custom_nodes": str(custom_nodes_dir),
    }
    for path in roots.values():
        Path(path).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(dtd, "_build_root_map", lambda: roots)
    monkeypatch.setattr(dtd, "_custom_nodes_roots", lambda: [str(custom_nodes_dir)])

    response = asyncio.run(
        dtd.delete_downloaded_file(_FakeRequest({"path": str(target_dir)}))
    )
    payload = json.loads(response.text)
    assert payload["ok"] is True
    assert payload["deleted"] is True
    assert target_dir.exists() is False


def test_delete_downloaded_file_rejects_non_custom_nodes_directory(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    comfy_root = tmp_path / "comfy"
    user_dir = comfy_root / "user"
    user_dir.mkdir(parents=True, exist_ok=True)
    target_dir = user_dir / "models"
    target_dir.mkdir(parents=True, exist_ok=True)

    roots = {
        "input": str(comfy_root / "input"),
        "output": str(comfy_root / "output"),
        "user": str(user_dir),
        "comfy_root": str(comfy_root),
    }
    for path in roots.values():
        Path(path).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(dtd, "_build_root_map", lambda: roots)
    monkeypatch.setattr(dtd, "_custom_nodes_roots", lambda: [str(comfy_root / "custom_nodes")])

    with pytest.raises(web.HTTPBadRequest):
        asyncio.run(
            dtd.delete_downloaded_file(_FakeRequest({"path": str(target_dir)}))
        )


def test_prepare_upload_request_uses_uploaded_filename(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    comfy_root = tmp_path / "comfy"
    models_dir = comfy_root / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    roots = {
        "input": str(comfy_root / "input"),
        "output": str(comfy_root / "output"),
        "user": str(comfy_root / "user"),
        "comfy_root": str(comfy_root),
        "models": str(models_dir),
    }
    for path in roots.values():
        Path(path).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(dtd, "_build_root_map", lambda: roots)

    prepared = dtd._prepare_upload_request(
        {
            "root_key": "models",
            "subdirectory": "loras",
            "overwrite": "false",
        },
        uploaded_filename="my-model.safetensors",
    )
    assert prepared["root_key"] == "models"
    assert prepared["destination_path"].endswith(
        str(Path("models") / "loras" / "my-model.safetensors")
    )


def test_prepare_upload_request_blocks_overwrite_by_default(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    comfy_root = tmp_path / "comfy"
    models_dir = comfy_root / "models"
    target_dir = models_dir / "loras"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / "my-model.safetensors"
    target_file.write_text("existing", encoding="utf-8")

    roots = {
        "input": str(comfy_root / "input"),
        "output": str(comfy_root / "output"),
        "user": str(comfy_root / "user"),
        "comfy_root": str(comfy_root),
        "models": str(models_dir),
    }
    for path in roots.values():
        Path(path).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(dtd, "_build_root_map", lambda: roots)

    with pytest.raises(web.HTTPConflict):
        dtd._prepare_upload_request(
            {
                "root_key": "models",
                "subdirectory": "loras",
            },
            uploaded_filename="my-model.safetensors",
        )


def test_download_file_prefers_remote_content_disposition_filename(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    class _FakeResponse:
        def __init__(self):
            self.status = 200
            self.headers = {
                "Content-Length": "4",
                "Content-Disposition": 'attachment; filename="breasts-adjustxl.safetensors"',
            }
            self._chunks = [b"test", b""]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self, _n: int):
            return self._chunks.pop(0)

    monkeypatch.setattr(
        dtd,
        "_open_url_with_ssl_fallback",
        lambda req, timeout=45: _FakeResponse(),
    )

    base_destination = tmp_path / "139625"
    bytes_written, total_bytes, resolved_destination = dtd._download_file(
        "https://civitai.com/api/download/models/139625",
        str(base_destination),
        prefer_remote_filename=True,
        overwrite=False,
    )

    assert bytes_written == 4
    assert total_bytes == 4
    assert resolved_destination.endswith("breasts-adjustxl.safetensors")
    assert (tmp_path / "breasts-adjustxl.safetensors").read_bytes() == b"test"
    assert not base_destination.exists()


def test_install_clone_requirements_if_present_skips_when_missing(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls = []

    def _fake_run(*_args, **_kwargs):
        calls.append(1)
        return types.SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(dtd.os.path, "isfile", lambda _path: False)
    monkeypatch.setattr(dtd.subprocess, "run", _fake_run)

    dtd._install_clone_requirements_if_present(str(tmp_path))
    assert calls == []


def test_install_clone_requirements_if_present_runs_pip(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured = {}

    def _fake_run(cmd, **_kwargs):
        captured["cmd"] = cmd
        return types.SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(dtd.os.path, "isfile", lambda _path: True)
    monkeypatch.setattr(dtd.subprocess, "run", _fake_run)

    dtd._install_clone_requirements_if_present(str(tmp_path))
    assert captured["cmd"][0] == dtd.sys.executable
    assert captured["cmd"][1:4] == ["-m", "pip", "install"]
    assert captured["cmd"][4] == "-r"


def test_install_clone_requirements_if_present_raises_on_pip_failure(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    def _fake_run(*_args, **_kwargs):
        return types.SimpleNamespace(
            returncode=1,
            stdout="",
            stderr="no matching distribution found",
        )

    monkeypatch.setattr(dtd.os.path, "isfile", lambda _path: True)
    monkeypatch.setattr(dtd.subprocess, "run", _fake_run)

    with pytest.raises(web.HTTPBadRequest):
        dtd._install_clone_requirements_if_present(str(tmp_path))


def test_install_clone_requirements_if_present_sanitizes_multiline_error(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    def _fake_run(*_args, **_kwargs):
        return types.SimpleNamespace(
            returncode=1,
            stdout="",
            stderr="line one\nline two\r\nline three",
        )

    monkeypatch.setattr(dtd.os.path, "isfile", lambda _path: True)
    monkeypatch.setattr(dtd.subprocess, "run", _fake_run)

    with pytest.raises(web.HTTPBadRequest) as exc:
        dtd._install_clone_requirements_if_present(str(tmp_path))

    reason = str(exc.value.reason or "")
    assert "\n" not in reason
    assert "\r" not in reason
    assert "line one line two line three" in reason


def test_install_clone_requirements_if_present_retries_with_python3_when_pip_missing(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls = []

    def _fake_run(cmd, **_kwargs):
        calls.append(cmd[0])
        if cmd[0] == dtd.sys.executable:
            return types.SimpleNamespace(
                returncode=1,
                stdout="",
                stderr="No module named pip",
            )
        return types.SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(dtd.os.path, "isfile", lambda _path: True)
    monkeypatch.setattr(dtd.subprocess, "run", _fake_run)

    dtd._install_clone_requirements_if_present(str(tmp_path))
    assert calls == [dtd.sys.executable, "python3"]


def test_build_restart_command_module_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        dtd.sys,
        "argv",
        ["/tmp/ComfyUI/__main__.py", "--listen", "0.0.0.0"],
    )
    monkeypatch.setattr(dtd.sys, "executable", "/usr/bin/python3")

    cmd = dtd._build_restart_command()
    assert cmd == ["/usr/bin/python3", "-m", "ComfyUI", "--listen", "0.0.0.0"]


def test_build_restart_command_script_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        dtd.sys,
        "argv",
        ["main.py", "--port", "8188", "--windows-standalone-build"],
    )
    monkeypatch.setattr(dtd.sys, "executable", "/usr/bin/python3")

    cmd = dtd._build_restart_command()
    assert cmd == ["/usr/bin/python3", "main.py", "--port", "8188"]


def test_pkill_comfyui_processes_runs_expected_command(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = {}

    def _fake_run(cmd, **kwargs):
        captured["cmd"] = cmd
        captured["kwargs"] = kwargs
        return types.SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(dtd.subprocess, "run", _fake_run)

    dtd._pkill_comfyui_processes()

    assert captured["cmd"] == ["pkill", "-f", "ComfyUI"]
    assert captured["kwargs"]["check"] is False
    assert captured["kwargs"]["capture_output"] is True
    assert captured["kwargs"]["text"] is True


def test_analyze_missing_nodes_endpoint_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    expected = {
        "missing": [
            {
                "key": "https://github.com/acme/example-node.git",
                "display_name": "example-node",
                "source_url": "https://github.com/acme/example-node.git",
                "state": "not-installed",
                "install_target": "https://github.com/acme/example-node.git",
            }
        ],
        "unknown_nodes": ["CustomFooNode"],
    }
    monkeypatch.setattr(dtd, "_analyze_workflow_missing_nodes", lambda _wf: expected)

    response = asyncio.run(
        dtd.analyze_missing_nodes(_FakeRequest({"workflow": {"nodes": []}}))
    )
    payload = json.loads(response.text)
    assert payload["ok"] is True
    assert payload["missing"] == expected["missing"]
    assert payload["unknown_nodes"] == expected["unknown_nodes"]


def test_analyze_missing_nodes_endpoint_rejects_invalid_payload() -> None:
    with pytest.raises(web.HTTPBadRequest):
        asyncio.run(dtd.analyze_missing_nodes(_FakeRequest({"workflow": None})))


def test_analyze_workflow_missing_nodes_surfaces_cli_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        dtd,
        "_run_comfy_cli_command",
        lambda _args: types.SimpleNamespace(
            returncode=1,
            stdout="",
            stderr="simulated deps-in-workflow failure",
        ),
    )

    with pytest.raises(web.HTTPInternalServerError) as exc:
        dtd._analyze_workflow_missing_nodes({"nodes": []})
    assert "Missing-node analysis failed" in str(exc.value.reason)


def test_should_ignore_unknown_node_name_filters_uuid_like_values() -> None:
    assert dtd._should_ignore_unknown_node_name("916d8620-fefb-49c9-994b-8f0039c650a6")
    assert dtd._should_ignore_unknown_node_name("916d8620fefb49c9994b8f0039c650a6")
    assert not dtd._should_ignore_unknown_node_name("FaceDetailerPipe")


def test_analyze_workflow_missing_nodes_filters_uuid_unknown_nodes(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    def _fake_run(args: list[str]):
        output_index = args.index("--output") + 1
        output_path = Path(args[output_index])
        output_path.write_text(
            json.dumps(
                {
                    "custom_nodes": {},
                    "unknown_nodes": [
                        "916d8620-fefb-49c9-994b-8f0039c650a6",
                        "FaceDetailerPipe",
                    ],
                }
            ),
            encoding="utf-8",
        )
        return types.SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(dtd, "_run_comfy_cli_command", _fake_run)

    analyzed = dtd._analyze_workflow_missing_nodes({"nodes": []})
    assert analyzed["unknown_nodes"] == ["FaceDetailerPipe"]


def test_install_missing_nodes_endpoint_rejects_empty_targets() -> None:
    with pytest.raises(web.HTTPBadRequest):
        asyncio.run(dtd.install_missing_nodes(_FakeRequest({"targets": []})))


def test_install_missing_nodes_endpoint_starts_job(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with dtd.MISSING_INSTALL_JOBS_LOCK:
        dtd.MISSING_INSTALL_JOBS.clear()

    class _NoopThread:
        def __init__(self, target=None, args=(), daemon=None):
            self.target = target
            self.args = args
            self.daemon = daemon

        def start(self):
            return None

    monkeypatch.setattr(dtd.threading, "Thread", _NoopThread)

    response = asyncio.run(
        dtd.install_missing_nodes(
            _FakeRequest(
                {
                    "targets": [
                        "https://github.com/acme/example-node.git",
                        "https://github.com/acme/example-node.git",
                    ]
                }
            )
        )
    )
    payload = json.loads(response.text)
    assert response.status == 200
    assert payload["ok"] is True
    assert payload["status"] == "queued"
    assert payload["total_targets"] == 1
    assert payload["job_id"]
    with dtd.MISSING_INSTALL_JOBS_LOCK:
        assert payload["job_id"] in dtd.MISSING_INSTALL_JOBS


def test_get_missing_nodes_install_progress_not_found() -> None:
    fake_request = types.SimpleNamespace(match_info={"job_id": "does-not-exist"})
    with pytest.raises(web.HTTPNotFound):
        asyncio.run(dtd.get_missing_nodes_install_progress(fake_request))


def test_get_missing_nodes_install_progress_success() -> None:
    job_id = "progress_job_test"
    with dtd.MISSING_INSTALL_JOBS_LOCK:
        dtd.MISSING_INSTALL_JOBS[job_id] = {
            "job_id": job_id,
            "status": "running",
            "targets": ["node-a"],
            "total_targets": 1,
            "completed_targets": 0,
            "failed_targets": 0,
            "current_target": "node-a",
            "progress_percent": 0.0,
            "results": [],
            "updated_at": 1.0,
            "started_at": 1.0,
        }

    fake_request = types.SimpleNamespace(match_info={"job_id": job_id})
    response = asyncio.run(dtd.get_missing_nodes_install_progress(fake_request))
    payload = json.loads(response.text)
    assert response.status == 200
    assert payload["status"] == "running"
    assert payload["current_target"] == "node-a"


def test_run_missing_nodes_install_job_completed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    job_id = "install_completed_job"
    targets = ["node-a", "node-b"]
    with dtd.MISSING_INSTALL_JOBS_LOCK:
        dtd.MISSING_INSTALL_JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "targets": list(targets),
            "total_targets": len(targets),
            "completed_targets": 0,
            "failed_targets": 0,
            "current_target": "",
            "progress_percent": 0.0,
            "results": [],
            "updated_at": time.time(),
            "started_at": time.time(),
        }

    monkeypatch.setattr(
        dtd,
        "_run_comfy_cli_command",
        lambda _args: types.SimpleNamespace(returncode=0, stdout="ok", stderr=""),
    )

    dtd._run_missing_nodes_install_job(job_id, targets)
    with dtd.MISSING_INSTALL_JOBS_LOCK:
        job = dict(dtd.MISSING_INSTALL_JOBS[job_id])
    assert job["status"] == "completed"
    assert job["completed_targets"] == 2
    assert job["failed_targets"] == 0
    assert job["progress_percent"] == 100.0
    assert len(job["results"]) == 2
    assert all(entry["ok"] for entry in job["results"])


def test_run_missing_nodes_install_job_partial(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    job_id = "install_partial_job"
    targets = ["node-a", "node-b"]
    with dtd.MISSING_INSTALL_JOBS_LOCK:
        dtd.MISSING_INSTALL_JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "targets": list(targets),
            "total_targets": len(targets),
            "completed_targets": 0,
            "failed_targets": 0,
            "current_target": "",
            "progress_percent": 0.0,
            "results": [],
            "updated_at": time.time(),
            "started_at": time.time(),
        }

    def _fake_run(args):
        target = args[-1]
        if target == "node-a":
            return types.SimpleNamespace(returncode=0, stdout="ok", stderr="")
        return types.SimpleNamespace(returncode=1, stdout="", stderr="boom")

    monkeypatch.setattr(dtd, "_run_comfy_cli_command", _fake_run)

    dtd._run_missing_nodes_install_job(job_id, targets)
    with dtd.MISSING_INSTALL_JOBS_LOCK:
        job = dict(dtd.MISSING_INSTALL_JOBS[job_id])
    assert job["status"] == "partial"
    assert job["completed_targets"] == 1
    assert job["failed_targets"] == 1
    assert job["progress_percent"] == 100.0


def test_run_missing_nodes_install_job_failed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    job_id = "install_failed_job"
    targets = ["node-a"]
    with dtd.MISSING_INSTALL_JOBS_LOCK:
        dtd.MISSING_INSTALL_JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "targets": list(targets),
            "total_targets": len(targets),
            "completed_targets": 0,
            "failed_targets": 0,
            "current_target": "",
            "progress_percent": 0.0,
            "results": [],
            "updated_at": time.time(),
            "started_at": time.time(),
        }

    monkeypatch.setattr(
        dtd,
        "_run_comfy_cli_command",
        lambda _args: types.SimpleNamespace(returncode=1, stdout="", stderr="broken"),
    )

    dtd._run_missing_nodes_install_job(job_id, targets)
    with dtd.MISSING_INSTALL_JOBS_LOCK:
        job = dict(dtd.MISSING_INSTALL_JOBS[job_id])
    assert job["status"] == "failed"
    assert job["completed_targets"] == 0
    assert job["failed_targets"] == 1
    assert job["progress_percent"] == 100.0
