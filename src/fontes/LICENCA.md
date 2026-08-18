# Fontes

Arquivos servidos pelo próprio domínio, em vez de carregados do Google Fonts.

| Arquivo | Família | Versão | Recorte |
|---|---|---|---|
| `inter-latin.woff2` | Inter (variável, 400–700) | v20 | latin |
| `jetbrains-mono-latin.woff2` | JetBrains Mono (variável, 400–500) | v24 | latin |

Ambas sob **SIL Open Font License 1.1**, que permite uso, redistribuição e
hospedagem própria. Nenhuma das duas foi modificada.

- Inter: <https://github.com/rsms/inter>
- JetBrains Mono: <https://github.com/JetBrains/JetBrainsMono>

O recorte `latin` cobre o português inteiro. Os recortes `latin-ext`,
`cyrillic` e `greek` foram deixados de fora porque a página é só em português:
o de Inter sozinho pesa 85 KB, mais que o `latin` que a página usa de fato.

## Como atualizar

Pegue a URL do arquivo `.woff2` na folha que o Google serve e baixe-a. O
`User-Agent` importa: sem um de navegador moderno o Google devolve `.ttf`.

```bash
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'
curl -sA "$UA" 'https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap' \
  | awk '/\/\* latin \*\//{f=1} f&&/src: url/{print;exit}'
```

Se a versão do arquivo mudar, confira também o `unicode-range` em `fontes.css`.
