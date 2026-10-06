import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeTarget } from './index';
import * as entry from './worker';

// Os testes simulam fetch no Node, que aceita opções que o runtime dos Workers
// recusa. Estas checagens cobrem as restrições do runtime que já quebraram produção.
describe('compatibilidade com o runtime dos Workers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a entrada exporta somente o handler padrão', () => {
    expect(Object.keys(entry)).toEqual(['default']);
  });

  it('as consultas DNS usam um modo de redirect aceito pelo runtime', async () => {
    const modes: RequestInit['redirect'][] = [];
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      modes.push(init?.redirect);
      return new Response(JSON.stringify({ Status: 0, Answer: [{ type: 1, data: '93.184.215.14' }] }));
    });
    await normalizeTarget('example.com');
    expect(modes.length).toBeGreaterThan(0);
    for (const mode of modes) expect(['follow', 'manual']).toContain(mode);
  });
});
