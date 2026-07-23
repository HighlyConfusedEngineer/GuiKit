"""Minimal pywebview host for GuiKit.

Install the optional native host dependency:
    python -m pip install pywebview

Run from the repository root:
    python examples/python/app.py
"""

from __future__ import annotations

import os
import platform
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import webview


ROOT = Path(__file__).resolve().parents[2]


class HostApi:
    """Methods exposed to JavaScript as window.pywebview.api.*."""

    def invoke(self, method: str, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        handlers = {
            "app.info": self.app_info,
            "app.echo": lambda: params,
        }
        if method not in handlers:
            raise ValueError(f"Unknown host method: {method}")
        return handlers[method]()

    @staticmethod
    def app_info() -> dict[str, str]:
        return {
            "host": "Python / pywebview",
            "platform": platform.platform(),
            "process": str(os.getpid()),
        }


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        pass


def start_server() -> ThreadingHTTPServer:
    handler = lambda *args, **kwargs: QuietHandler(  # noqa: E731
        *args, directory=str(ROOT), **kwargs
    )
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


if __name__ == "__main__":
    static_server = start_server()
    port = static_server.server_address[1]
    webview.create_window(
        "GuiKit Python Host",
        f"http://127.0.0.1:{port}",
        js_api=HostApi(),
        min_size=(720, 520),
    )
    try:
        webview.start()
    finally:
        static_server.shutdown()
