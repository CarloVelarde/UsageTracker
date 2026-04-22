from __future__ import annotations

import json
import socket
import subprocess
import sys
import time
import webbrowser
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from runtime_paths import (
    BUNDLE_ROOT,
    DASHBOARD_DIST_DIR,
    DASHBOARD_ENTRY,
    DATA_DIR,
    REPORT_DATA_FILE,
    is_frozen,
)

DASHBOARD_HOST = "127.0.0.1"
DASHBOARD_PORT = 8765


class DashboardRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(DASHBOARD_DIST_DIR), **kwargs)

    def do_GET(self) -> None:
        request_path = urlsplit(self.path).path
        if request_path == "/report-data.js":
            self.serve_report_data()
            return

        super().do_GET()

    def log_message(self, format: str, *args: Any) -> None:
        return

    def serve_report_data(self) -> None:
        if REPORT_DATA_FILE.exists():
            payload = REPORT_DATA_FILE.read_text(encoding="utf-8")
        else:
            payload = "window.__USAGE_REPORT__ = null;\n"

        encoded_payload = payload.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded_payload)))
        self.end_headers()
        self.wfile.write(encoded_payload)


def is_dashboard_server_running() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex((DASHBOARD_HOST, DASHBOARD_PORT)) == 0


def serve_dashboard_forever() -> None:
    server = ThreadingHTTPServer((DASHBOARD_HOST, DASHBOARD_PORT), DashboardRequestHandler)
    server.daemon_threads = True
    try:
        server.serve_forever()
    finally:
        server.server_close()


def start_dashboard_server() -> bool:
    if not DASHBOARD_ENTRY.exists():
        return False

    if is_dashboard_server_running():
        return True

    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS

    if is_frozen():
        command = [sys.executable, "--serve-dashboard"]
    else:
        command = [sys.executable, str(BUNDLE_ROOT / "main.py"), "--serve-dashboard"]

    subprocess.Popen(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        creationflags=creationflags,
    )

    for _ in range(30):
        if is_dashboard_server_running():
            return True
        time.sleep(0.1)

    return False


def get_dashboard_url() -> str | None:
    if start_dashboard_server():
        return f"http://{DASHBOARD_HOST}:{DASHBOARD_PORT}/"

    return None


def get_report_day(report_payload: dict[str, Any]) -> str | None:
    started_at = report_payload.get("run_started_at")
    if not isinstance(started_at, str):
        return None

    try:
        return datetime.fromisoformat(started_at).date().isoformat()
    except ValueError:
        return None


def load_report(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def aggregate_same_day_reports(report_payload: dict[str, Any]) -> dict[str, Any]:
    report_day = get_report_day(report_payload)
    if report_day is None:
        return report_payload

    matching_reports: list[dict[str, Any]] = []
    for path in sorted(DATA_DIR.glob("usage_*.json")):
        loaded = load_report(path)
        if loaded is None:
            continue
        if get_report_day(loaded) == report_day:
            matching_reports.append(loaded)

    if not matching_reports:
        return report_payload

    matching_reports.sort(key=lambda payload: payload.get("run_started_at", ""))
    combined_sessions: list[dict[str, Any]] = []
    for payload in matching_reports:
        sessions = payload.get("sessions")
        if isinstance(sessions, list):
            combined_sessions.extend(sessions)

    return {
        **report_payload,
        "run_started_at": matching_reports[0].get(
            "run_started_at",
            report_payload.get("run_started_at"),
        ),
        "run_ended_at": matching_reports[-1].get(
            "run_ended_at",
            report_payload.get("run_ended_at"),
        ),
        "sessions": combined_sessions,
    }


def publish_dashboard(report_payload: dict[str, Any], source_path: Path) -> str | None:
    """Write the latest report into runtime state and open the bundled dashboard locally."""
    if not DASHBOARD_ENTRY.exists():
        return None

    aggregated_payload = aggregate_same_day_reports(report_payload)
    dashboard_payload = {
        **aggregated_payload,
        "source_file_name": source_path.name,
        "source_file_path": str(source_path),
    }
    script_contents = (
        "window.__USAGE_REPORT__ = "
        f"{json.dumps(dashboard_payload, indent=2)};\n"
    )
    REPORT_DATA_FILE.write_text(script_contents, encoding="utf-8")
    dashboard_url = get_dashboard_url()
    if dashboard_url is None:
        return None

    webbrowser.open(dashboard_url)
    return dashboard_url
