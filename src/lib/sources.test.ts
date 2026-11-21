import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchDns,
  fetchRegistration,
  fetchEmailAuth,
  fetchPageSpeed,
  fetchContent,
  defaultSourcesDeps,
} from './sources';
import type { SourcesDeps } from './sources';
import type { DnsReport } from './types';
import { AUDIT_ENDPOINT } from './config';

const dnsVazio = (domain: string): DnsReport => ({
  domain,
  resolves: true,
  a: [],
  aaaa: [],
  ns: [],
  mx: [],
  txt: [],
  cname: [],
  hosting: null,
  dnsProvider: null,
});

const respostaJson = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const respostaHttp = (status: number): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
  }) as Response;

describe('sources', () => {
  const depsDeTeste = (
    fakeFetch: typeof fetch,
    overrides: Partial<Omit<SourcesDeps, 'fetch'>> = {},
  ): SourcesDeps => ({
    fetch: fakeFetch,
    auditEndpoint: 'https://worker.test',
    dohEndpoint: 'https://doh.test/resolve',
    ...overrides,
  });

  describe('fetchDns', () => {
    it('usa dohEndpoint e fetch injetados e monta o relatório', async () => {
      const urls: string[] = [];
      const fakeFetch: typeof fetch = async (input, init) => {
        const url = String(input);
        urls.push(url);
        expect(init?.headers).toEqual({ accept: 'application/dns-json' });

        const type = new URL(url).searchParams.get('type');
        const answersByType: Record<string, { type: number; data: string }[]> = {
          A: [{ type: 1, data: '93.184.216.34' }],
          AAAA: [],
          NS: [{ type: 2, data: 'ns1.cloudflare.com.' }],
          MX: [{ type: 15, data: '10 mail.example.com.' }],
          TXT: [{ type: 16, data: '"v=spf1 -all"' }],
          CNAME: [{ type: 5, data: 'example.com.' }],
        };
        const answers = (answersByType[type ?? ''] ?? []).map((answer) => ({
          name: 'example.com',
          TTL: 300,
          ...answer,
        }));

        return respostaJson({ Status: 0, Answer: answers });
      };

      const result = await fetchDns('example.com', depsDeTeste(fakeFetch));

      expect(urls).toHaveLength(6);
      expect(urls.every((url) => url.startsWith('https://doh.test/resolve?'))).toBe(true);
      expect(result).toMatchObject({
        domain: 'example.com',
        resolves: true,
        a: ['93.184.216.34'],
        aaaa: [],
        ns: ['ns1.cloudflare.com'],
        hosting: 'Cloudflare',
        dnsProvider: 'Cloudflare',
      });
    });

    it('propaga a mensagem pública quando o DoH responde HTTP de erro', async () => {
      const fakeFetch: typeof fetch = async () => respostaHttp(503);

      await expect(fetchDns('example.com', depsDeTeste(fakeFetch))).rejects.toThrow(
        /Falha na consulta DNS \([A-Z]+\)./,
      );
    });
  });

  describe('fetchRegistration', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('consulta RDAP via fetch injetado e monta o registro .com', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-05-15T12:00:00Z'));

      const urls: string[] = [];
      const fakeFetch: typeof fetch = async (input, init) => {
        urls.push(String(input));
        expect(init?.headers).toEqual({ accept: 'application/rdap+json' });
        return respostaJson({
          ldhName: 'EXAMPLE.COM',
          events: [
            { eventAction: 'registration', eventDate: '2000-01-01T12:00:00Z' },
            { eventAction: 'expiration', eventDate: '2025-01-01T12:00:00Z' },
            { eventAction: 'last changed', eventDate: '2023-01-01T12:00:00Z' },
          ],
          entities: [
            {
              roles: ['registrar'],
              vcardArray: [
                'vcard',
                [
                  ['version', {}, 'text', '4.0'],
                  ['fn', {}, 'text', 'Mock Registrar, Inc.'],
                ],
              ],
            },
          ],
          status: ['clientTransferProhibited'],
          nameservers: [{ ldhName: 'NS1.EXAMPLE.COM' }, { ldhName: 'NS2.EXAMPLE.COM' }],
          secureDNS: { delegationSigned: true },
        });
      };

      const result = await fetchRegistration('example.com', depsDeTeste(fakeFetch));

      expect(urls).toEqual(['https://rdap.org/domain/example.com']);
      expect(result).toEqual({
        found: true,
        domain: 'example.com',
        registrar: 'Mock Registrar, Inc.',
        registeredAt: '2000-01-01T12:00:00Z',
        expiresAt: '2025-01-01T12:00:00Z',
        changedAt: '2023-01-01T12:00:00Z',
        daysToExpire: 231,
        status: ['clientTransferProhibited'],
        nameservers: ['ns1.example.com', 'ns2.example.com'],
        dnssec: true,
        source: 'rdap.org',
      });
    });

    it('usa registro.br em .br e preenche o registrador padrão', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-05-15T12:00:00Z'));

      const urls: string[] = [];
      const fakeFetch: typeof fetch = async (input) => {
        urls.push(String(input));
        return respostaJson({
          ldhName: 'example.com.br',
          events: [
            { eventAction: 'registration', eventDate: '2010-01-01T12:00:00Z' },
            { eventAction: 'expiration', eventDate: '2024-06-15T12:00:00Z' },
          ],
        });
      };

      const result = await fetchRegistration('sub.example.com.br', depsDeTeste(fakeFetch));

      expect(urls).toEqual(['https://rdap.registro.br/domain/example.com.br']);
      expect(result).toEqual({
        found: true,
        domain: 'example.com.br',
        registrar: 'Registro.br (NIC.br)',
        registeredAt: '2010-01-01T12:00:00Z',
        expiresAt: '2024-06-15T12:00:00Z',
        changedAt: null,
        daysToExpire: 31,
        status: [],
        nameservers: [],
        dnssec: false,
        source: 'registro.br',
      });
    });

    it('devolve found:false em 404 do RDAP', async () => {
      let chamadas = 0;
      const fakeFetch: typeof fetch = async () => {
        chamadas += 1;
        return respostaHttp(404);
      };

      const result = await fetchRegistration('missing.example', depsDeTeste(fakeFetch));

      expect(chamadas).toBe(1);
      expect(result).toEqual({
        found: false,
        domain: 'missing.example',
        registrar: null,
        registeredAt: null,
        expiresAt: null,
        changedAt: null,
        daysToExpire: null,
        status: [],
        nameservers: [],
        dnssec: false,
        source: 'rdap.org',
      });
    });

    it('devolve found:false quando o fetch falha na rede', async () => {
      let chamadas = 0;
      const fakeFetch: typeof fetch = async () => {
        chamadas += 1;
        throw new Error('Network failure');
      };

      const result = await fetchRegistration('example.com', depsDeTeste(fakeFetch));

      expect(chamadas).toBe(1);
      expect(result).toMatchObject({
        found: false,
        domain: 'example.com',
        source: 'rdap.org',
      });
    });

    it('devolve found:false em .br quando o fetch falha na rede', async () => {
      const fakeFetch: typeof fetch = async () => {
        throw new Error('Network failure');
      };

      const result = await fetchRegistration('example.com.br', depsDeTeste(fakeFetch));

      expect(result).toMatchObject({
        found: false,
        domain: 'example.com.br',
        source: 'registro.br',
      });
    });

    it('devolve found:false quando o JSON do RDAP falha', async () => {
      let chamadas = 0;
      const fakeFetch: typeof fetch = async () => {
        chamadas += 1;
        return {
          ok: true,
          status: 200,
          json: async () => {
            throw new Error('JSON parse error');
          },
        } as unknown as Response;
      };

      const result = await fetchRegistration('example.com', depsDeTeste(fakeFetch));

      expect(chamadas).toBe(1);
      expect(result).toMatchObject({ found: false, domain: 'example.com', source: 'rdap.org' });
    });
  });

  describe('fetchEmailAuth', () => {
    it('consulta DoH injetado no apex e no DMARC', async () => {
      const urls: string[] = [];
      const originalDns = dnsVazio('sub.example.com');

      const fakeFetch: typeof fetch = async (input) => {
        const url = String(input);
        urls.push(url);
        const parsed = new URL(url);
        const name = parsed.searchParams.get('name');
        const type = parsed.searchParams.get('type');

        if (name === 'example.com' && type === 'MX') {
          return respostaJson({ Answer: [{ type: 15, data: '10 aspmx.l.google.com.' }] });
        }
        if (name === 'example.com' && type === 'TXT') {
          return respostaJson({
            Answer: [{ type: 16, data: '"v=spf1 include:_spf.google.com ~all"' }],
          });
        }
        if (name === '_dmarc.example.com' && type === 'TXT') {
          return respostaJson({
            Answer: [{ type: 16, data: '"v=DMARC1; p=quarantine;"' }],
          });
        }
        return respostaJson({ Answer: [] });
      };

      const result = await fetchEmailAuth('sub.example.com', originalDns, depsDeTeste(fakeFetch));

      expect(urls.every((url) => url.startsWith('https://doh.test/resolve?'))).toBe(true);
      expect(result).toMatchObject({
        hasMx: true,
        mxProvider: 'Google',
        spf: 'v=spf1 include:_spf.google.com ~all',
        dmarc: 'v=DMARC1; p=quarantine;',
        dmarcPolicy: 'quarantine',
      });
    });

    it('mantém o DNS original quando a consulta do apex falha', async () => {
      const originalDns: DnsReport = {
        ...dnsVazio('sub.example.com'),
        txt: ['v=spf1 include:_spf.example.com ~all'],
      };

      const fakeFetch: typeof fetch = async (input) => {
        const url = String(input);
        if (url.includes('name=example.com')) {
          throw new Error('Simulated DNS network error');
        }
        if (url.includes('name=_dmarc.sub.example.com')) {
          return respostaJson({
            Answer: [{ type: 16, data: '"v=DMARC1; p=reject;"' }],
          });
        }
        return respostaJson({ Answer: [] });
      };

      const result = await fetchEmailAuth('sub.example.com', originalDns, depsDeTeste(fakeFetch));

      expect(result.hasMx).toBe(false);
      expect(result.mxProvider).toBe(null);
      expect(result.spf).toBe('v=spf1 include:_spf.example.com ~all');
      expect(result.dmarc).toBe('v=DMARC1; p=reject;');
      expect(result.dmarcPolicy).toBe('reject');
    });
  });

  describe('fetchContent', () => {
    it('chama o Worker /audit injetado e devolve o relatório', async () => {
      const urls: string[] = [];
      const mockReport = { ok: true, status: 200, findings: [] };
      const fakeFetch: typeof fetch = async (input) => {
        urls.push(String(input));
        return respostaJson(mockReport);
      };

      const result = await fetchContent('example.com', depsDeTeste(fakeFetch));

      expect(urls).toEqual(['https://worker.test/audit?url=example.com']);
      expect(result).toEqual(mockReport);
    });

    it('propaga o 429 do Worker com a mensagem pública', async () => {
      const fakeFetch: typeof fetch = async () => respostaHttp(429);

      await expect(fetchContent('example.com', depsDeTeste(fakeFetch))).rejects.toThrow(
        'Muitas análises seguidas a partir da sua conexão.',
      );
    });

    it('rejeita 400 e 403 como domínio inválido', async () => {
      for (const status of [400, 403]) {
        const urls: string[] = [];
        const fakeFetch: typeof fetch = async (input) => {
          urls.push(String(input));
          return respostaHttp(status);
        };

        await expect(fetchContent('example.com', depsDeTeste(fakeFetch))).rejects.toThrow(
          'Domínio inválido ou inacessível.',
        );
        expect(urls[0]).toContain('url=example.com');
      }
    });

    it('rejeita outros status HTTP do Worker com a mensagem de falha', async () => {
      const urls: string[] = [];
      const fakeFetch: typeof fetch = async (input) => {
        urls.push(String(input));
        return respostaHttp(500);
      };

      await expect(fetchContent('example.com', depsDeTeste(fakeFetch))).rejects.toThrow(
        'O servidor de análise falhou (status 500).',
      );
      expect(urls[0]).toContain('url=example.com');
    });

    it('rejeita relatório com error e ok:false', async () => {
      const fakeFetch: typeof fetch = async () =>
        respostaJson({ ok: false, error: 'Custom API error' });

      await expect(fetchContent('example.com', depsDeTeste(fakeFetch))).rejects.toThrow(
        'Custom API error',
      );
    });
  });

  describe('fetchPageSpeed', () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('chama o Worker /pagespeed injetado e mapeia o relatório', async () => {
      const urls: string[] = [];
      const fakeFetch: typeof fetch = async (input) => {
        urls.push(String(input));
        return respostaJson({
          lighthouseResult: {
            categories: { performance: { score: 0.9 } },
            audits: {},
          },
        });
      };

      const result = await fetchPageSpeed('example.com', 'desktop', depsDeTeste(fakeFetch));

      expect(urls).toHaveLength(1);
      const called = new URL(urls[0]!);
      expect(`${called.origin}${called.pathname}`).toBe('https://worker.test/pagespeed');
      expect(called.searchParams.get('domain')).toBe('https://example.com');
      expect(called.searchParams.get('strategy')).toBe('desktop');
      expect(called.searchParams.has('key')).toBe(false);
      expect(urls[0]).not.toContain('googleapis.com');
      expect(result.scores.performance).toBe(90);
      expect(result.strategy).toBe('desktop');
    });

    it('mapeia oportunidades, lab e CrUX da URL', async () => {
      const fakeFetch: typeof fetch = async () =>
        respostaJson({
          lighthouseResult: {
            categories: {
              performance: { score: 0.82 },
              seo: { score: 0.91 },
              accessibility: { score: 0.88 },
              'best-practices': { score: 0.77 },
            },
            audits: {
              'largest-contentful-paint': { numericValue: 2400 },
              'first-contentful-paint': { numericValue: 1100 },
              'cumulative-layout-shift': { numericValue: 0.04 },
              'total-blocking-time': { numericValue: 180 },
              'speed-index': { numericValue: 2100 },
              'server-response-time': { numericValue: 320 },
              'total-byte-weight': { numericValue: 1_250_000 },
              'unused-javascript': {
                title: 'Reduza JavaScript não usado',
                details: { overallSavingsMs: 900, type: 'opportunity' },
              },
              'render-blocking-resources': {
                title: 'Elimine recursos que bloqueiam a renderização',
                details: { overallSavingsMs: 400, type: 'opportunity' },
              },
              'efficient-animated-content': {
                title: 'Use formatos de vídeo eficientes',
                details: { overallSavingsMs: 80, type: 'opportunity' },
              },
              'sem-titulo': {
                details: { overallSavingsMs: 500, type: 'opportunity' },
              },
              'final-screenshot': {
                details: { data: 'data:image/jpeg;base64,abc', type: 'screenshot' },
              },
            },
          },
          loadingExperience: {
            overall_category: 'AVERAGE',
            metrics: {
              LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2800, category: 'AVERAGE' },
              CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 12, category: 'FAST' },
              INTERACTION_TO_NEXT_PAINT: { percentile: 210, category: 'SLOW' },
            },
          },
          originLoadingExperience: {
            overall_category: 'SLOW',
            metrics: {
              LARGEST_CONTENTFUL_PAINT_MS: { percentile: 5000, category: 'SLOW' },
            },
          },
        });

      const result = await fetchPageSpeed('example.com', 'mobile', depsDeTeste(fakeFetch));

      expect(result.scores).toEqual({
        performance: 82,
        seo: 91,
        accessibility: 88,
        bestPractices: 77,
      });
      expect(result.lab).toEqual({
        lcpMs: 2400,
        fcpMs: 1100,
        cls: 0.04,
        tbtMs: 180,
        speedIndexMs: 2100,
        serverResponseMs: 320,
        totalBytes: 1_250_000,
      });
      expect(result.opportunities).toEqual([
        { title: 'Reduza JavaScript não usado', savingsMs: 900 },
        { title: 'Elimine recursos que bloqueiam a renderização', savingsMs: 400 },
      ]);
      expect(result.field).toEqual({
        available: true,
        overall: 'AVERAGE',
        lcp: { p75: 2800, category: 'AVERAGE' },
        cls: { p75: 12, category: 'FAST' },
        inp: { p75: 210, category: 'SLOW' },
        origin: false,
      });
      expect(result.screenshot).toBe('data:image/jpeg;base64,abc');
      expect(result.strategy).toBe('mobile');
    });

    it('usa CrUX da origem quando a URL não tem métricas de campo', async () => {
      const fakeFetch: typeof fetch = async () =>
        respostaJson({
          lighthouseResult: { categories: {}, audits: {} },
          loadingExperience: { overall_category: 'FAST', metrics: {} },
          originLoadingExperience: {
            overall_category: 'AVERAGE',
            metrics: {
              LARGEST_CONTENTFUL_PAINT_MS: { percentile: 3100, category: 'AVERAGE' },
              CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 8, category: 'FAST' },
              INTERACTION_TO_NEXT_PAINT: { percentile: 150, category: 'FAST' },
            },
          },
        });

      const result = await fetchPageSpeed('example.com', 'mobile', depsDeTeste(fakeFetch));

      expect(result.field.available).toBe(true);
      expect(result.field.origin).toBe(true);
      expect(result.field.overall).toBe('AVERAGE');
      expect(result.field.lcp).toEqual({ p75: 3100, category: 'AVERAGE' });
    });

    it('aborta quando a resposta ultrapassa o timeout', async () => {
      vi.useFakeTimers();

      const fakeFetch: typeof fetch = async (_input, options) =>
        new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const abortError = new Error('The operation was aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          }
        });

      const fetchPromise = fetchPageSpeed('example.com', 'mobile', depsDeTeste(fakeFetch));
      const assertion = expect(fetchPromise).rejects.toThrow(
        'O Google demorou demais para responder a medição de velocidade.',
      );

      await vi.runAllTimersAsync();
      await assertion;
    });

    it('para no 429 rate_limited do Worker sem retentar', async () => {
      let chamadas = 0;
      const fakeFetch: typeof fetch = async () => {
        chamadas += 1;
        return respostaJson(
          {
            error: 'Muitas requisições. Tente novamente mais tarde.',
            code: 'rate_limited',
          },
          429,
        );
      };

      await expect(fetchPageSpeed('example.com', 'mobile', depsDeTeste(fakeFetch))).rejects.toThrow(
        'Muitas análises seguidas a partir da sua conexão.',
      );
      expect(chamadas).toBe(1);
    });

    it('rejeita HTTP 400 definitivo sem retentar', async () => {
      let chamadas = 0;
      const fakeFetch: typeof fetch = async () => {
        chamadas += 1;
        return respostaJson({ error: { code: 400, message: 'Bad Request' } }, 400);
      };

      await expect(fetchPageSpeed('example.com', 'mobile', depsDeTeste(fakeFetch))).rejects.toThrow(
        'A medição de velocidade do Google não pôde ser concluída no momento.',
      );
      expect(chamadas).toBe(1);
    });

    it('retenta após 429 do Google e devolve sucesso', async () => {
      vi.useFakeTimers();
      const cryptoSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr) => {
        (arr as Uint32Array)[0] = 0;
        return arr;
      });

      let chamadas = 0;
      const fakeFetch: typeof fetch = async () => {
        chamadas += 1;
        if (chamadas === 1) {
          return respostaJson({ error: { code: 429, message: 'Too Many Requests' } }, 429);
        }
        return respostaJson({ lighthouseResult: { categories: {} } });
      };

      const promise = fetchPageSpeed('example.com', 'mobile', depsDeTeste(fakeFetch));
      await vi.advanceTimersByTimeAsync(5000);
      await promise;

      expect(chamadas).toBe(2);
      cryptoSpy.mockRestore();
    });

    it('retenta após 500 e devolve sucesso', async () => {
      vi.useFakeTimers();
      const cryptoSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr) => {
        (arr as Uint32Array)[0] = 0;
        return arr;
      });

      let chamadas = 0;
      const fakeFetch: typeof fetch = async () => {
        chamadas += 1;
        if (chamadas === 1) {
          return respostaJson({ error: { code: 500, message: 'Internal Server Error' } }, 500);
        }
        return respostaJson({ lighthouseResult: { categories: {} } });
      };

      const promise = fetchPageSpeed('example.com', 'mobile', depsDeTeste(fakeFetch));
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(chamadas).toBe(2);
      cryptoSpy.mockRestore();
    });
  });

  describe('defaultSourcesDeps (wrapper do fetch global)', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('usa globalThis.fetch e AUDIT_ENDPOINT quando deps são omitidas', async () => {
      const urls: string[] = [];
      globalThis.fetch = (async (input) => {
        urls.push(String(input));
        return respostaJson({ ok: true, status: 200, findings: [] });
      }) as typeof fetch;

      const result = await fetchContent('example.com');

      expect(urls).toEqual([`${AUDIT_ENDPOINT}/audit?url=example.com`]);
      expect(result).toEqual({ ok: true, status: 200, findings: [] });
      expect(defaultSourcesDeps.dohEndpoint).toBe('https://dns.google/resolve');
      expect(defaultSourcesDeps.auditEndpoint).toBe(AUDIT_ENDPOINT);
    });
  });
});
