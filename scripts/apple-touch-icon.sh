#!/usr/bin/env bash
# Gera o ícone que o iOS usa quando a página é salva na tela inicial.
#
# O iOS não aceita SVG nesse lugar e não respeita transparência: sem um PNG com
# fundo, o ícone sai sobre um quadrado branco.
set -euo pipefail
cd "$(dirname "$0")/.."

rsvg-convert -w 512 -h 512 public/favicon.svg -o /tmp/marca.png
magick /tmp/marca.png \
  -background '#0f172a' -gravity center \
  -resize 180x180 \
  public/apple-touch-icon.png
rm -f /tmp/marca.png

magick identify public/apple-touch-icon.png
