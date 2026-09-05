import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRegistration, fetchEmailAuth, fetchPageSpeed, fetchContent } from './sources';
import type { DnsReport } from './types';

describe('sources', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('fetchRegistration', () => {
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
    it('should throw an error when response is not ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as unknown as Response);

      await expect(fetchContent('example.com')).rejects.toThrow(
        'O serviço de auditoria respondeu 500.'
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
  });
});
