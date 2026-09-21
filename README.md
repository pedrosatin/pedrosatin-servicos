# servicos.pedrosatin.com

A lead-generation landing page with a real site audit built in. React,
TypeScript, and Vite handle the browser side; a Cloudflare Worker covers
whatever same-origin policy stops the browser from reading directly.

```bash
npm install
cp .env.example .env   # fill in VITE_PSI_KEY

npm run worker:dev     # audit backend at http://localhost:8787
npm run dev            # site at http://localhost:5173
```

Stick to port **5173**. The PageSpeed key is restricted by referrer, and the
Worker rejects any origin not listed in `ALLOWED_ORIGINS`.

## Structure

```
src/site/      the landing page
src/lib/       audit engine, FAQ and service copy, structured data
src/fontes/    Inter and JetBrains Mono, served from this domain
src/entry-server.tsx   static rendering used at build time
scripts/       prerendering, share image, and iOS icon generation
worker/        reads third-party HTML, robots.txt, and sitemaps
public/        favicon, robots.txt, sitemap.xml, _headers, images
assets-src/    originals that don't ship to the published site
```

Requires **Node 24 or newer**. It's the active LTS (Krypton), the version
pinned in `.nvmrc`, and the one deployment uses. On it, the Worker's local
dev server runs TypeScript directly, with no compile step and no
experimental flag.

Node 26 is Current, not LTS, and won't hit LTS until October 2026. A page
selling stability shouldn't run on a line that's still taking behavior
changes; the switch in October is a one-line edit to `.nvmrc`.

Design decisions and measurements live in `LANDING_FINAL.md`; project
requirements are in `CONTEXT.md`.

## The HTML ships pre-rendered

A lead page that talks about indexing can't hand a crawler
`<div id="root"></div>`. `build` runs twice: a client compile and a server
one that renders the same component to text and injects the result into
`index.html` (`scripts/prerender.mjs`). In the browser, React just hydrates
what's already on the page.

The check is the word count the script prints at the end of the build,
currently around 3,000 words. If that drops back to single digits,
something broke.

## No third-party requests

The page loads nothing from a server the visitor didn't choose. Fonts ship
from `src/fontes/`, with license and update instructions in
`src/fontes/LICENCA.md`; there's no analytics, no tag manager, no external
widget. The CSP in `public/_headers` enforces this in practice.
`style-src` and `font-src` are scoped to `'self'`, and `connect-src` lists,
one by one, the data sources the audit queries. Adding a third-party script
without touching that file simply won't work, which is the intended
behavior.

## One source of text for screen and search engine

The FAQ (`src/lib/faq.ts`) and the service descriptions
(`src/lib/services.ts`) live as plain text in a single module. The
component renders that text, and `src/lib/structuredData.ts` builds the
JSON-LD from it (`FAQPage`, `OfferCatalog`, `Person`, `WebSite`,
`WebPage`). Google requires the declared answer to match what's on screen,
and with one copy of the text there's no way for them to drift apart.

The FAQ uses `<details>`, not React state: the answer stays in the HTML
always, not only once expanded. Before this, the answers, arguably the most
searchable part of the page, didn't exist for crawlers at all.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` | typecheck, client build, server build, and prerendering |
| `npm run preview` | serves `dist/` as in production |
| `npm run lint` | oxlint |
| `npm run typecheck` | typechecks the site and the Worker |
| `npm run worker:dev` | local Worker without wrangler, on port 8787 |
| `npm run worker:deploy` | deploys the Worker |
| `npm test` | runs the test suite (vitest) |
| `scripts/share-image.sh` | regenerates the share image (ImageMagick) |
| `scripts/apple-touch-icon.sh` | regenerates the iOS home screen icon |

## Deploying

1. **Worker first.** Set `ALLOWED_ORIGINS` in `worker/wrangler.toml` to the
   final origins and run `npm run worker:deploy`. Note the generated URL.
2. **PageSpeed key.** In the Google console, restrict the referrer to only
   `servicos.pedrosatin.com/*` and the `localhost:5173` used for
   development.
3. **Site variables.** In Cloudflare Pages, set `VITE_AUDIT_ENDPOINT` to the
   Worker URL and `VITE_PSI_KEY` to the key. Both end up in the browser
   bundle, which is fine because the key is referrer-restricted.
4. **Build and publish.** Command `npm run build`, output directory `dist`.
5. **Headers.** `public/_headers` ships with the build and sets HSTS, CSP,
   and cache rules. When the Worker moves to its own domain, swap
   `https://*.workers.dev` for the final address in the `connect-src`
   directive.
6. **After deploying**, run the audit tool against
   `servicos.pedrosatin.com` itself. That's the test that matters, since the
   tool and the site hosting it get judged by the same standard.

## License

MIT. See [LICENSE](./LICENSE).
