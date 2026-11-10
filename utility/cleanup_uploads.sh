#!/bin/bash

BASE_DIR="./uploads"

for DIR in "$BASE_DIR"/*/; do
    [ -d "$DIR" ] || continue

    recent_files=$(find "$DIR" -type f -mmin -30)

    if [ -z "$recent_files" ]; then
        rm -rf "$DIR"
        echo "$(date): Katalog $DIR został usunięty."
    else
        echo "$(date): Katalog $DIR zawiera nowe pliki, nie usuwamy go."
    fi
done
