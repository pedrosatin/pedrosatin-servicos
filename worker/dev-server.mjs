/**
 * Servidor local para desenvolver sem o wrangler.
 *
 * O Node 24 já traz fetch, Request e Response globais, então o mesmo handler
 * que roda no Cloudflare pode ser executado aqui sem adaptação. Ele também
 * executa TypeScript direto, sem flag:
 *
 *   node worker/dev-server.mjs
 *
 * O handler recusa requisições sem origem autorizada, então no curl ela vai à
 * mão, como o navegador faria:
 *
 *   curl -H 'Origin: http://localhost:5173' \
 *     'http://localhost:8787/audit?url=silvasatin.adv.br'
 */

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import worker from './src/index.ts';

const PORT = Number(process.env.PORT ?? 8787);

/**
 * A lista de origens é lida do `wrangler.toml`, e não copiada para cá. Uma
 * segunda cópia acabaria divergindo, e o sintoma seria o pior possível: a
 * análise funcionando em desenvolvimento e recusada em produção.
 */
const wrangler = readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8');
const allowed = /^\s*ALLOWED_ORIGINS\s*=\s*"([^"]*)"/m.exec(wrangler)?.[1];

if (!allowed) {
  throw new Error('ALLOWED_ORIGINS não encontrado em worker/wrangler.toml.');
}

const env = { ALLOWED_ORIGINS: allowed };

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const request = new Request(url, {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value]],
    ),
  });

  try {
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(error) }));
  }
});

server.listen(PORT);
