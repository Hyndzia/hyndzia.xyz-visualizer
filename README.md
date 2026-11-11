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
- **Desktop Application** – standalone Windows application powered by Electron.
- **Multiple Desktop Packages** – build either a portable executable or a Windows NSIS installer.
- **Helper Scripts** – manage uploads and automate Docker and desktop builds.

---

## Tech Stack

- **Backend** – Python 3
  - [Flask](https://flask.palletsprojects.com/en/stable/)
  - [Gunicorn WSGI server](https://docs.gunicorn.org/en/stable/)
- **Frontend** – JavaScript, HTML, CSS (custom visualizer modules)
  - [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) – used for real-time audio analysis and visualization
  - [Plyr](https://plyr.io/) – modern customizable media player
- **Desktop Application** – Electron
  - [electron-builder](https://www.electron.build/) – Windows application packaging
  - [NSIS](https://nsis.sourceforge.io/) – Windows installer
  - [PyInstaller](https://pyinstaller.org/) – packages the Python backend into an executable
- **Containerization** – Docker
- **Server Integration** – nginx, Apache2, or any reverse proxy with HTTPS
- **Helper Scripts** – `build/build_linux.sh`, `build/build_windows.ps1`, `build/build_desktop.ps1`, `utility/cleanup_uploads.sh`

---

## Requirements

- Python 3 (if running without Docker)
- Docker (Linux/macOS) or Docker Desktop (Windows, recommended)
- HTTPS-enabled server (nginx/Apache) or reverse proxy
- Open port for serving the app

### Additional requirements for building the Windows desktop application

- Windows
- Node.js and npm
- Python virtual environment (`venv`)
- PyInstaller installed in the virtual environment
- Electron dependencies installed through npm

The generated desktop application does not require Python, Docker, Node.js or a separate Python installation on the target computer.

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

**Tip:** To change the default port, use the `-HostPort` parameter of `build/build_windows.ps1` or update the port in `build/build_linux.sh`.

**Tip:** When a reverse proxy serves the app under a subpath (e.g. `/visualizer`), set `URL_PREFIX = '/visualizer'` in `.env` (or pass `-e URL_PREFIX=/visualizer` to `docker run`).

---

### Windows Desktop Application (Electron)

The Windows desktop application uses Electron to run the Visualizer backend locally.

The Electron application automatically:

- Starts the Python-based backend in the background.
- Waits until the local server is ready.
- Opens the visualizer in a native desktop window.
- Stores application data and backend logs in `%APPDATA%\visualizer-desktop`.

The backend is packaged into `desktop\backend\Visualizer.exe` using PyInstaller and included in the Electron application.

#### Preparing the build environment

Create a Python virtual environment if you do not already have one:

```powershell
python -m venv venv
```

Install requirements:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

The desktop build script automatically installs Electron dependencies using `npm ci` when `desktop\node_modules\electron` is not present.

#### Building the desktop application

Run the build script from the project root.

**Build an NSIS installer**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build\build_desktop.ps1 -Package NSIS
```

Generates a standard Windows installation wizard with:

- Installation directory selection.
- Desktop shortcut.
- Start Menu shortcut.
- Uninstaller.
- Option to launch Visualizer after installation.

Output:

```text
dist\VisualizerDesktop-Setup.exe
```

**Build a portable application**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build\build_desktop.ps1 -Package Portable
```

Generates a portable Windows executable that does not require a traditional installation.

Output:

```text
dist\VisualizerDesktop-Portable.exe
```

**Build both packages**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build\build_desktop.ps1 -Package All
```

Builds both NSIS and Portable versions in one run.

Output:

```text
dist\
├── VisualizerDesktop-Setup.exe
└── VisualizerDesktop-Portable.exe
```

#### Skipping the backend build

When only the Electron application has changed and the Python backend does not need rebuilding, use `-SkipBackend`.

For example:

```powershell
# Build NSIS without rebuilding the backend
.\build\build_desktop.ps1 -Package NSIS -SkipBackend

# Build Portable without rebuilding the backend
.\build\build_desktop.ps1 -Package Portable -SkipBackend

# Build both packages without rebuilding the backend
.\build\build_desktop.ps1 -Package All -SkipBackend
```

The existing `desktop\backend\Visualizer.exe` must be present when using `-SkipBackend`.

#### Build parameters

| Parameter | Description |
|---|---|
| `-Package NSIS` | Build the Windows NSIS installer |
| `-Package Portable` | Build the portable executable |
| `-Package All` | Build both packages |
| `-SkipBackend` | Skip PyInstaller backend compilation |

If `-Package` is omitted, the script defaults to `Portable`.

#### Build process

The `build/build_desktop.ps1` script performs the following steps:

1. Checks the Electron project and build requirements.
2. Builds the Python backend using PyInstaller (unless `-SkipBackend` is specified).
3. Places the backend executable in `desktop\backend\Visualizer.exe`.
4. Installs Electron dependencies when necessary.
5. Runs the selected electron-builder package script.
6. Copies the generated executable or executables to the root `dist` directory.

The Electron build configuration is located in `desktop/package.json`.

The desktop project supports the following npm build commands:

```powershell
npm run dist:nsis
npm run dist:portable
npm run dist:all
```

The target Windows computer does not need Python, Docker or Node.js.

Application data, including uploads and `backend.log`, is stored in:

```text
%APPDATA%\visualizer-desktop
```

---

### Run manually (without Docker)

**Optional:** Create and activate a virtual environment.

```bash
# Initialize
python -m venv venv
```

**Linux / macOS**

```bash
# Activate
source venv/bin/activate
```

**Windows (PowerShell)**

```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (cmd.exe)**

```cmd
venv\Scripts\activate.bat
```

#### Configure environment variables

1. Copy the template `.env.example` to `.env`:

```bash
# Linux / macOS
cp .env.example .env

# Windows
copy .env.example .env
```

2. Open `.env` and replace the placeholders with your own key:

```bash
SECRET_KEY = 'your secret key'
```

If the app is served from the site root (the default for local runs), leave `URL_PREFIX` empty.

When a reverse proxy mounts the app under a subpath (for example `https://example.com/visualizer`), set:

```bash
URL_PREFIX = '/visualizer'
```

All generated links (static files, uploaded audio and API requests) will then keep that prefix.

#### Install dependencies

```bash
pip install -r requirements.txt
```

#### Run locally

```bash
python app.py
```

The app is then available at <http://127.0.0.1:8989>.

In this mode Flask serves the CSS/JS from `static/` and the uploaded files from `uploads/` at the site root, so no reverse proxy is needed.

For a production-style server, start Gunicorn:

```bash
# With optional venv
venv/bin/gunicorn -c utility/gunicorn_config.py app:app

# Without optional venv (not recommended)
gunicorn -c utility/gunicorn_config.py app:app
```

Configure HTTPS or a reverse proxy (nginx/Apache) for production. If the app is proxied under a subpath, remember to set `URL_PREFIX` as described above.

---

## Project Structure

```text
/
├── app.py
├── build/
│   ├── Dockerfile
│   ├── build_linux.sh
│   ├── build_windows.ps1
│   ├── build_windows.bat
│   ├── build_desktop.ps1
│   └── visualizer_launcher.py
├── desktop/
│   ├── main.js
│   ├── loading.html
│   ├── package.json
│   ├── package-lock.json
│   ├── icon.ico
│   └── backend/
│       └── Visualizer.exe       # Generated by the desktop build
├── requirements.txt
├── static/
│   ├── style.css
│   └── scripts/
│       ├── audio-player.js
│       ├── rain.js
│       ├── signal_analyzer.js
│       ├── updatePlaylist.js
│       └── uploadForm.js
├── templates/
│   └── index.html
├── utility/
│   ├── cleanup_uploads.sh
│   └── gunicorn_config.py
└── dist/
    ├── VisualizerDesktop-Setup.exe
    └── VisualizerDesktop-Portable.exe
```

The desktop backend executable and the `dist` packages are generated during the build process.

---

## Helper Scripts

- `build/build_linux.sh` – build and run the Docker container on Linux/macOS.
- `build/build_windows.ps1` – build and run the Docker container on Windows using Docker Desktop.
- `build/build_windows.bat` – convenience launcher for `build_windows.ps1`.
- `build/build_desktop.ps1` – build the Windows Electron desktop application, including the Python backend. Supports NSIS, Portable and All package modes.
- `build/visualizer_launcher.py` – Python backend entry point used by the desktop build.
- `utility/cleanup_uploads.sh` – removes temporary or unused uploaded files.

**Tip:** Add `utility/cleanup_uploads.sh` as a job to crontab for automation.

---

## Roadmap

- Customizable visualizer themes (colors, shapes, animations)
- Support for more audio formats and streaming protocols (M3U, HLS, etc.)
- User authentication and personal playlists
- Mobile-friendly / responsive UI improvements
- More playlist abilities (shuffle, change position of tracks, loop)
- YT-DLP support ✓ [find another alternative in the near future]

---

## Contributing

### Contributions are welcome! You can help by:

- Opening issues with bug reports or feature requests.
- Submitting pull requests with:
  - New features (visualizer effects, playlist tools, etc.)
  - Performance improvements
  - Documentation, tests, translations
  - Improving deployment scripts or Docker support.

---

## Contact

Have questions, ideas, or feedback?
Open an issue or reach out directly!
