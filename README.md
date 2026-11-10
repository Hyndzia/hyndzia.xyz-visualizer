# Hyndzia.xyz-Visualizer

A web application for **real-time audio visualization**, with a built-in player, IP radio support, and playlist management.  
Built with **Python (Flask + Gunicorn)** on the backend and **JavaScript/HTML/CSS** on the frontend.

<details>
  <summary>How it looks</summary>

  ![](https://hyndzia.net/visdemo.webp)

  ![](https://hyndzia.net/visdemo2.webp)

  ![](https://hyndzia.net/demo.png)
</details>

[Try online version here!](https://hyndzia.net/visualizer)

---

## Features

- **Audio Visualization** – responsive, dynamic visual effects generated from sound input.
- **Built-in Audio Player** – play local audio files or online streams directly in the app.
- **IP Radio Support** – connect to radio streams using URLs.
- **Playlists** – create and manage song queues.
- **Easy Setup** – quick deployment with Docker and helper scripts.
- **Production Ready** – works with Nginx/Apache as a reverse proxy.
- **Helper Scripts** – manage uploads and automate Docker builds.

---

## Tech Stack

- **Backend** – Python3
    - [Flask](https://flask.palletsprojects.com/en/stable/)
    - [Gunicorn WSGI server](https://docs.gunicorn.org/en/stable/)
- **Frontend** – JavaScript, HTML, CSS (custom visualizer modules)
  - [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) – used for real-time audio analysis & visualization  
  - [Plyr](https://plyr.io/) – modern customizable media player   
- **Containerization** – Docker  
- **Server Integration** – nginx, Apache2, or any reverse proxy with HTTPS
- **Helper Scripts** – `build/build_linux.sh`, `build/build_windows.ps1`, `utility/cleanup_uploads.sh`

---

## Requirements

- Python 3 (if running without Docker)  
- Docker (Linux/macOS) or Docker Desktop (Windows, recommended)
- HTTPS-enabled server (nginx/Apache) or reverse proxy  
- Open port for serving the app  

---

## Installation & Usage

### Run with Docker (recommended)

Requirements: Docker (Linux/macOS) or Docker Desktop with the Linux container engine (Windows).

**Linux / macOS**

```bash
# Make script executable
chmod +x build/build_linux.sh

# Build and run
./build/build_linux.sh
```

**Windows**

```powershell
# Build and run (PowerShell)
powershell -NoProfile -ExecutionPolicy Bypass -File .\build\build_windows.ps1

# Or from cmd.exe / double-click
build\build_windows.bat
```

The app will be available at <http://127.0.0.1:8989>.

**Tip:** To change the default port, use the `-HostPort` parameter of
`build\build_windows.ps1` or update the port in `build\build_linux.sh`.
**Tip:** When a reverse proxy serves the app under a subpath (e.g. `/visualizer`),
set `URL_PREFIX = '/visualizer'` in `.env` (or pass `-e URL_PREFIX=/visualizer` to
`docker run`).

### Windows desktop application (Electron)

The Electron app starts the backend hidden, waits for the local
server and shows the visualizer in a normal desktop window.

```powershell
# PyInstaller is only needed for building, not for running the app
.\venv\Scripts\python.exe -m pip install pyinstaller
powershell -NoProfile -ExecutionPolicy Bypass -File .\build\build_desktop.ps1
```

`build\build_desktop.ps1` builds the Python backend into `desktop\backend`, bundles it
into the Electron app and writes only one deliverable:

```text
dist\VisualizerDesktop.exe
```

The target machine does not need Python, Docker or Node.js. Application data
(uploads, `backend.log`) is stored in `%APPDATA%\visualizer-desktop`.

Use `-SkipBackend` when only the Electron window changed and the backend does
not need rebuilding.

### Run manually (without Docker)
**Optional:** Create and activate venv
```
#Initialize
python -m venv venv
```
* Linux / macOS
```bash
#Activate
source venv/bin/activate
```
* Windows (Powershell)
```powershell
.\venv\Scripts\Activate.ps1
```
* Windows (cmd.exe)
```terminal
venv\Scripts\activate.bat
```
## Configure environment variables:
  1. Copy the template `.env.example` to `.env`:
     
    cp .env.example .env # Linux / macOS
    copy .env.example .env # Windows

  3. Open `.env` and **replace placeholders** with your own key:
     
     ```bash
     SECRET_KEY = 'your secret key'
     ```
     
     If the app is served from the site root (the default for local runs),
     leave `URL_PREFIX` empty. When a reverse proxy mounts the app under a
     subpath (for example `https://example.com/visualizer`), set:
     
     ```bash
     URL_PREFIX = '/visualizer'
     ```
     
     All generated links (static files, uploaded audio and API requests)
     then keep that prefix.

Install dependencies:
```
pip install -r requirements.txt
```

Run locally:
```
python app.py
```

The app is then available at <http://127.0.0.1:8989>. In this mode Flask
serves the CSS/JS from `static/` and the uploaded files from `uploads/`
at the site root, so no reverse proxy is needed.

For a production-style server, start gunicorn:
```
#with optional venv
venv/bin/gunicorn -c utility/gunicorn_config.py app:app

#without optional venv (not recommended)
gunicorn -c utility/gunicorn_config.py app:app
```
Configure HTTPS or reverse proxy (nginx/Apache) for production. If the app
is proxied under a subpath, remember to set `URL_PREFIX` as described above.

## Project Structure
```
/
├── app.py                   # Main Flask app
├── build/                   # Build and deployment scripts
│   ├── Dockerfile           # Container instructions
│   ├── build_linux.sh       # Build & run script for Linux/macOS (Docker)
│   ├── build_windows.ps1    # Build & run script for Windows (Docker Desktop)
│   ├── build_windows.bat    # Windows launcher for build_windows.ps1
│   ├── build_desktop.ps1    # Builds dist\VisualizerDesktop.exe (backend + Electron)
│   └── visualizer_launcher.py  # Backend entry point used by the desktop build
├── desktop/                 # Electron desktop wrapper
│   ├── main.js              # Starts the backend and opens the window
│   └── loading.html         # Startup screen
├── requirements.txt         # Python dependencies
├── static/                  # Frontend assets (JS, CSS, images)
|   ├── style.css            # Main stylesheet
│   └── scripts/             # JavaScript modules
│       ├── audio-player.js
│       ├── rain.js
│       ├── signal_analyzer.js
│       ├── updatePlaylist.js
│       └── uploadForm.js
├── templates/               # HTML templates (Flask)
│   └── index.html
└── utility/                 # Helper scripts and server config
    ├── cleanup_uploads.sh
    └── gunicorn_config.py
```

## Helper Scripts
* `build/build_linux.sh` / `build/build_windows.ps1` – build and run the Docker container for easy deployment.
* `build/build_windows.bat` – convenience launcher for `build_windows.ps1` (also useful when PowerShell script execution is disabled).
* `build/build_desktop.ps1` – builds the Python backend and the Electron desktop application `dist\VisualizerDesktop.exe`.
* `utility/cleanup_uploads.sh` – removes temporary or unused uploaded files.
  
**Tip:** Add `utility/cleanup_uploads.sh` as a job to crontab for automatization.
  
## Roadmap
 * Customizable visualizer themes (colors, shapes, animations)
 * Support for more audio formats and streaming protocols (M3U, HLS, etc.)
 * User authentication and personal playlists
 * Mobile-friendly / responsive UI improvements
 * More playlist abilities (shuffle, change position of tracks, loop)
 * YT-DLP support ✓ [find another alternative in the near future]

## Contributing
### Contributions are welcome! You can help by:
* Opening issues with bug reports or feature requests.

* Submitting pull requests with:
   * New features (visualizer effects, playlist tools, etc.)
   * Performance improvements (frontend/backend)
   * Documentation, tests, translations
   * Improving deployment scripts or Docker support.
     
## Contact
Have questions, ideas, or feedback?
Open an issue or reach out directly!
