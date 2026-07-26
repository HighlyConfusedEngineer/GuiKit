"""Standard-library asset server and optional pywebview launcher for GuiKit."""

from __future__ import annotations

import json
import logging
import platform
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from importlib.resources import as_file, files
from pathlib import Path
from typing import Any


LOGGER = logging.getLogger("guikit.webview")
_LEVELS = {"trace": logging.DEBUG, "debug": logging.DEBUG, "info": logging.INFO,
           "warn": logging.WARNING, "error": logging.ERROR, "fatal": logging.CRITICAL}


class GuiKitApi:
    """Bridge implementation suitable for ``window.pywebview.api.invoke``."""

    def invoke(self, method: str, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        if method == "app.info":
            return {"host": "Python / GuiKit", "platform": platform.platform()}
        if method == "app.echo":
            return params
        if method == "logging.write":
            return self.write_logs(params)
        raise ValueError(f"Unknown host method: {method}")

    @staticmethod
    def write_logs(params: dict[str, Any]) -> dict[str, int]:
        accepted = 0
        for record in params.get("records", [])[:1000]:
            if not isinstance(record, dict) or record.get("schema") != "guikit.log/v1":
                continue
            LOGGER.log(_LEVELS.get(str(record.get("level")), logging.INFO),
                       "%s | %s", record.get("logger", "frontend"),
                       json.dumps(record, ensure_ascii=False, default=str))
            accepted += 1
        return {"accepted": accepted}


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        pass


class GuiKitServer:
    """Serves the wheel's bundled static assets on loopback only."""

    def __init__(self) -> None:
        self._resource = files("guikit_webview").joinpath("assets")
        self._context = None
        self._server: ThreadingHTTPServer | None = None

    def start(self) -> str:
        if self._server:
            host, port = self._server.server_address[:2]
            return f"http://{host}:{port}"
        self._context = as_file(self._resource)
        root = self._context.__enter__()
        if not (Path(root) / "index.html").exists():
            raise RuntimeError("GuiKit assets are missing; install a packaged wheel, not the source helper.")
        handler = lambda *args, **kwargs: _QuietHandler(*args, directory=str(root), **kwargs)
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=self._server.serve_forever, daemon=True).start()
        host, port = self._server.server_address[:2]
        return f"http://{host}:{port}"

    def stop(self) -> None:
        self._server and self._server.shutdown()
        self._server = None
        if self._context:
            self._context.__exit__(None, None, None)
            self._context = None

    def __enter__(self) -> "GuiKitServer":
        self.start()
        return self

    def __exit__(self, *_args: object) -> None:
        self.stop()


class GuiKitWindow:
    """Optional convenience launcher; pywebview is imported only at runtime."""

    def __init__(self, title: str = "GuiKit", api: GuiKitApi | None = None,
                 min_size: tuple[int, int] = (720, 520)) -> None:
        self.title, self.api, self.min_size = title, api or GuiKitApi(), min_size

    def run(self) -> None:
        try:
            import webview
        except ImportError as error:
            raise RuntimeError("Install the native extra: pip install guikit-webview[native]") from error
        with GuiKitServer() as server:
            webview.create_window(self.title, server.start(), js_api=self.api, min_size=self.min_size)
            webview.start()
