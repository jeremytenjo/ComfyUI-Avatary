import logging
import os
import ssl
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.error
import urllib.request
import uuid
import json
import re
import zipfile
from pathlib import Path
from typing import Callable

from aiohttp import web

import folder_paths
from server import PromptServer

WEB_DIRECTORY = "./web"
HOT_RELOAD_ENV_VAR = "COMFYUI_DTD_HOT_RELOAD"

# No node classes; this extension only exposes backend + frontend utilities.
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
DOWNLOAD_JOBS: dict[str, dict] = {}
DOWNLOAD_JOBS_LOCK = threading.Lock()
MISSING_INSTALL_JOBS: dict[str, dict] = {}
MISSING_INSTALL_JOBS_LOCK = threading.Lock()


def _sanitize_http_reason(reason: object, fallback: str = "Request failed") -> str:
    text = str(reason or "")
    text = text.replace("\r", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text or fallback


def _is_hot_reload_enabled() -> bool:
    value = os.environ.get(HOT_RELOAD_ENV_VAR, "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _compute_web_change_stamp() -> float:
    web_dir = Path(__file__).resolve().parent / "web"
    if not web_dir.is_dir():
        return 0.0

    newest_mtime = 0.0
    for path in web_dir.rglob("*"):
        if not path.is_file():
            continue
        if any(part.startswith(".") for part in path.parts):
            continue
        try:
            newest_mtime = max(newest_mtime, path.stat().st_mtime)
        except OSError:
            # Ignore races while files are being edited.
            continue
    return newest_mtime

def _iter_subdirectories(base_path: str) -> list[str]:
    if not os.path.isdir(base_path):
        return []

    discovered: list[str] = []
    for dirpath, dirnames, _filenames in os.walk(base_path, topdown=True):
        # Skip hidden/cache folders to keep the UI list useful.
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d != "__pycache__"]
        dirnames.sort(key=str.lower)
        for dirname in dirnames:
            discovered.append(os.path.abspath(os.path.join(dirpath, dirname)))

    discovered.sort(key=str.lower)
    return discovered


def _add_subroots(roots: dict[str, str], key_prefix: str, base_path: str) -> None:
    abs_base = os.path.abspath(base_path)
    roots[key_prefix] = abs_base
    for subdir_path in _iter_subdirectories(abs_base):
        rel = os.path.relpath(subdir_path, abs_base).replace(os.sep, "/")
        roots[f"{key_prefix}/{rel}"] = subdir_path


def _build_root_map() -> dict[str, str]:
    roots: dict[str, str] = {
        "input": os.path.abspath(folder_paths.get_input_directory()),
        "output": os.path.abspath(folder_paths.get_output_directory()),
        "user": os.path.abspath(folder_paths.get_user_directory()),
        "comfy_root": os.path.abspath(folder_paths.base_path),
    }

    _add_subroots(roots, "models", folder_paths.models_dir)

    for index, custom_nodes_dir in enumerate(_custom_nodes_roots()):
        key_prefix = "custom_nodes" if index == 0 else f"custom_nodes_{index + 1}"
        roots[key_prefix] = os.path.abspath(custom_nodes_dir)

    # Add a dedicated download area under the user directory for a safe default.
    user_downloads = os.path.join(roots["user"], "downloads")
    os.makedirs(user_downloads, exist_ok=True)
    roots["user_downloads"] = os.path.abspath(user_downloads)
    return roots


def _is_within_root(candidate_path: str, root_path: str) -> bool:
    candidate = os.path.abspath(candidate_path)
    root = os.path.abspath(root_path)
    try:
        return os.path.commonpath([candidate, root]) == root
    except ValueError:
        return False


def _safe_path_from_root(root_path: str, relative_path: str) -> str:
    target = os.path.abspath(os.path.join(root_path, relative_path))
    if not _is_within_root(target, root_path):
        raise web.HTTPBadRequest(reason="Requested path escapes the selected root directory")
    return target


def _is_within_any_root(candidate_path: str, allowed_roots: list[str]) -> bool:
    return any(_is_within_root(candidate_path, root) for root in allowed_roots)


def _custom_nodes_roots() -> list[str]:
    return [
        os.path.abspath(path)
        for path in folder_paths.get_folder_paths("custom_nodes")
        if str(path or "").strip()
    ]


def _sanitize_filename(name: str) -> str:
    cleaned = name.replace("\\", "/").split("/")[-1].strip()
    if not cleaned or cleaned in {".", ".."}:
        raise web.HTTPBadRequest(reason="Invalid filename")
    return cleaned


def _filename_from_url(download_url: str) -> str:
    parsed = urllib.parse.urlparse(download_url)
    inferred = Path(parsed.path).name
    if not inferred:
        raise web.HTTPBadRequest(reason="Unable to infer filename from URL; provide filename explicitly")
    return _sanitize_filename(inferred)


def _validate_remote_url(download_url: str) -> urllib.parse.ParseResult:
    parsed = urllib.parse.urlparse(download_url)
    if parsed.scheme not in {"http", "https"}:
        raise web.HTTPBadRequest(reason="Only http/https URLs are supported")
    if not parsed.netloc:
        raise web.HTTPBadRequest(reason="Invalid URL")
    return parsed


def _normalize_download_url(download_url: str) -> str:
    parsed = urllib.parse.urlparse(download_url)
    host = (parsed.hostname or "").lower()

    # Convert GitHub blob links to raw content links.
    # Example:
    # https://github.com/org/repo/blob/main/path/file.yaml
    # -> https://raw.githubusercontent.com/org/repo/main/path/file.yaml
    if host in {"github.com", "www.github.com"}:
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) >= 5 and parts[2] == "blob":
            owner, repo, _, ref, *rest = parts
            raw_path = "/".join([owner, repo, ref, *rest])
            return urllib.parse.urlunparse(
                ("https", "raw.githubusercontent.com", f"/{raw_path}", "", "", "")
            )

    # Convert Hugging Face blob links to direct resolve links.
    # Example:
    # https://huggingface.co/org/repo/blob/main/model.safetensors
    # -> https://huggingface.co/org/repo/resolve/main/model.safetensors?download=true
    if host in {"huggingface.co", "www.huggingface.co"}:
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) >= 5 and parts[2] == "blob":
            owner, repo, _, ref, *rest = parts
            resolve_path = "/".join([owner, repo, "resolve", ref, *rest])
            query = "download=true"
            return urllib.parse.urlunparse(
                ("https", "huggingface.co", f"/{resolve_path}", "", query, "")
            )

    return download_url


def _extract_repo_clone_spec(download_url: str) -> dict | None:
    parsed = urllib.parse.urlparse(download_url)
    host = (parsed.hostname or "").lower()
    parts = [part for part in parsed.path.split("/") if part]
    clean_url = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))

    if not parts:
        return None

    raw_repo_name = parts[-1]
    if raw_repo_name.lower().endswith(".git"):
        raw_repo_name = raw_repo_name[:-4]
    if raw_repo_name and host not in {"github.com", "www.github.com", "huggingface.co", "www.huggingface.co"}:
        return {
            "clone_url": clean_url,
            "repo_name": raw_repo_name,
            "clone_branch": "",
        }

    if host in {"github.com", "www.github.com"} and len(parts) >= 2:
        owner, repo = parts[0], parts[1]
        if repo.lower().endswith(".git"):
            repo = repo[:-4]
        if not owner or not repo:
            return None
        clone_branch = ""
        if len(parts) >= 4 and parts[2] == "tree":
            clone_branch = urllib.parse.unquote("/".join(parts[3:])).strip()
        return {
            "clone_url": f"https://github.com/{owner}/{repo}.git",
            "repo_name": repo,
            "clone_branch": clone_branch,
        }

    if host in {"huggingface.co", "www.huggingface.co"}:
        clone_branch = ""

        if len(parts) >= 3 and parts[0] in {"spaces", "datasets"}:
            namespace, owner, repo = parts[0], parts[1], parts[2]
            if len(parts) >= 5 and parts[3] == "tree":
                clone_branch = urllib.parse.unquote("/".join(parts[4:])).strip()
            return {
                "clone_url": f"https://huggingface.co/{namespace}/{owner}/{repo}",
                "repo_name": repo,
                "clone_branch": clone_branch,
            }

        blocked_prefixes = {
            "docs",
            "blog",
            "join",
            "login",
            "settings",
            "organizations",
            "models",
            "tasks",
            "collections",
            "new",
            "api",
        }
        if len(parts) >= 2 and parts[0] not in blocked_prefixes:
            owner, repo = parts[0], parts[1]
            if len(parts) >= 4 and parts[2] == "tree":
                clone_branch = urllib.parse.unquote("/".join(parts[3:])).strip()
            return {
                "clone_url": f"https://huggingface.co/{owner}/{repo}",
                "repo_name": repo,
                "clone_branch": clone_branch,
            }

    return None


def _open_url_with_ssl_fallback(req: urllib.request.Request, timeout: int = 45):
    try:
        return urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.URLError as exc:
        if not isinstance(exc.reason, ssl.SSLCertVerificationError):
            raise

        try:
            import certifi  # type: ignore
        except ImportError as import_err:
            raise web.HTTPBadRequest(
                reason=(
                    "TLS certificate verification failed and certifi is not installed. "
                    "Install certifi in this Python environment or run your Python "
                    "certificate setup, then retry."
                )
            ) from import_err

        ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        return urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx)


def _download_file(
    download_url: str,
    destination_path: str,
    huggingface_token: str = "",
    prefer_remote_filename: bool = False,
    overwrite: bool = False,
    progress_callback: Callable[[int, int | None], None] | None = None,
) -> tuple[int, int | None, str]:
    def _filename_from_content_disposition(value: str) -> str:
        raw = str(value or "").strip()
        if not raw:
            return ""

        match_star = re.search(r"filename\*\s*=\s*([^;]+)", raw, flags=re.IGNORECASE)
        if match_star:
            encoded = match_star.group(1).strip().strip('"')
            if "''" in encoded:
                encoded = encoded.split("''", 1)[1]
            decoded = urllib.parse.unquote(encoded).strip()
            if decoded:
                return decoded

        match_plain = re.search(r"filename\s*=\s*([^;]+)", raw, flags=re.IGNORECASE)
        if match_plain:
            return match_plain.group(1).strip().strip('"').strip()
        return ""

    parsed_url = urllib.parse.urlparse(download_url)
    host = (parsed_url.hostname or "").lower()
    headers = {
        "User-Agent": "ComfyUI-Downloader/1.0",
    }
    # Allow authenticated downloads for gated HF models when users provide a token.
    if (
        huggingface_token
        and host in {"huggingface.co", "www.huggingface.co", "hf.co"}
    ):
        headers["Authorization"] = f"Bearer {huggingface_token}"

    req = urllib.request.Request(
        download_url,
        headers=headers,
    )

    bytes_written = 0
    tmp_file_path = ""
    target_dir = os.path.dirname(destination_path)
    resolved_destination_path = destination_path

    try:
        with _open_url_with_ssl_fallback(req, timeout=45) as response:
            if response.status >= 400:
                raise web.HTTPBadRequest(reason=f"Download failed with status {response.status}")
            total_bytes = None
            content_length = response.headers.get("Content-Length")
            if content_length:
                try:
                    parsed_length = int(content_length)
                    if parsed_length >= 0:
                        total_bytes = parsed_length
                except ValueError:
                    total_bytes = None

            if prefer_remote_filename:
                remote_name = _filename_from_content_disposition(
                    response.headers.get("Content-Disposition", "")
                )
                if remote_name:
                    remote_name = _sanitize_filename(remote_name)
                    candidate = os.path.abspath(os.path.join(target_dir, remote_name))
                    if not _is_within_root(candidate, target_dir):
                        raise web.HTTPBadRequest(reason="Remote filename resolved outside target folder")
                    if (
                        candidate != destination_path
                        and os.path.exists(candidate)
                        and not overwrite
                    ):
                        raise web.HTTPConflict(
                            reason=(
                                "Destination file already exists; set overwrite=true to replace it"
                            )
                        )
                    resolved_destination_path = candidate

            if progress_callback is not None:
                progress_callback(0, total_bytes)

            with tempfile.NamedTemporaryFile(
                mode="wb",
                suffix=".part",
                prefix="download_",
                dir=target_dir,
                delete=False,
            ) as tmp:
                tmp_file_path = tmp.name
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    tmp.write(chunk)
                    bytes_written += len(chunk)
                    if progress_callback is not None:
                        progress_callback(bytes_written, total_bytes)

        os.replace(tmp_file_path, resolved_destination_path)
        return bytes_written, total_bytes, resolved_destination_path
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            raise web.HTTPBadRequest(
                reason=(
                    f"Download blocked by remote host (HTTP {exc.code}). "
                    "Authentication or access approval may be required."
                )
            ) from exc
        raise web.HTTPBadRequest(
            reason=_sanitize_http_reason(
                f"Download failed with HTTP {exc.code} ({exc.reason})",
                fallback=f"Download failed with HTTP {exc.code}",
            )
        ) from exc
    except Exception:
        if tmp_file_path and os.path.exists(tmp_file_path):
            try:
                os.remove(tmp_file_path)
            except OSError:
                logging.warning("Failed to clean temporary download file: %s", tmp_file_path)
        raise


def _prepare_download_request(body: dict) -> dict:
    download_url = str(body.get("url", "")).strip()
    root_key = str(body.get("root_key", "")).strip()
    folder = str(body.get("folder", "")).strip()
    subdirectory = str(body.get("subdirectory", "")).strip()
    filename = str(body.get("filename", "")).strip()
    overwrite = bool(body.get("overwrite", False))
    huggingface_token = str(
        body.get("huggingface_token", body.get("hf_token", ""))
    ).strip()

    if not download_url:
        raise web.HTTPBadRequest(reason="Missing required field: url")

    roots = _build_root_map()
    if folder:
        root_key = "comfy_root"
        # Treat typed folder as relative to ComfyUI root.
        subdirectory = folder.replace("\\", "/").lstrip("/")

    if root_key not in roots:
        raise web.HTTPBadRequest(reason="Invalid root_key")

    download_url = _normalize_download_url(download_url)
    _validate_remote_url(download_url)

    root_path = roots[root_key]

    if subdirectory:
        target_dir = _safe_path_from_root(root_path, subdirectory)
    else:
        target_dir = root_path

    os.makedirs(target_dir, exist_ok=True)

    def _is_custom_nodes_target(path: str) -> bool:
        return any(_is_within_root(path, custom_root) for custom_root in _custom_nodes_roots())

    repo_clone_spec = _extract_repo_clone_spec(download_url)
    if repo_clone_spec and _is_custom_nodes_target(target_dir):
        repo_name = _sanitize_filename(filename or str(repo_clone_spec["repo_name"]))
        destination_path = _safe_path_from_root(target_dir, repo_name)
        if os.path.exists(destination_path) and not overwrite:
            raise web.HTTPConflict(
                reason=(
                    "Destination folder already exists; set overwrite=true to replace it"
                )
            )
        return {
            "mode": "git_clone",
            "download_url": str(repo_clone_spec["clone_url"]),
            "root_key": root_key,
            "destination_path": destination_path,
            "huggingface_token": "",
            "overwrite": overwrite,
            "clone_branch": str(repo_clone_spec["clone_branch"] or ""),
        }

    if filename:
        safe_filename = _sanitize_filename(filename)
        prefer_remote_filename = False
    else:
        safe_filename = _filename_from_url(download_url)
        prefer_remote_filename = True

    destination_path = _safe_path_from_root(target_dir, safe_filename)

    if os.path.exists(destination_path) and not overwrite:
        raise web.HTTPConflict(reason="Destination file already exists; set overwrite=true to replace it")

    return {
        "mode": "download",
        "download_url": download_url,
        "root_key": root_key,
        "destination_path": destination_path,
        "huggingface_token": huggingface_token,
        "overwrite": overwrite,
        "prefer_remote_filename": prefer_remote_filename,
    }


def _parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _prepare_upload_request(body: dict, uploaded_filename: str) -> dict:
    root_key = str(body.get("root_key", "")).strip()
    folder = str(body.get("folder", "")).strip()
    subdirectory = str(body.get("subdirectory", "")).strip()
    filename = str(body.get("filename", "")).strip()
    overwrite = _parse_bool(body.get("overwrite", False))

    roots = _build_root_map()
    if folder:
        root_key = "comfy_root"
        # Treat typed folder as relative to ComfyUI root.
        subdirectory = folder.replace("\\", "/").lstrip("/")

    if root_key not in roots:
        raise web.HTTPBadRequest(reason="Invalid root_key")

    root_path = roots[root_key]
    target_dir = _safe_path_from_root(root_path, subdirectory) if subdirectory else root_path
    os.makedirs(target_dir, exist_ok=True)

    desired_filename = filename or str(uploaded_filename or "").strip()
    if not desired_filename:
        raise web.HTTPBadRequest(reason="Missing uploaded filename")

    safe_filename = _sanitize_filename(desired_filename)
    destination_path = _safe_path_from_root(target_dir, safe_filename)
    if os.path.exists(destination_path) and not overwrite:
        raise web.HTTPConflict(reason="Destination file already exists; set overwrite=true to replace it")

    return {
        "root_key": root_key,
        "destination_path": destination_path,
    }


def _resolve_deletable_path(path_value: str, roots: dict[str, str]) -> tuple[str, bool]:
    candidate = str(path_value or "").strip()
    if not candidate:
        raise web.HTTPBadRequest(reason="Missing required field: path")

    delete_path = os.path.abspath(candidate)
    allowed_roots = [path for path in roots.values() if path]
    if not _is_within_any_root(delete_path, allowed_roots):
        raise web.HTTPBadRequest(reason="Requested path is outside allowed ComfyUI roots")
    is_directory = os.path.isdir(delete_path)
    if is_directory and not _is_within_any_root(delete_path, _custom_nodes_roots()):
        raise web.HTTPBadRequest(
            reason="Path points to a directory outside custom_nodes; only custom_nodes directories can be deleted"
        )
    return delete_path, is_directory


def _resolve_exportable_path(path_value: str, roots: dict[str, str]) -> str:
    candidate = str(path_value or "").strip()
    if not candidate:
        raise web.HTTPBadRequest(reason="Missing required field: path")

    export_path = os.path.abspath(candidate)
    allowed_roots = [path for path in roots.values() if path]
    if not _is_within_any_root(export_path, allowed_roots):
        raise web.HTTPBadRequest(reason="Requested path is outside allowed ComfyUI roots")
    if not os.path.exists(export_path):
        raise web.HTTPNotFound(reason="Requested path does not exist")
    return export_path


def _create_export_zip_archive(export_path: str) -> tuple[str, str]:
    base_name = os.path.basename(export_path.rstrip(os.sep)) or "export"
    safe_base_name = _sanitize_filename(base_name)
    archive_name = f"{safe_base_name}.zip"

    fd, archive_path = tempfile.mkstemp(prefix="dtd_export_", suffix=".zip")
    os.close(fd)

    try:
        with zipfile.ZipFile(archive_path, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            if os.path.isdir(export_path):
                parent_dir = os.path.dirname(export_path)
                for dirpath, _dirnames, filenames in os.walk(export_path):
                    rel_dir = os.path.relpath(dirpath, parent_dir).replace(os.sep, "/")
                    if not filenames:
                        archive.writestr(f"{rel_dir}/", "")
                    for filename in filenames:
                        source_file = os.path.join(dirpath, filename)
                        rel_file = os.path.relpath(source_file, parent_dir).replace(os.sep, "/")
                        archive.write(source_file, arcname=rel_file)
            else:
                archive.write(export_path, arcname=safe_base_name)
        return archive_path, archive_name
    except Exception:
        if os.path.exists(archive_path):
            try:
                os.remove(archive_path)
            except OSError:
                pass
        raise


def _prune_old_jobs() -> None:
    now = time.time()
    with DOWNLOAD_JOBS_LOCK:
        stale_job_ids = [
            job_id
            for job_id, job in DOWNLOAD_JOBS.items()
            if job.get("status") in {"completed", "failed"} and now - float(job.get("updated_at", now)) > 3600
        ]
        for job_id in stale_job_ids:
            DOWNLOAD_JOBS.pop(job_id, None)


def _prune_old_missing_install_jobs() -> None:
    now = time.time()
    with MISSING_INSTALL_JOBS_LOCK:
        stale_job_ids = [
            job_id
            for job_id, job in MISSING_INSTALL_JOBS.items()
            if job.get("status") in {"completed", "failed", "partial"} and now - float(job.get("updated_at", now)) > 3600
        ]
        for job_id in stale_job_ids:
            MISSING_INSTALL_JOBS.pop(job_id, None)


def _build_restart_command() -> list[str]:
    sys_argv = sys.argv.copy()
    if "--windows-standalone-build" in sys_argv:
        sys_argv.remove("--windows-standalone-build")

    if not sys_argv:
        return [sys.executable]

    if sys_argv[0].endswith("__main__.py"):
        module_name = os.path.basename(os.path.dirname(sys_argv[0]))
        return [sys.executable, "-m", module_name, *sys_argv[1:]]

    return [sys.executable, *sys_argv]


def _restart_comfyui_process() -> None:
    cmd = _build_restart_command()
    os.execv(sys.executable, cmd)


def _pkill_comfyui_processes() -> None:
    try:
        subprocess.run(
            ["pkill", "-f", "ComfyUI"],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        logging.warning("download-to-dir restart: `pkill` is not available in this environment")
    except Exception:
        logging.exception("download-to-dir restart: `pkill -f ComfyUI` failed")


def _install_clone_requirements_if_present(clone_target: str) -> None:
    requirements_path = os.path.join(clone_target, "requirements.txt")
    if not os.path.isfile(requirements_path):
        return

    def _run_pip_install(python_cmd: str):
        return subprocess.run(
            [python_cmd, "-m", "pip", "install", "-r", requirements_path],
            check=False,
            capture_output=True,
            text=True,
        )

    def _pip_missing(result) -> bool:
        combined = f"{result.stderr or ''}\n{result.stdout or ''}".lower()
        return "no module named pip" in combined

    try:
        result = _run_pip_install(sys.executable)
    except FileNotFoundError as exc:
        # Fallback to python3 if the active runtime command is unavailable.
        try:
            result = _run_pip_install("python3")
        except FileNotFoundError as fallback_exc:
            raise web.HTTPBadRequest(
                reason="Python runtime is unavailable for dependency installation"
            ) from fallback_exc

    if result.returncode == 0:
        return

    # If pip is missing in the current interpreter, retry with python3.
    if _pip_missing(result):
        try:
            fallback_result = _run_pip_install("python3")
        except FileNotFoundError as fallback_exc:
            raise web.HTTPBadRequest(
                reason="Dependency install failed: pip is unavailable in current python and python3 is missing"
            ) from fallback_exc

        if fallback_result.returncode == 0:
            return

        stderr = (fallback_result.stderr or "").strip()
        stdout = (fallback_result.stdout or "").strip()
        detail = stderr or stdout or "pip install failed"
        raise web.HTTPBadRequest(
            reason=_sanitize_http_reason(
                f"Dependency install failed: {detail}",
                fallback="Dependency install failed",
            )
        )

    stderr = (result.stderr or "").strip()
    stdout = (result.stdout or "").strip()
    detail = stderr or stdout or "pip install failed"
    raise web.HTTPBadRequest(
        reason=_sanitize_http_reason(
            f"Dependency install failed: {detail}",
            fallback="Dependency install failed",
        )
    )


def _run_comfy_cli_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    cmd = ["comfy", *args]
    try:
        return subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise web.HTTPInternalServerError(
            reason="`comfy` CLI is not available in this environment"
        ) from exc


def _display_name_from_source_url(source_url: str) -> str:
    value = str(source_url or "").strip().rstrip("/")
    if not value:
        return "unknown"
    base = os.path.basename(value)
    if base.lower().endswith(".git"):
        base = base[:-4]
    return base or value


def _should_ignore_unknown_node_name(node_name: str) -> bool:
    value = str(node_name or "").strip()
    if not value:
        return True
    if re.fullmatch(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        value,
    ):
        return True
    if re.fullmatch(r"[0-9a-fA-F]{32}", value):
        return True
    return False


def _analyze_workflow_missing_nodes(workflow: dict) -> dict:
    if not isinstance(workflow, dict):
        raise web.HTTPBadRequest(reason="`workflow` must be a JSON object")

    workflow_tmp = ""
    deps_tmp = ""
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            prefix="dtd_workflow_",
            encoding="utf-8",
            delete=False,
        ) as workflow_file:
            workflow_tmp = workflow_file.name
            json.dump(workflow, workflow_file, ensure_ascii=False)

        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            prefix="dtd_deps_",
            encoding="utf-8",
            delete=False,
        ) as deps_file:
            deps_tmp = deps_file.name

        result = _run_comfy_cli_command(
            ["node", "deps-in-workflow", "--workflow", workflow_tmp, "--output", deps_tmp]
        )
        if result.returncode != 0:
            detail = (result.stderr or "").strip() or (result.stdout or "").strip() or "deps-in-workflow failed"
            raise web.HTTPInternalServerError(
                reason=_sanitize_http_reason(
                    f"Missing-node analysis failed: {detail}",
                    fallback="Missing-node analysis failed",
                )
            )

        with open(deps_tmp, "r", encoding="utf-8") as handle:
            deps = json.load(handle)
    except web.HTTPException:
        raise
    except FileNotFoundError as exc:
        raise web.HTTPInternalServerError(
            reason=_sanitize_http_reason(
                f"Dependency analysis output missing: {exc}",
                fallback="Dependency analysis output missing",
            )
        ) from exc
    except json.JSONDecodeError as exc:
        raise web.HTTPInternalServerError(
            reason=_sanitize_http_reason(
                f"Failed to parse dependency analysis output: {exc}",
                fallback="Failed to parse dependency analysis output",
            )
        ) from exc
    except Exception as exc:
        raise web.HTTPInternalServerError(
            reason=_sanitize_http_reason(
                f"Missing-node analysis failed: {exc}",
                fallback="Missing-node analysis failed",
            )
        ) from exc
    finally:
        for path in (workflow_tmp, deps_tmp):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass

    custom_nodes = deps.get("custom_nodes", {})
    unknown_nodes_raw = deps.get("unknown_nodes", [])

    missing = []
    if isinstance(custom_nodes, dict):
        for source_url, info in custom_nodes.items():
            state = str((info or {}).get("state", "unknown")).strip().lower()
            if state == "installed":
                continue
            source = str(source_url or "").strip()
            display_name = _display_name_from_source_url(source)
            missing.append(
                {
                    "key": source or display_name,
                    "display_name": display_name,
                    "source_url": source,
                    "state": state or "unknown",
                    "install_target": source or display_name,
                }
            )

    unknown_nodes: list[str] = []
    if isinstance(unknown_nodes_raw, list):
        unknown_nodes = sorted(
            {
                str(node_name).strip()
                for node_name in unknown_nodes_raw
                if str(node_name).strip()
                and not _should_ignore_unknown_node_name(str(node_name))
            }
        )

    missing.sort(key=lambda item: str(item.get("display_name", "")).lower())
    return {"missing": missing, "unknown_nodes": unknown_nodes}


def _run_missing_nodes_install_job(job_id: str, targets: list[str]) -> None:
    total_targets = len(targets)
    with MISSING_INSTALL_JOBS_LOCK:
        job = MISSING_INSTALL_JOBS.get(job_id)
        if not job:
            return
        job["status"] = "running"
        job["updated_at"] = time.time()

    completed_targets = 0
    failed_targets = 0

    for index, target in enumerate(targets):
        with MISSING_INSTALL_JOBS_LOCK:
            job = MISSING_INSTALL_JOBS.get(job_id)
            if not job:
                return
            job["status"] = "running"
            job["current_target"] = target
            job["updated_at"] = time.time()

        result_entry = {
            "target": target,
            "ok": False,
            "stdout": "",
            "stderr": "",
            "return_code": -1,
        }

        try:
            result = _run_comfy_cli_command(["node", "install", "--exit-on-fail", target])
            stdout = (result.stdout or "").strip()
            stderr = (result.stderr or "").strip()
            is_ok = result.returncode == 0
            result_entry = {
                "target": target,
                "ok": is_ok,
                "stdout": stdout,
                "stderr": stderr,
                "return_code": int(result.returncode),
            }
            if is_ok:
                completed_targets += 1
            else:
                failed_targets += 1
        except web.HTTPException as exc:
            failed_targets += 1
            result_entry = {
                "target": target,
                "ok": False,
                "stdout": "",
                "stderr": str(exc.reason or exc.text or "Install failed"),
                "return_code": -1,
            }
        except Exception as exc:
            failed_targets += 1
            result_entry = {
                "target": target,
                "ok": False,
                "stdout": "",
                "stderr": str(exc),
                "return_code": -1,
            }

        with MISSING_INSTALL_JOBS_LOCK:
            job = MISSING_INSTALL_JOBS.get(job_id)
            if not job:
                return
            results = list(job.get("results", []))
            results.append(result_entry)
            job["results"] = results
            job["completed_targets"] = int(completed_targets)
            job["failed_targets"] = int(failed_targets)
            job["progress_percent"] = (
                ((index + 1) / total_targets) * 100.0 if total_targets > 0 else 0.0
            )
            job["updated_at"] = time.time()

    final_status = "completed"
    if failed_targets > 0 and completed_targets > 0:
        final_status = "partial"
    elif failed_targets > 0 and completed_targets == 0:
        final_status = "failed"

    with MISSING_INSTALL_JOBS_LOCK:
        job = MISSING_INSTALL_JOBS.get(job_id)
        if not job:
            return
        job["status"] = final_status
        job["current_target"] = ""
        job["progress_percent"] = 100.0 if total_targets > 0 else 0.0
        job["updated_at"] = time.time()


def _run_download_job(
    job_id: str,
    mode: str,
    download_url: str,
    destination_path: str,
    root_key: str,
    huggingface_token: str,
    overwrite: bool,
    clone_branch: str = "",
    prefer_remote_filename: bool = False,
) -> None:
    def on_progress(bytes_written: int, total_bytes: int | None) -> None:
        with DOWNLOAD_JOBS_LOCK:
            job = DOWNLOAD_JOBS.get(job_id)
            if not job:
                return
            job["status"] = "running"
            job["bytes_written"] = int(bytes_written)
            job["total_bytes"] = int(total_bytes) if total_bytes is not None else None
            job["updated_at"] = time.time()

    try:
        if mode == "git_clone":
            clone_target = destination_path
            if os.path.exists(clone_target):
                if not overwrite:
                    raise web.HTTPConflict(
                        reason=(
                            "Destination folder already exists; set overwrite=true to replace it"
                        )
                    )
                if os.path.isdir(clone_target):
                    shutil.rmtree(clone_target)
                else:
                    os.remove(clone_target)

            try:
                clone_cmd = ["git", "clone", "--depth", "1"]
                if clone_branch:
                    clone_cmd.extend(["--branch", clone_branch])
                clone_cmd.extend([download_url, clone_target])
                result = subprocess.run(
                    clone_cmd,
                    check=False,
                    capture_output=True,
                    text=True,
                )
            except FileNotFoundError as exc:
                raise web.HTTPBadRequest(
                    reason="`git` is not available in this Python environment"
                ) from exc

            if result.returncode != 0:
                stderr = (result.stderr or "").strip()
                stdout = (result.stdout or "").strip()
                detail = stderr or stdout or "git clone failed"
                raise web.HTTPBadRequest(
                    reason=_sanitize_http_reason(
                        f"Git clone failed: {detail}",
                        fallback="Git clone failed",
                    )
                )

            _install_clone_requirements_if_present(clone_target)
            bytes_written, total_bytes = 0, None
        else:
            bytes_written, total_bytes, destination_path = _download_file(
                download_url,
                destination_path,
                huggingface_token=huggingface_token,
                prefer_remote_filename=prefer_remote_filename,
                overwrite=overwrite,
                progress_callback=on_progress,
            )
        with DOWNLOAD_JOBS_LOCK:
            job = DOWNLOAD_JOBS.get(job_id)
            if not job:
                return
            job["status"] = "completed"
            job["bytes_written"] = int(bytes_written)
            job["total_bytes"] = int(total_bytes) if total_bytes is not None else None
            job["destination_path"] = destination_path
            job["root_key"] = root_key
            job["error"] = ""
            job["updated_at"] = time.time()
    except web.HTTPException as exc:
        with DOWNLOAD_JOBS_LOCK:
            job = DOWNLOAD_JOBS.get(job_id)
            if not job:
                return
            job["status"] = "failed"
            job["error"] = str(exc.reason or exc.text or "Download failed")
            job["updated_at"] = time.time()
    except Exception as exc:
        logging.exception("download-to-dir async failed")
        with DOWNLOAD_JOBS_LOCK:
            job = DOWNLOAD_JOBS.get(job_id)
            if not job:
                return
            job["status"] = "failed"
            job["error"] = str(exc)
            job["updated_at"] = time.time()


@PromptServer.instance.routes.get("/download-to-dir/roots")
async def list_download_roots(request: web.Request) -> web.Response:
    roots = _build_root_map()
    # Do not expose Comfy root as a direct selectable root in public UI.
    payload = [{"key": key, "path": path} for key, path in roots.items() if key != "comfy_root"]
    return web.json_response({"roots": payload})


@PromptServer.instance.routes.get("/download-to-dir/dev/web-change-stamp")
async def get_web_change_stamp(_request: web.Request) -> web.Response:
    if not _is_hot_reload_enabled():
        return web.json_response({"enabled": False, "stamp": 0})
    return web.json_response({"enabled": True, "stamp": _compute_web_change_stamp()})


@PromptServer.instance.routes.post("/download-to-dir/start")
async def start_download_to_directory(request: web.Request) -> web.Response:
    body = await request.json()
    prepared = _prepare_download_request(body)

    job_id = uuid.uuid4().hex
    now = time.time()
    with DOWNLOAD_JOBS_LOCK:
        DOWNLOAD_JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "bytes_written": 0,
            "total_bytes": None,
            "destination_path": prepared["destination_path"],
            "root_key": prepared["root_key"],
            "error": "",
            "updated_at": now,
            "started_at": now,
        }

    threading.Thread(
        target=_run_download_job,
        args=(
            job_id,
            prepared["mode"],
            prepared["download_url"],
            prepared["destination_path"],
            prepared["root_key"],
            prepared["huggingface_token"],
            bool(prepared.get("overwrite", False)),
            str(prepared.get("clone_branch", "") or ""),
            bool(prepared.get("prefer_remote_filename", False)),
        ),
        daemon=True,
    ).start()
    _prune_old_jobs()

    return web.json_response(
        {
            "ok": True,
            "job_id": job_id,
            "destination_path": prepared["destination_path"],
            "root_key": prepared["root_key"],
        }
    )


@PromptServer.instance.routes.get("/download-to-dir/progress/{job_id}")
async def get_download_progress(request: web.Request) -> web.Response:
    job_id = request.match_info.get("job_id", "").strip()
    with DOWNLOAD_JOBS_LOCK:
        job = DOWNLOAD_JOBS.get(job_id)
        if not job:
            raise web.HTTPNotFound(reason="Download job not found")
        payload = dict(job)

    total_bytes = payload.get("total_bytes")
    bytes_written = int(payload.get("bytes_written", 0))
    if isinstance(total_bytes, int) and total_bytes > 0:
        payload["progress_percent"] = min(100.0, max(0.0, (bytes_written / total_bytes) * 100.0))
    else:
        payload["progress_percent"] = None

    return web.json_response(payload)


@PromptServer.instance.routes.post("/download-to-dir/delete")
async def delete_downloaded_file(request: web.Request) -> web.Response:
    body = await request.json()
    roots = _build_root_map()
    delete_path, is_directory = _resolve_deletable_path(body.get("path", ""), roots)

    deleted = False
    try:
        if os.path.exists(delete_path):
            if is_directory:
                shutil.rmtree(delete_path)
            else:
                os.remove(delete_path)
            deleted = True
    except FileNotFoundError:
        deleted = False
    except OSError as exc:
        raise web.HTTPInternalServerError(
            reason=_sanitize_http_reason(
                f"Failed to delete file: {exc}",
                fallback="Failed to delete file",
            )
        )

    return web.json_response({"ok": True, "deleted": deleted, "path": delete_path})


@PromptServer.instance.routes.post("/download-to-dir/upload")
async def upload_file_to_directory(request: web.Request) -> web.Response:
    form = await request.post()
    file_field = form.get("file")
    if not isinstance(file_field, web.FileField):
        raise web.HTTPBadRequest(reason="Missing upload field: file")

    prepared = _prepare_upload_request(dict(form), file_field.filename)
    destination_path = prepared["destination_path"]
    target_dir = os.path.dirname(destination_path)
    tmp_file_path = ""
    bytes_written = 0

    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            suffix=".part",
            prefix="upload_",
            dir=target_dir,
            delete=False,
        ) as tmp:
            tmp_file_path = tmp.name
            while True:
                chunk = file_field.file.read(1024 * 1024)
                if not chunk:
                    break
                tmp.write(chunk)
                bytes_written += len(chunk)

        os.replace(tmp_file_path, destination_path)
    except Exception:
        if tmp_file_path and os.path.exists(tmp_file_path):
            try:
                os.remove(tmp_file_path)
            except OSError:
                logging.warning("Failed to clean temporary upload file: %s", tmp_file_path)
        raise

    return web.json_response(
        {
            "ok": True,
            "destination_path": destination_path,
            "root_key": prepared["root_key"],
            "bytes_written": bytes_written,
        }
    )


@PromptServer.instance.routes.post("/download-to-dir/export")
async def export_path_as_zip(request: web.Request) -> web.StreamResponse:
    body = await request.json()
    roots = _build_root_map()
    export_path = _resolve_exportable_path(body.get("path", ""), roots)
    archive_path, archive_name = _create_export_zip_archive(export_path)

    response = web.StreamResponse(
        status=200,
        headers={
            "Content-Type": "application/zip",
            "Content-Disposition": f'attachment; filename="{archive_name}"',
        },
    )

    try:
        stat = os.stat(archive_path)
        response.content_length = stat.st_size
        await response.prepare(request)
        with open(archive_path, "rb") as handle:
            while True:
                chunk = handle.read(1024 * 1024)
                if not chunk:
                    break
                await response.write(chunk)
        await response.write_eof()
        return response
    finally:
        if os.path.exists(archive_path):
            try:
                os.remove(archive_path)
            except OSError:
                logging.warning("Failed to clean temporary export file: %s", archive_path)


@PromptServer.instance.routes.post("/download-to-dir/missing-nodes/analyze")
async def analyze_missing_nodes(request: web.Request) -> web.Response:
    body = await request.json()
    workflow = body.get("workflow")
    analyzed = _analyze_workflow_missing_nodes(workflow)
    return web.json_response({"ok": True, **analyzed})


@PromptServer.instance.routes.post("/download-to-dir/missing-nodes/install")
async def install_missing_nodes(request: web.Request) -> web.Response:
    body = await request.json()
    raw_targets = body.get("targets", [])
    if not isinstance(raw_targets, list):
        raise web.HTTPBadRequest(reason="`targets` must be an array of node specs or git URLs")

    targets: list[str] = []
    seen = set()
    for item in raw_targets:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        targets.append(value)

    if not targets:
        raise web.HTTPBadRequest(reason="No install targets were provided")

    job_id = uuid.uuid4().hex
    now = time.time()
    with MISSING_INSTALL_JOBS_LOCK:
        MISSING_INSTALL_JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "targets": list(targets),
            "total_targets": len(targets),
            "completed_targets": 0,
            "failed_targets": 0,
            "current_target": "",
            "progress_percent": 0.0,
            "results": [],
            "updated_at": now,
            "started_at": now,
        }

    threading.Thread(
        target=_run_missing_nodes_install_job,
        args=(job_id, list(targets)),
        daemon=True,
    ).start()
    _prune_old_missing_install_jobs()

    return web.json_response(
        {
            "ok": True,
            "job_id": job_id,
            "status": "queued",
            "total_targets": len(targets),
        }
    )


@PromptServer.instance.routes.get("/download-to-dir/missing-nodes/install-progress/{job_id}")
async def get_missing_nodes_install_progress(request: web.Request) -> web.Response:
    job_id = request.match_info.get("job_id", "").strip()
    with MISSING_INSTALL_JOBS_LOCK:
        job = MISSING_INSTALL_JOBS.get(job_id)
        if not job:
            raise web.HTTPNotFound(reason="Missing-node install job not found")
        payload = dict(job)
        payload["results"] = list(job.get("results", []))
        payload["targets"] = list(job.get("targets", []))

    return web.json_response(payload)


@PromptServer.instance.routes.get("/download-to-dir/restart")
async def restart_comfyui_from_extension(_request: web.Request) -> web.Response:
    def _restart_later():
        time.sleep(0.2)
        try:
            _pkill_comfyui_processes()
            _restart_comfyui_process()
        except Exception:
            logging.exception("download-to-dir restart failed")

    threading.Thread(target=_restart_later, daemon=True).start()
    return web.json_response({"ok": True, "message": "Restart requested"})
