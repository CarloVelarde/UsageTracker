from __future__ import annotations

import json
import re
import shutil
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Any

from runtime_paths import DASHBOARD_DIST_DIR, DASHBOARD_ENTRY, DASHBOARD_SNAPSHOTS_DIR, REPORTS_DIR


STYLESHEET_PATTERN = re.compile(
    r'<link\s+rel="stylesheet"\s+crossorigin\s+href="(?P<href>[^"]+)">',
)
MODULE_SCRIPT_PATTERN = re.compile(
    r'<script\s+type="module"\s+crossorigin\s+src="(?P<src>[^"]+)"></script>',
)
REPORT_SCRIPT_PATTERN = re.compile(
    r'<script\s+src="\./report-data\.js"></script>',
)


def inline_snapshot_html(script_contents: str) -> str:
    html = DASHBOARD_ENTRY.read_text(encoding="utf-8")

    def replace_stylesheet(match: re.Match[str]) -> str:
        href = match.group("href")
        css_path = DASHBOARD_DIST_DIR / href.lstrip("./")
        css_contents = css_path.read_text(encoding="utf-8")
        return f"<style>\n{css_contents}\n</style>"

    def replace_module_script(match: re.Match[str]) -> str:
        src = match.group("src")
        js_path = DASHBOARD_DIST_DIR / src.lstrip("./")
        js_contents = js_path.read_text(encoding="utf-8")
        return (
            f"<script>\n{script_contents}</script>\n"
            f'<script type="module">\n{js_contents}\n</script>'
        )

    html = STYLESHEET_PATTERN.sub(replace_stylesheet, html)
    html = MODULE_SCRIPT_PATTERN.sub(replace_module_script, html)
    html = REPORT_SCRIPT_PATTERN.sub("", html)
    return html


def create_dashboard_snapshot(
    snapshot_name: str,
    script_contents: str,
    report_payload: dict[str, Any],
) -> Path | None:
    if not DASHBOARD_ENTRY.exists():
        return None

    snapshot_dir = DASHBOARD_SNAPSHOTS_DIR / snapshot_name
    if snapshot_dir.exists():
        shutil.rmtree(snapshot_dir)

    snapshot_dir.mkdir(parents=True, exist_ok=True)
    snapshot_html = inline_snapshot_html(script_contents)
    (snapshot_dir / "index.html").write_text(snapshot_html, encoding="utf-8")
    (snapshot_dir / "report.json").write_text(
        json.dumps(report_payload, indent=2) + "\n",
        encoding="utf-8",
    )

    favicon_path = DASHBOARD_DIST_DIR / "favicon.svg"
    if favicon_path.exists():
        shutil.copy2(favicon_path, snapshot_dir / "favicon.svg")

    return snapshot_dir / "index.html"


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


def aggregate_same_day_reports(
    report_payload: dict[str, Any],
    source_path: Path | None = None,
) -> dict[str, Any]:
    report_day = get_report_day(report_payload)
    if report_day is None:
        return report_payload

    matching_reports: list[dict[str, Any]] = []
    source_path_resolved = source_path.resolve(strict=False) if source_path is not None else None
    seen_paths: set[Path] = set()
    for path in sorted(REPORTS_DIR.glob("usage_*.json")):
        resolved_path = path.resolve(strict=False)
        if resolved_path in seen_paths:
            continue
        seen_paths.add(resolved_path)

        if source_path_resolved is not None and path.resolve(strict=False) == source_path_resolved:
            continue

        loaded = load_report(path)
        if loaded is None:
            continue
        if get_report_day(loaded) == report_day:
            matching_reports.append(loaded)

    matching_reports.append(report_payload)

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
    """Write a local dashboard snapshot and open it without leaving a background server running."""
    if not DASHBOARD_ENTRY.exists():
        return None

    aggregated_payload = aggregate_same_day_reports(report_payload, source_path)
    dashboard_payload = {
        **aggregated_payload,
        "source_file_name": source_path.name,
        "source_file_path": str(source_path),
    }
    script_contents = (
        "window.__USAGE_REPORT__ = "
        f"{json.dumps(dashboard_payload, indent=2)};\n"
    )
    snapshot_entry = create_dashboard_snapshot(
        source_path.stem,
        script_contents,
        dashboard_payload,
    )
    if snapshot_entry is None:
        return None

    dashboard_url = snapshot_entry.resolve().as_uri()
    webbrowser.open(dashboard_url)
    return dashboard_url
