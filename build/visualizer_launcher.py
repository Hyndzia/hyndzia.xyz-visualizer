"""Windows desktop launcher for the Visualizer.

When packaged with PyInstaller, this starts the Flask app on localhost, opens
the default browser and keeps uploaded files in %LOCALAPPDATA%\\HyndziaVisualizer.
Running it with ``python visualizer_launcher.py`` works the same way but keeps
the data in the project directory.
"""

import os
import secrets
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

PREFERRED_PORT = 8989
APP_NAME = "HyndziaVisualizer"


def get_base_dir():
    """Directory containing the executable (frozen) or this script (source)."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def get_data_dir():
    """Writable directory for uploads, cookies and the session secret."""
    override = os.environ.get("VISUALIZER_DATA_DIR")
    if override:
        return Path(override).expanduser()

    if getattr(sys, "frozen", False):
        root = os.environ.get("LOCALAPPDATA") or Path.home()
        return Path(root) / APP_NAME
    return get_base_dir()


def prepare_data_dir(data_dir):
    data_dir.mkdir(parents=True, exist_ok=True)

    secret_file = data_dir / "secret.key"
    if not secret_file.exists():
        secret_file.write_text(secrets.token_hex(32), encoding="utf-8")
    os.environ.setdefault("SECRET_KEY", secret_file.read_text(encoding="utf-8").strip())

    cookie_file = data_dir / "cookies.txt"
    if not cookie_file.exists():
        # A cookies.txt placed next to the exe is copied on the first run.
        bundled_cookie = get_base_dir() / "cookies.txt"
        if bundled_cookie.is_file():
            cookie_file.write_bytes(bundled_cookie.read_bytes())
        else:
            cookie_file.write_text("", encoding="utf-8")
    os.environ.setdefault("COOKIE_FILE", str(cookie_file))

    # app.py uses a relative "uploads" directory, so run from the data dir.
    os.chdir(data_dir)
    return secret_file, cookie_file


def get_requested_port():
    value = os.environ.get("VISUALIZER_PORT")
    if not value:
        return None
    try:
        port = int(value)
    except ValueError as exc:
        raise RuntimeError(f"Invalid VISUALIZER_PORT: {value!r}") from exc
    if not 1 <= port <= 65535:
        raise RuntimeError(f"VISUALIZER_PORT out of range: {port}")
    return port


def find_free_port(preferred):
    for port in (preferred, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return sock.getsockname()[1]
            except OSError:
                continue
    raise RuntimeError("Could not find a free TCP port.")


def open_browser_when_ready(url, port):
    for _ in range(100):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                break
        except OSError:
            time.sleep(0.1)
    webbrowser.open(url)


def main():
    data_dir = get_data_dir()
    secret_file, cookie_file = prepare_data_dir(data_dir)

    # Import after the environment/cwd is ready: app.py reads both at import time.
    from app import app

    port = get_requested_port() or find_free_port(PREFERRED_PORT)
    url = f"http://127.0.0.1:{port}/"

    print("=" * 62)
    print(" Hyndzia Visualizer")
    print("=" * 62)
    print(f" Local address : {url}")
    print(f" Data directory: {data_dir}")
    print(f" Cookies file  : {cookie_file}")
    print(" Close this window to stop the server.")
    print("=" * 62)

    if os.environ.get("VISUALIZER_NO_BROWSER") != "1":
        threading.Thread(
            target=open_browser_when_ready,
            args=(url, port),
            daemon=True,
        ).start()

    try:
        app.run(
            host="127.0.0.1",
            port=port,
            debug=False,
            use_reloader=False,
            threaded=True,
        )
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
