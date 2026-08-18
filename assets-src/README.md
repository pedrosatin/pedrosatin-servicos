# Originais

Arquivos que **não** vão para o site publicado: ficam aqui só para regenerar o
que está em `public/imagens/`.

- `pedrosatin-original.webp` — foto sem recorte, 1377x1376.

Para refazer o retrato da primeira dobra:

```bash
magick assets-src/pedrosatin-original.webp \
  -crop 680x850+310+330 +repage -resize 600x750 -quality 74 -strip \
  public/imagens/retrato.webp
```

Para refazer a imagem de compartilhamento, veja `scripts/share-image.sh`.
