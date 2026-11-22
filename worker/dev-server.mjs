
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { setGlobalDispatcher } from 'undici';
import { createSafeAgent } from './dev-dispatcher.mjs';
import worker from './src/index.ts';

const verifyGlobalDispatcher = async () => {
  try {
    const response = await fetch('http://127.0.0.1:65535/');
    await response.body?.cancel();
  } catch (error) {
    if (error instanceof Error && error.cause?.code === 'ERR_BLOCKED_TARGET') return;
    console.error('Autoteste do dispatcher falhou antes de iniciar o servidor.', error);
    process.exit(1);
  }
  console.error('Autoteste do dispatcher falhou porque o fetch global alcançou 127.0.0.1.');
  process.exit(1);
};

setGlobalDispatcher(createSafeAgent());
await verifyGlobalDispatcher();

const PORT = Number(process.env.PORT ?? 8787);

const wrangler = readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8');
const devVars = /^\[env\.dev\.vars\]\s*$([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(wrangler)?.[1] ?? '';
const devVar = (name) => {
  const value = new RegExp(`^\\s*${name}\\s*=\\s*"([^"]*)"`, 'm').exec(devVars)?.[1];
  if (!value) throw new Error(`${name} não encontrado em [env.dev.vars] no worker/wrangler.toml.`);
  return value;
};

const env = {
  ALLOWED_HOSTS: devVar('ALLOWED_HOSTS'),
  ALLOWED_ORIGINS: devVar('ALLOWED_ORIGINS'),
  PSI_KEY: process.env.PSI_KEY,
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const request = new Request(url, {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value]],
    ),
  });

  request.headers.set('cf-connecting-ip', req.socket.remoteAddress ?? 'local');

  try {
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(error) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Auditoria disponível em http://localhost:${PORT}/audit?url=exemplo.com.br`);
});
