#!/usr/bin/env bash
# Gera o ícone que o iOS usa quando a página é salva na tela inicial.
#
# O iOS não aceita SVG nesse lugar e não respeita transparência: sem um PNG com
# fundo, o ícone sai sobre um quadrado branco. O símbolo tem proporção 48x46, e
# por isso é centralizado em um quadrado antes de crescer.
set -euo pipefail
cd "$(dirname "$0")/.."

rsvg-convert -w 400 -h 383 public/favicon.svg -o /tmp/marca.png
magick /tmp/marca.png \
  -background '#0f172a' -gravity center -extent 520x520 \
  -resize 180x180 \
  public/apple-touch-icon.png
rm -f /tmp/marca.png

magick identify public/apple-touch-icon.png
