from __future__ import annotations

import json
import socket
import subprocess
import sys
import time
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Any

from runtime_paths import DATA_DIR, get_source_root

ROOT_DIR = get_source_root()
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
    """Write the latest report into the built dashboard and open it locally."""
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
    REPORT_DATA_SCRIPT.write_text(script_contents, encoding="utf-8")
    dashboard_url = get_dashboard_url()
    webbrowser.open(dashboard_url)
    return dashboard_url
