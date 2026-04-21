from __future__ import annotations

import json
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "dashboard"
DIST_DIR = FRONTEND_DIR / "dist"
DASHBOARD_ENTRY = DIST_DIR / "index.html"
REPORT_DATA_SCRIPT = DIST_DIR / "report-data.js"
DASHBOARD_HOST = "127.0.0.1"
DASHBOARD_PORT = 8765


def is_dashboard_server_running() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex((DASHBOARD_HOST, DASHBOARD_PORT)) == 0


def start_dashboard_server() -> bool:
    if is_dashboard_server_running():
        return True

    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS

    subprocess.Popen(
        [
            sys.executable,
            "-m",
            "http.server",
            str(DASHBOARD_PORT),
            "--bind",
            DASHBOARD_HOST,
            "--directory",
            str(DIST_DIR),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        creationflags=creationflags,
    )

    for _ in range(20):
        if is_dashboard_server_running():
            return True
        time.sleep(0.1)

    return False


def get_dashboard_url() -> str:
    if start_dashboard_server():
        return f"http://{DASHBOARD_HOST}:{DASHBOARD_PORT}/"

    return DASHBOARD_ENTRY.resolve().as_uri()


def publish_dashboard(report_payload: dict[str, Any], source_path: Path) -> str | None:
    """Write the latest report into the built dashboard and open it locally."""
    if not DASHBOARD_ENTRY.exists():
        return None

    dashboard_payload = {
        **report_payload,
        "source_file_name": source_path.name,
        "source_file_path": str(source_path),
    }
    script_contents = (
        "window.__USAGE_REPORT__ = "
        f"{json.dumps(dashboard_payload, indent=2)};\n"
    )
    REPORT_DATA_SCRIPT.write_text(script_contents, encoding="utf-8")
    dashboard_url = get_dashboard_url()
    webbrowser.open(dashboard_url)
    return dashboard_url
