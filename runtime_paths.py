from __future__ import annotations

import os
import sys
from pathlib import Path

APP_NAME = "UsageTracker"


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def get_source_root() -> Path:
    return Path(__file__).resolve().parent


def get_bundle_root() -> Path:
    if is_frozen():
        bundle_root = getattr(sys, "_MEIPASS", None)
        if bundle_root:
            return Path(bundle_root)
        return Path(sys.executable).resolve().parent

    return get_source_root()


def get_app_root() -> Path:
    if is_frozen():
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            return Path(local_app_data) / APP_NAME

        return Path.home() / "AppData" / "Local" / APP_NAME

    return get_source_root()


BUNDLE_ROOT = get_bundle_root()
APP_ROOT = get_app_root()
DATA_DIR = APP_ROOT / "data"

DATA_DIR.mkdir(parents=True, exist_ok=True)
