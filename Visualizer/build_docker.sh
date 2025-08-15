#!/bin/bash

# Build the Docker image
sudo docker build -t visualizer .

# Run the Docker container mapping port 5000
sudo docker run -p 8989:8989 -v /home/hyndzia/Visualizer/uploads:/uploads visualizer


