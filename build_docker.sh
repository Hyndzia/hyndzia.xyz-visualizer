#!/bin/bash

CONTAINER_NAME="visual_container"
IMAGE_NAME="visual"
PORT="8989:8989"

echo "Building Docker image '${IMAGE_NAME}'..."
sudo docker build -t ${IMAGE_NAME} .

if [ "$(sudo docker ps -aq -f name=^${CONTAINER_NAME}$)" ]; then
    echo "Container '${CONTAINER_NAME}' exists. Removing..."
    sudo docker rm -f ${CONTAINER_NAME}
fi

echo "Running container '${CONTAINER_NAME}'..."
sudo docker run -d -p ${PORT} --name ${CONTAINER_NAME} ${IMAGE_NAME}

