#!/bin/bash

CONTAINER_NAME="gym-rep-counter-emulator"
IMAGE_NAME="gym-rep-counter-emulator-img"

case "$1" in
  start)
    echo "Starting Firebase Emulator in Docker..."
    docker build -t "$IMAGE_NAME" -f Dockerfile.emulator .
    
    # Check if a container with the name already exists, if so stop and remove it
    if [ "$(docker ps -aq -f name=^${CONTAINER_NAME}$)" ]; then
      echo "Removing existing container..."
      docker rm -f "$CONTAINER_NAME"
    fi
    
    docker run -d \
      --name "$CONTAINER_NAME" \
      -p 4000:4000 \
      -p 8080:8080 \
      -p 9099:9099 \
      -v "$(pwd):/app" \
      -v "gym-rep-counter-emulator-cache:/root/.cache" \
      "$IMAGE_NAME"
    
    echo "Firebase Emulator starting in container '$CONTAINER_NAME'."
    echo "UI: http://localhost:4000"
    echo "Firestore: http://localhost:8080"
    echo "Auth: http://localhost:9099"
    ;;
  stop)
    echo "Stopping Firebase Emulator container..."
    docker stop "$CONTAINER_NAME"
    docker rm "$CONTAINER_NAME"
    echo "Emulator stopped."
    ;;
  clear)
    echo "Clearing Firestore data..."
    curl -X DELETE "http://localhost:8080/emulator/v1/projects/gym-rep-counter/databases/default/documents"
    echo "Clearing Auth accounts..."
    curl -X DELETE "http://localhost:9099/emulator/v1/projects/gym-rep-counter/accounts"
    echo "Emulator databases cleared."
    ;;
  *)
    echo "Usage: $0 {start|stop|clear}"
    exit 1
    ;;
esac
