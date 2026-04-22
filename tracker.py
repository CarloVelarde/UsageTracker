from __future__ import annotations

import ctypes
import json
import sys
import time
from ctypes import wintypes
from datetime import datetime
from pathlib import Path
from threading import Lock

from dashboard import publish_dashboard
from runtime_paths import DATA_DIR

POLL_INTERVAL_SECONDS = 2.0
IDLE_THRESHOLD_SECONDS = 60.0
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
CTRL_C_EVENT = 0
CTRL_BREAK_EVENT = 1
CTRL_CLOSE_EVENT = 2
CTRL_LOGOFF_EVENT = 5
CTRL_SHUTDOWN_EVENT = 6

ConsoleCtrlHandler = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.DWORD)

class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.UINT),
        ("dwTime", wintypes.DWORD),
    ]


user32 = ctypes.WinDLL("user32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

user32.GetForegroundWindow.restype = wintypes.HWND
user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
user32.GetWindowTextLengthW.restype = ctypes.c_int
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetWindowTextW.restype = ctypes.c_int
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
user32.GetWindowThreadProcessId.restype = wintypes.DWORD
user32.GetLastInputInfo.argtypes = [ctypes.POINTER(LASTINPUTINFO)]
user32.GetLastInputInfo.restype = wintypes.BOOL

kernel32.GetTickCount64.restype = ctypes.c_ulonglong
kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
kernel32.OpenProcess.restype = wintypes.HANDLE
kernel32.QueryFullProcessImageNameW.argtypes = [
    wintypes.HANDLE,
    wintypes.DWORD,
    wintypes.LPWSTR,
    ctypes.POINTER(wintypes.DWORD),
]
kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
kernel32.CloseHandle.restype = wintypes.BOOL
kernel32.SetConsoleCtrlHandler.argtypes = [ConsoleCtrlHandler, wintypes.BOOL]
kernel32.SetConsoleCtrlHandler.restype = wintypes.BOOL


class UsageTracker:
    def __init__(
        self,
        poll_interval_seconds: float = POLL_INTERVAL_SECONDS,
        idle_threshold_seconds: float = IDLE_THRESHOLD_SECONDS,
    ) -> None:
        self.poll_interval_seconds = poll_interval_seconds
        self.idle_threshold_seconds = idle_threshold_seconds
        self.run_started_at = datetime.now()
        self.current_session: dict | None = None
        self.sessions: list[dict] = []
        self._did_shutdown = False
        self._shutdown_lock = Lock()
        self._console_handler: ConsoleCtrlHandler | None = None
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    def run(self) -> None:
        self.register_console_handler()
        print("Tracking started.")
        print("Keep this window open while tracking.")
        print("Press Ctrl+C to stop and open today's dashboard.")
        print(
            f"Polling every {self.poll_interval_seconds:.0f}s. "
            f"Idle after {self.idle_threshold_seconds:.0f}s without input."
        )

        try:
            while True:
                self.poll_once()
                time.sleep(self.poll_interval_seconds)
        except KeyboardInterrupt:
            print("\nStopping tracker...")
        finally:
            self.unregister_console_handler()
            self.shutdown()

    def register_console_handler(self) -> None:
        if sys.platform != "win32":
            return

        handler = ConsoleCtrlHandler(self.handle_console_event)
        if kernel32.SetConsoleCtrlHandler(handler, True):
            self._console_handler = handler

    def unregister_console_handler(self) -> None:
        if self._console_handler is None:
            return

        kernel32.SetConsoleCtrlHandler(self._console_handler, False)
        self._console_handler = None

    def handle_console_event(self, event_code: int) -> bool:
        if event_code in (CTRL_C_EVENT, CTRL_BREAK_EVENT):
            return False

        if event_code in (CTRL_CLOSE_EVENT, CTRL_LOGOFF_EVENT, CTRL_SHUTDOWN_EVENT):
            self.shutdown()

        return False

    def poll_once(self) -> None:
        now = datetime.now()
        session_type, app_name, window_title = self.capture_state()

        if self.current_session is None:
            self.start_session(session_type, app_name, window_title, now)
            return

        changed = (
            session_type != self.current_session["session_type"]
            or app_name != self.current_session["app_name"]
            or window_title != self.current_session["window_title"]
        )
        if not changed:
            return

        self.finish_current_session(now)
        self.start_session(session_type, app_name, window_title, now)

    def capture_state(self) -> tuple[str, str, str]:
        idle_seconds = get_idle_seconds()
        if idle_seconds >= self.idle_threshold_seconds:
            return "idle", "IDLE", ""

        app_name, window_title = get_foreground_app()
        return "active", app_name, window_title

    def start_session(
        self,
        session_type: str,
        app_name: str,
        window_title: str,
        started_at: datetime,
    ) -> None:
        self.current_session = {
            "session_type": session_type,
            "app_name": app_name,
            "window_title": window_title,
            "start_timestamp": started_at.isoformat(timespec="seconds"),
            "_started_at": started_at,
        }

    def finish_current_session(self, ended_at: datetime) -> None:
        if self.current_session is None:
            return

        started_at = self.current_session["_started_at"]
        duration_seconds = max((ended_at - started_at).total_seconds(), 0.0)
        if duration_seconds > 0:
            self.sessions.append(
                {
                    "session_type": self.current_session["session_type"],
                    "app_name": self.current_session["app_name"],
                    "window_title": self.current_session["window_title"],
                    "start_timestamp": self.current_session["start_timestamp"],
                    "end_timestamp": ended_at.isoformat(timespec="seconds"),
                    "duration_seconds": round(duration_seconds, 2),
                }
            )

        self.current_session = None

    def shutdown(self) -> None:
        with self._shutdown_lock:
            if self._did_shutdown:
                return

            self._did_shutdown = True
            run_ended_at = datetime.now()
            self.finish_current_session(run_ended_at)
            payload, output_path = self.save_sessions(run_ended_at)
            self.print_summary()
            print(f"Saved session data to: {output_path}")
            dashboard_url = publish_dashboard(payload, output_path)
            if dashboard_url is None:
                print(
                    "Dashboard build not found. Run `npm install` and "
                    "`npm run build` in `dashboard/` to enable the browser report."
                )
            else:
                print(f"Opened dashboard at: {dashboard_url}")

    def save_sessions(self, run_ended_at: datetime) -> tuple[dict, Path]:
        output_path = DATA_DIR / f"usage_{self.run_started_at.strftime('%Y%m%d_%H%M%S')}.json"
        payload = {
            "run_started_at": self.run_started_at.isoformat(timespec="seconds"),
            "run_ended_at": run_ended_at.isoformat(timespec="seconds"),
            "poll_interval_seconds": self.poll_interval_seconds,
            "idle_threshold_seconds": self.idle_threshold_seconds,
            "sessions": self.sessions,
        }
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return payload, output_path

    def print_summary(self) -> None:
        app_totals: dict[str, float] = {}
        idle_total = 0.0

        for session in self.sessions:
            if session["session_type"] == "idle":
                idle_total += session["duration_seconds"]
                continue

            app_name = session["app_name"]
            app_totals[app_name] = app_totals.get(app_name, 0.0) + session["duration_seconds"]

        sorted_apps = sorted(app_totals.items(), key=lambda item: item[1], reverse=True)
        app_name_width = max((len(name) for name, _ in sorted_apps), default=len("No app sessions"))

        print("Summary")
        print("-------")
        print("Total time per app:")
        if sorted_apps:
            for app_name, total_seconds in sorted_apps:
                print(f"  {app_name:<{app_name_width}}  {format_duration(total_seconds)}")
        else:
            print("  No app sessions recorded.")

        print(f"Total idle time: {format_duration(idle_total)}")

        if sorted_apps:
            print("Top 3 apps:")
            for index, (app_name, total_seconds) in enumerate(sorted_apps[:3], start=1):
                print(f"  {index}. {app_name} - {format_duration(total_seconds)}")


def get_idle_seconds() -> float:
    info = LASTINPUTINFO()
    info.cbSize = ctypes.sizeof(LASTINPUTINFO)

    if not user32.GetLastInputInfo(ctypes.byref(info)):
        raise ctypes.WinError(ctypes.get_last_error())

    return (kernel32.GetTickCount64() - info.dwTime) / 1000.0


def get_foreground_app() -> tuple[str, str]:
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return "Unknown", ""

    return get_process_name(hwnd), get_window_title(hwnd)


def get_window_title(hwnd: wintypes.HWND) -> str:
    title_length = user32.GetWindowTextLengthW(hwnd)
    if title_length <= 0:
        return ""

    buffer = ctypes.create_unicode_buffer(title_length + 1)
    user32.GetWindowTextW(hwnd, buffer, len(buffer))
    return buffer.value.strip()


def get_process_name(hwnd: wintypes.HWND) -> str:
    process_id = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(process_id))
    if not process_id.value:
        return "Unknown"

    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, process_id.value)
    if not handle:
        return "Unknown"

    try:
        buffer_length = wintypes.DWORD(1024)
        buffer = ctypes.create_unicode_buffer(buffer_length.value)
        success = kernel32.QueryFullProcessImageNameW(
            handle,
            0,
            buffer,
            ctypes.byref(buffer_length),
        )
        if not success:
            return "Unknown"

        return Path(buffer.value).name or "Unknown"
    finally:
        kernel32.CloseHandle(handle)


def format_duration(total_seconds: float) -> str:
    rounded_seconds = int(round(total_seconds))
    hours, remainder = divmod(rounded_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
