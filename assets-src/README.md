# Originais

Arquivos que **não** vão para o site publicado: ficam aqui só para regenerar o
que está em `public/imagens/`.

- `pedrosatin-original.webp` / `pedrosatin-linkedin.png` — foto oficial do perfil do LinkedIn.

Para refazer o retrato da primeira dobra:

```bash
# 1. Desktop
magick assets-src/pedrosatin-linkedin.png \
  -quality 88 -strip \
  public/imagens/retrato.webp

# 2. Mobile (quadrado fechado no rosto)
magick assets-src/pedrosatin-linkedin.png \
  -gravity north -crop 360x360+0+0 +repage -resize 300x300 -quality 88 -strip \
  public/imagens/retrato-quadrado.webp
```

Para refazer a imagem de compartilhamento, veja `scripts/share-image.sh`.
