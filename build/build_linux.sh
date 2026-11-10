#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

CONTAINER_NAME="visualizer"
IMAGE_NAME="visual"
PORT="8989:8989"
COOKIE_FILE_PATH="${PROJECT_ROOT}/cookies.txt" 
DOCKERFILE="${SCRIPT_DIR}/Dockerfile"

echo "Building Docker image '${IMAGE_NAME}'..."
sudo docker build -f "${DOCKERFILE}" -t ${IMAGE_NAME} "${PROJECT_ROOT}"

if [ "$(sudo docker ps -aq -f name=^${CONTAINER_NAME}$)" ]; then
    echo "Container '${CONTAINER_NAME}' exists. Removing..."
    sudo docker rm -f ${CONTAINER_NAME}
fi

echo "Running container '${CONTAINER_NAME}'..."
sudo docker run -d \
  -p ${PORT} \
  --name ${CONTAINER_NAME} \
  -v "${COOKIE_FILE_PATH}:/app/cookies.txt" \
  -e COOKIE_FILE=/app/cookies.txt \
  ${IMAGE_NAME}
