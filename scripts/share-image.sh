#!/usr/bin/env bash
# Gera public/imagens/compartilhamento.png, a imagem que aparece quando o
# endereço é colado no WhatsApp, no LinkedIn e afins. Requer ImageMagick.
#
# As cores são as mesmas de src/site/LandingPage.css.

set -euo pipefail

cd "$(dirname "$0")/.."

magick -size 1200x630 xc:'#0f172a' \
  -fill '#10b981' -draw 'rectangle 0,0 1200,6' \
  -font JetBrainsMono-NF-Regular -pointsize 26 -fill '#10b981' \
  -annotate +80+130 'servicos.pedrosatin.com' \
  -font Liberation-Sans-Bold -pointsize 62 -fill '#f1f5f9' \
  -annotate +80+245 'Digite o endereço do seu site.' \
  -font Liberation-Sans -pointsize 62 -fill '#97a6bb' \
  -annotate +80+325 'Eu mostro o que o Google' \
  -annotate +80+400 'encontra nele.' \
  -fill '#253044' -draw 'rectangle 80,470 1120,471' \
  -font JetBrainsMono-NF-Regular -pointsize 24 -fill '#64748b' \
  -annotate +80+528 'PageSpeed do Google · RDAP · DNS · HTML entregue ao robô' \
  -font Liberation-Sans-Bold -pointsize 26 -fill '#f1f5f9' \
  -annotate +80+575 'Pedro Satin' \
  -strip -colors 64 -define png:compression-level=9 \
  PNG8:public/imagens/compartilhamento.png

echo "gerado: public/imagens/compartilhamento.png ($(stat -c%s public/imagens/compartilhamento.png) bytes)"
