import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('sources', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const depsDeTeste = (
    fakeFetch: typeof fetch,
    overrides: Partial<Omit<SourcesDeps, 'fetch'>> = {},
  ): SourcesDeps => ({
    fetch: fakeFetch,
    auditEndpoint: 'https://worker.test',
    dohEndpoint: 'https://doh.test/resolve',
    ...overrides,
  });

  describe('fetch* com SourcesDeps injetado', () => {
    it('fetchDns usa dohEndpoint e fetch injetados sem alterar o fetch global', async () => {
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

        return {
          ok: true,
          status: 200,
          json: async () => ({ Status: 0, Answer: answers }),
        } as Response;
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
      expect(globalThis.fetch).toBe(originalFetch);
      expect(defaultSourcesDeps.dohEndpoint).toBe('https://dns.google/resolve');
      expect(defaultSourcesDeps.auditEndpoint).toBe(AUDIT_ENDPOINT);
    });

    it('fetchContent chama o Worker /audit injetado e devolve o relatório', async () => {
      const urls: string[] = [];
      const mockReport = { ok: true, status: 200, findings: [] };
      const fakeFetch: typeof fetch = async (input) => {
        urls.push(String(input));
        return {
          ok: true,
          status: 200,
          json: async () => mockReport,
        } as Response;
      };

      const result = await fetchContent('example.com', depsDeTeste(fakeFetch));

      expect(urls).toEqual(['https://worker.test/audit?url=example.com']);
      expect(result).toEqual(mockReport);
      expect(globalThis.fetch).toBe(originalFetch);
    });

    it('fetchContent propaga o 429 do Worker com a mensagem pública', async () => {
      const fakeFetch: typeof fetch = async () =>
        ({
          ok: false,
          status: 429,
        }) as Response;

      await expect(fetchContent('example.com', depsDeTeste(fakeFetch))).rejects.toThrow(
        'Muitas análises seguidas a partir da sua conexão.',
      );
      expect(globalThis.fetch).toBe(originalFetch);
    });

    it('fetchPageSpeed chama o Worker /pagespeed injetado e mapeia o relatório', async () => {
      const urls: string[] = [];
      const fakeFetch: typeof fetch = async (input) => {
        urls.push(String(input));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            lighthouseResult: {
              categories: { performance: { score: 0.9 } },
              audits: {},
            },
          }),
        } as Response;
      };

      const result = await fetchPageSpeed('example.com', 'desktop', depsDeTeste(fakeFetch));

      expect(urls).toHaveLength(1);
      const called = new URL(urls[0]!);
      expect(`${called.origin}${called.pathname}`).toBe('https://worker.test/pagespeed');
      expect(called.searchParams.get('domain')).toBe('https://example.com');
      expect(called.searchParams.get('strategy')).toBe('desktop');
      expect(result.scores.performance).toBe(90);
      expect(result.strategy).toBe('desktop');
      expect(globalThis.fetch).toBe(originalFetch);
    });

    it('fetchPageSpeed para no 429 rate_limited do Worker sem tocar no fetch global', async () => {
      let chamadas = 0;
      const fakeFetch: typeof fetch = async () => {
        chamadas += 1;
        return {
          ok: false,
          status: 429,
          json: async () => ({
            error: 'Muitas requisições. Tente novamente mais tarde.',
            code: 'rate_limited',
          }),
        } as Response;
      };

      await expect(fetchPageSpeed('example.com', 'mobile', depsDeTeste(fakeFetch))).rejects.toThrow(
        'Muitas análises seguidas a partir da sua conexão.',
      );
      expect(chamadas).toBe(1);
      expect(globalThis.fetch).toBe(originalFetch);
    });

    it('fetchEmailAuth consulta DoH injetado para apex e DMARC', async () => {
      const urls: string[] = [];
      const originalDns: DnsReport = {
        domain: 'sub.example.com',
        resolves: true,
        a: [],
        aaaa: [],
        ns: [],
        mx: [],
        txt: [],
        cname: [],
        hosting: null,
        dnsProvider: null,
      };

      const fakeFetch: typeof fetch = async (input) => {
        const url = String(input);
        urls.push(url);
        const parsed = new URL(url);
        const name = parsed.searchParams.get('name');
        const type = parsed.searchParams.get('type');

        if (name === 'example.com' && type === 'MX') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ Answer: [{ type: 15, data: '10 aspmx.l.google.com.' }] }),
          } as Response;
        }
        if (name === 'example.com' && type === 'TXT') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              Answer: [{ type: 16, data: '"v=spf1 include:_spf.google.com ~all"' }],
            }),
          } as Response;
        }
        if (name === '_dmarc.example.com' && type === 'TXT') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              Answer: [{ type: 16, data: '"v=DMARC1; p=quarantine;"' }],
            }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ Answer: [] }),
        } as Response;
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
      expect(globalThis.fetch).toBe(originalFetch);
    });

    it('fetchRegistration consulta RDAP via fetch injetado', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-05-15T12:00:00Z'));

      const urls: string[] = [];
      const fakeFetch: typeof fetch = async (input, init) => {
        urls.push(String(input));
        expect(init?.headers).toEqual({ accept: 'application/rdap+json' });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ldhName: 'EXAMPLE.COM',
            events: [
              { eventAction: 'registration', eventDate: '2000-01-01T12:00:00Z' },
              { eventAction: 'expiration', eventDate: '2025-01-01T12:00:00Z' },
              { eventAction: 'last changed', eventDate: '2023-01-01T12:00:00Z' },
            ],
            entities: [
              {
                roles: ['registrar'],
                vcardArray: ['vcard', [['fn', {}, 'text', 'Mock Registrar, Inc.']]],
              },
            ],
            status: ['active'],
            nameservers: [{ ldhName: 'NS1.EXAMPLE.COM' }],
            secureDNS: { delegationSigned: true },
          }),
        } as Response;
      };

      const result = await fetchRegistration('example.com', depsDeTeste(fakeFetch));

      expect(urls).toEqual(['https://rdap.org/domain/example.com']);
      expect(result).toMatchObject({
        found: true,
        domain: 'example.com',
        registrar: 'Mock Registrar, Inc.',
        daysToExpire: 231,
        dnssec: true,
        source: 'rdap.org',
      });
      expect(globalThis.fetch).toBe(originalFetch);

      vi.useRealTimers();
    });
  });

  describe('fetchRegistration', () => {

    it('should return a successful domain registration object for .com domains', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-05-15T12:00:00Z'));

      const mockRdapData = {
        ldhName: 'EXAMPLE.COM',
        events: [
          { eventAction: 'registration', eventDate: '2000-01-01T12:00:00Z' },
          { eventAction: 'expiration', eventDate: '2025-01-01T12:00:00Z' },
          { eventAction: 'last changed', eventDate: '2023-01-01T12:00:00Z' }
        ],
        entities: [
          {
            roles: ['registrar'],
            vcardArray: [
              'vcard',
              [
                ['version', {}, 'text', '4.0'],
                ['fn', {}, 'text', 'Mock Registrar, Inc.']
              ]
            ]
          }
        ],
        status: ['clientTransferProhibited'],
        nameservers: [{ ldhName: 'NS1.EXAMPLE.COM' }, { ldhName: 'NS2.EXAMPLE.COM' }],
        secureDNS: { delegationSigned: true }
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRdapData,
      } as unknown as Response);

      const result = await fetchRegistration('example.com');

      expect(result).toEqual({
        found: true,
        domain: 'example.com',
        registrar: 'Mock Registrar, Inc.',
        registeredAt: '2000-01-01T12:00:00Z',
        expiresAt: '2025-01-01T12:00:00Z',
        changedAt: '2023-01-01T12:00:00Z',
        daysToExpire: 231, // (2025-01-01 - 2024-05-15) / 86400000 -> 231
        status: ['clientTransferProhibited'],
        nameservers: ['ns1.example.com', 'ns2.example.com'],
        dnssec: true,
        source: 'rdap.org',
      });

      expect(globalThis.fetch).toHaveBeenCalledWith('https://rdap.org/domain/example.com', { headers: { accept: 'application/rdap+json' } });

      vi.useRealTimers();
    });

    it('should handle .br domains correctly with fallback values', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-05-15T12:00:00Z'));

      const mockRdapData = {
        ldhName: 'example.com.br',
        events: [
          { eventAction: 'registration', eventDate: '2010-01-01T12:00:00Z' },
          { eventAction: 'expiration', eventDate: '2024-06-15T12:00:00Z' }
        ]
        // Omit entities to test fallback, .br should hardcode registrar
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRdapData,
      } as unknown as Response);

      const result = await fetchRegistration('sub.example.com.br');

      expect(result).toEqual({
        found: true,
        domain: 'example.com.br',
        registrar: 'Registro.br (NIC.br)',
        registeredAt: '2010-01-01T12:00:00Z',
        expiresAt: '2024-06-15T12:00:00Z',
        changedAt: null,
        daysToExpire: 31, // (2024-06-15 - 2024-05-15)
        status: [],
        nameservers: [],
        dnssec: false,
        source: 'registro.br',
      });

      expect(globalThis.fetch).toHaveBeenCalledWith('https://rdap.registro.br/domain/example.com.br', { headers: { accept: 'application/rdap+json' } });

      vi.useRealTimers();
    });

    it('should return a default object with found: false when fetch throws an error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const result = await fetchRegistration('example.com');

      expect(result).toEqual({
        found: false,
        domain: 'example.com',
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
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return a default object with found: false for .br domains when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const result = await fetchRegistration('example.com.br');

      expect(result).toEqual({
        found: false,
        domain: 'example.com.br',
        registrar: null,
        registeredAt: null,
        expiresAt: null,
        changedAt: null,
        daysToExpire: null,
        status: [],
        nameservers: [],
        dnssec: false,
        source: 'registro.br',
      });
    });

    it('should return a default object with found: false when json parsing throws an error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
      } as unknown as Response);

      const result = await fetchRegistration('example.com');

      expect(result).toEqual({
        found: false,
        domain: 'example.com',
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
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchEmailAuth', () => {
    it('should handle fetchDns error and maintain original dns', async () => {
      const originalDns: DnsReport = {
        domain: 'sub.example.com',
        resolves: true,
        a: [],
        aaaa: [],
        ns: [],
        mx: [],
        txt: ['v=spf1 include:_spf.example.com ~all'],
        cname: [],
        hosting: null,
        dnsProvider: null,
      };

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('name=example.com')) {
          throw new Error('Simulated DNS network error');
        }
        if (url.includes('name=_dmarc.sub.example.com')) {
          return {
            ok: true,
            json: () => Promise.resolve({
              Answer: [{ type: 16, data: '"v=DMARC1; p=reject;"' }],
            }),
          } as unknown as Response;
        }
        return {
          ok: true,
          json: () => Promise.resolve({ Answer: [] }),
        } as unknown as Response;
      });

      const result = await fetchEmailAuth('sub.example.com', originalDns);

      expect(result.hasMx).toBe(false);
      expect(result.mxProvider).toBe(null);
      expect(result.spf).toBe('v=spf1 include:_spf.example.com ~all');
      expect(result.dmarc).toBe('v=DMARC1; p=reject;');
      expect(result.dmarcPolicy).toBe('reject');
    });

    it('should successfully fetch apex dns and use it if it has mx records', async () => {
      const originalDns: DnsReport = {
        domain: 'sub.example.com',
        resolves: true,
        a: [],
        aaaa: [],
        ns: [],
        mx: [],
        txt: [],
        cname: [],
        hosting: null,
        dnsProvider: null,
      };

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('name=example.com')) {
          const type = new URL(url).searchParams.get('type');
          if (type === 'MX') {
            return {
              ok: true,
              json: () => Promise.resolve({ Answer: [{ type: 15, data: '10 aspmx.l.google.com.' }] }),
            } as unknown as Response;
          }
          if (type === 'TXT') {
            return {
              ok: true,
              json: () => Promise.resolve({ Answer: [{ type: 16, data: '"v=spf1 include:_spf.google.com ~all"' }] }),
            } as unknown as Response;
          }
        }
        if (url.includes('name=_dmarc.example.com')) {
          return {
            ok: true,
            json: () => Promise.resolve({
              Answer: [{ type: 16, data: '"v=DMARC1; p=quarantine;"' }],
            }),
          } as unknown as Response;
        }
        return {
          ok: true,
          json: () => Promise.resolve({ Answer: [] }),
        } as unknown as Response;
      });

      const result = await fetchEmailAuth('sub.example.com', originalDns);

      expect(result.hasMx).toBe(true);
      expect(result.mxProvider).toBe('Google');
      expect(result.spf).toBe('v=spf1 include:_spf.google.com ~all');
      expect(result.dmarc).toBe('v=DMARC1; p=quarantine;');
      expect(result.dmarcPolicy).toBe('quarantine');
    });
  });

  describe('fetchContent', () => {
    it('should throw a specific error when response status is 400', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      } as unknown as Response);

      await expect(fetchContent('example.com')).rejects.toThrow(
        'Domínio inválido ou inacessível.'
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('url=example.com'));
    });

    it('should explain the Worker rate limit on 429', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      } as unknown as Response);

      await expect(fetchContent('example.com')).rejects.toThrow(
        'Muitas análises seguidas a partir da sua conexão.'
      );
    });

    it('should throw a specific error when response status is 403', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      } as unknown as Response);

      await expect(fetchContent('example.com')).rejects.toThrow(
        'Domínio inválido ou inacessível.'
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('url=example.com'));
    });

    it('should throw an error when response is not ok and status is other than 400/403', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as unknown as Response);

      await expect(fetchContent('example.com')).rejects.toThrow(
        'O servidor de análise falhou (status 500).'
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('url=example.com'));
    });

    it('should throw a custom error when report contains an error and is not ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false, error: 'Custom API error' }),
      } as unknown as Response);

      await expect(fetchContent('example.com')).rejects.toThrow('Custom API error');
    });

    it('should return the report on a successful response', async () => {
      const mockReport = { ok: true, status: 200, resources: [] };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockReport,
      } as unknown as Response);

      const result = await fetchContent('example.com');
      expect(result).toEqual(mockReport);
    });
  });

  describe('fetchPageSpeed', () => {
    it('should abort fetch and throw specific error when response takes longer than PAGESPEED_TIMEOUT_MS', async () => {
      vi.useFakeTimers();

      globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const abortError = new Error('The operation was aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          }
        });
      });

      const fetchPromise = fetchPageSpeed('example.com');
      const assertion = expect(fetchPromise).rejects.toThrow('O Google demorou demais para responder a medição de velocidade.');

      await vi.runAllTimersAsync();
      await assertion;

      vi.useRealTimers();
    });

    it('should succeed without retries when API returns a valid response', async () => {
      const mockPsiResponse = {
        lighthouseResult: {
          categories: { performance: { score: 0.95 } },
          audits: {},
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPsiResponse,
      } as unknown as Response);

      const result = await fetchPageSpeed('example.com');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(result.scores.performance).toBe(95);
    });

    it('mapeia oportunidades, lab e CrUX da URL a partir do payload do PageSpeed', async () => {
      const mockPsiResponse = {
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
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPsiResponse,
      } as unknown as Response);

      const result = await fetchPageSpeed('example.com', 'mobile');

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

    it('usa CrUX da origem quando a URL específica não tem métricas de campo', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
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
        }),
      } as unknown as Response);

      const result = await fetchPageSpeed('example.com');

      expect(result.field.available).toBe(true);
      expect(result.field.origin).toBe(true);
      expect(result.field.overall).toBe('AVERAGE');
      expect(result.field.lcp).toEqual({ p75: 3100, category: 'AVERAGE' });
    });

    it('calls the Worker /pagespeed route without a key', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ lighthouseResult: { categories: {} } }),
      } as unknown as Response);

      await fetchPageSpeed('example.com', 'desktop');

      const called = new URL(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]));
      expect(`${called.origin}${called.pathname}`).toBe(`${AUDIT_ENDPOINT.replace(/\/$/, '')}/pagespeed`);
      expect(called.searchParams.get('domain')).toBe('https://example.com');
      expect(called.searchParams.get('strategy')).toBe('desktop');
      expect(called.searchParams.has('key')).toBe(false);
      expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).not.toContain('googleapis.com');
    });

    it('stops at the Worker rate limit with its own message instead of retrying', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Muitas requisições. Tente novamente mais tarde.', code: 'rate_limited' }),
      } as unknown as Response);

      await expect(fetchPageSpeed('example.com')).rejects.toThrow('Muitas análises seguidas a partir da sua conexão.');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle definitive HTTP 400 error immediately without endless retries', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: 400, message: 'Bad Request' } }),
      } as unknown as Response);

      await expect(fetchPageSpeed('example.com')).rejects.toThrow(
        'A medição de velocidade do Google não pôde ser concluída no momento.',
      );
    });


    it('should retry after a 429 limit error and return successful response', async () => {
      vi.useFakeTimers();
      const cryptoSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr: any) => {
        arr[0] = 0;
        return arr;
      });

      const mockSuccessfulData = { lighthouseResult: { categories: {} } };

      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { code: 429, message: 'Too Many Requests' } }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSuccessfulData,
        } as unknown as Response);

      const promise = fetchPageSpeed('example.com');

      // Advance by the 5000ms expected delay to resolve the setTimeout in `esperar`
      await vi.advanceTimersByTimeAsync(5000);

      await promise;

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      cryptoSpy.mockRestore();
      vi.useRealTimers();
    });

    it('should retry after a 500 server error and return successful response', async () => {
      vi.useFakeTimers();
      const cryptoSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr: any) => {
        arr[0] = 0;
        return arr;
      });

      const mockSuccessfulData = { lighthouseResult: { categories: {} } };

      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { code: 500, message: 'Internal Server Error' } }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSuccessfulData,
        } as unknown as Response);

      const promise = fetchPageSpeed('example.com');

      await vi.advanceTimersByTimeAsync(1000);

      await promise;

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      cryptoSpy.mockRestore();
      vi.useRealTimers();
    });

  });
});
