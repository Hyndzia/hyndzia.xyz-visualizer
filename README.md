# Hyndzia.xyz-Visualizer

A web application for **real-time audio visualization**, with a built-in player, IP radio support, and playlist management.  
Built with **Python (Flask + Gunicorn)** on the backend and **JavaScript/HTML/CSS** on the frontend.

<details>
  <summary>How it looks</summary>

  ![](https://hyndzia.xyz/visdemo.webp)

  ![](https://hyndzia.xyz/visdemo2.webp)

  ![](https://hyndzia.xyz/demo.png)
</details>

[Try online version here!](https://hyndzia.xyz/visualizer)

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
- **Helper Scripts** – `build_docker.sh`, `cleanup_uploads.sh`

---

## Requirements

- Python 3 (if running without Docker)  
- Docker (recommended)
- HTTPS-enabled server (nginx/Apache) or reverse proxy  
- Open port for serving the app  

---

## Installation & Usage

### Run with Docker (recommended)

```bash
# Make script executable
chmod +x build_docker.sh

# Build and run
./build_docker.sh

# App will be available at the configured port
```
**Tip:** To change the default port, update both the Dockerfile and build_docker.sh.

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
     
Install dependencies:
```
pip install -r requirements.txt
```

Start the gunicorn server:
```
#with optional venv
venv/bin/gunicorn -c gunicorn_config.py app:app

#without optional venv (not recommended)
gunicorn -c gunicorn_config.py app:app
```
Configure HTTPS or reverse proxy (nginx/Apache) for production.

## Project Structure
```
/
├── app.py                   # Main Flask app
├── build_docker.sh          # Build & run script for Docker
├── cleanup_uploads.sh       # Helper script to clear uploaded files
├── requirements.txt         # Python dependencies
├── Dockerfile               # Container instructions
├── gunicorn_config.py       # WSGI Server configs
├── static/                  # Frontend assets (JS, CSS, images)
|   ├── style.css            # Main stylesheet
│   └── scripts/             # JavaScript modules
│       ├── audio-player.js
│       ├── barEffectControl.js
│       ├── rain.js
│       ├── signal_analyzer.js
│       ├── updatePlaylist.js
│       └── uploadForm.js
└── templates/               # HTML templates (Flask)
    └── index.html
```

## Helper Scripts
* cleanup_uploads.sh – removes temporary or unused uploaded files.
* build_docker.sh – builds and runs the Docker container for easy deployment.
  
**Tip:** Add cleanup_uploads.sh as a job to crontab for automatization.
  
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
