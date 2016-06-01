#! /usr/bin/env bash
ICON=${ICON:-ribbon.png}

for px in 16 19 38 48 128; do
  size=${px}x${px}
  convert -background none -resize "$size" -extent "$size" -gravity center \
    "$ICON" "icon/$px.png"
done
