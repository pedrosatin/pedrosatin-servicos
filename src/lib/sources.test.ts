import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRegistration, fetchEmailAuth, fetchPageSpeed, fetchContent } from './sources';
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
