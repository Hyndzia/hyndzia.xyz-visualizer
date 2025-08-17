# Hyndzia.xyz-Visualizer web app

Web based app in **HTML/CSS + JS frontend** and **Python Flask backend**.  
It supports IP radio connection, file uploading, creating playlists, customizing the players, audio signal modulation and more to come!

[https://hyndzia.xyz/visualizer](https://hyndzia.xyz/visualizer)

## How to setup

**Requirements:**  
- Python3 (if you run without docker)
- Docker
- HTTPS Server (nginx/apache2/other)
- Open ports or reverse proxy server

**Steps:**  
1. Run the setup script:  
   ```bash
   #If the script is not accessible, give it execution permission first:
   sudo chmod +x build_docker.sh
   ./build_docker.sh

**NOTE: If you want to change ports you need to change them in Dockerfile and in build_docker.sh accordingly**

You can also configure cleanup_uploads.sh and add your own path.


![demo view](https://hyndzia.xyz/visualize.gif)
