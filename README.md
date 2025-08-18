# Hyndzia.xyz-Visualizer

A web application for **real-time audio visualization**, with a built-in player, IP radio support, and playlist management.  
Built with **Python (Flask)** on the backend and **JavaScript/HTML/CSS** on the frontend.

<summary>How it looks</summary>

![](https://hyndzia.xyz/visdemo.webp)

![](https://hyndzia.xyz/demo.png)


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

- **Backend** – Python + Flask  
- **Frontend** – JavaScript, HTML, CSS (custom visualizer modules)
  - [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) – used for real-time audio analysis & visualization  
  - [Plyr](https://plyr.io/) – modern customizable media player   
- **Containerization** – Docker  
- **Server Integration** – nginx, Apache, or any reverse proxy with HTTPS  
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
```
#Activate
source venv/bin/activate
```
* Windows (Powershell)
```
.\venv\Scripts\Activate.ps1
```
* Windows (cmd.exe)
```
venv\Scripts\activate.bat
```

Install dependencies:
```
pip install -r requirements.txt
```
Start the Flask app:
```
python app.py
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
├── static/                  # Frontend assets (JS, CSS, images)
└── templates/               # HTML templates (Flask)
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
 * YT-DLP support

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
