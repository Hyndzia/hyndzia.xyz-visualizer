#!/bin/bash

# Build the Docker image
sudo docker build -t visualizer visualizer

# Run the Docker container mapping your specific port
sudo docker run -p 8989:8989 visualizer


