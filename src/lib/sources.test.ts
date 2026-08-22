import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchEmailAuth } from './sources';
import type { DnsReport } from './types';

describe('fetchEmailAuth', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('deve manter o dns original se a busca pelo dns do apex falhar', async () => {
    const originalDns: DnsReport = {
      domain: 'sub.example.com',
      resolves: true,
      a: [],
      aaaa: [],
      ns: [],
      mx: [], // MX is empty, which triggers the fetch for apex
      txt: ['v=spf1 include:_spf.example.com ~all'],
      cname: [],
      hosting: null,
      dnsProvider: null,
    };

    // Mock fetch to simulate failure on both fetchDns and resolveRecord for DMARC/SPF
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      // Simulate failure for apex domain DNS fetch (fetchDns calls it on apex)
      if (url.includes('type=MX') && url.includes('name=example.com')) {
         throw new Error('Network Error for Apex DNS MX fetch');
      }

      // Allow other queries like A, AAAA, NS, TXT, CNAME, _dmarc
      return {
        ok: true,
        json: async () => ({ Status: 0, Answer: [] }),
      } as Response;
    });

    globalThis.fetch = fetchMock;

    const result = await fetchEmailAuth('sub.example.com', originalDns);

    expect(fetchMock).toHaveBeenCalled();
    // Result should reflect the original dns properties since apex fetch failed
    expect(result.hasMx).toBe(false);
    expect(result.mxProvider).toBeNull();
    expect(result.spf).toBe('v=spf1 include:_spf.example.com ~all');
  });
});

describe('fetchEmailAuth happy paths', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('deve usar o mx do apex caso o subdominio não possua e apex retorne sucesso', async () => {
    const originalDns: DnsReport = {
      domain: 'sub.example.com',
      resolves: true,
      a: [],
      aaaa: [],
      ns: [],
      mx: [], // triggers fetchDns(apex)
      txt: [],
      cname: [],
      hosting: null,
      dnsProvider: null,
    };

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      // Return a valid MX for the apex domain
      if (url.includes('type=MX') && url.includes('name=example.com')) {
         return {
           ok: true,
           json: async () => ({
             Status: 0,
             Answer: [{ name: 'example.com', type: 15, TTL: 3600, data: '10 mail.example.com' }]
           }),
         } as Response;
      }

      return {
        ok: true,
        json: async () => ({ Status: 0, Answer: [] }),
      } as Response;
    });

    globalThis.fetch = fetchMock;

    const result = await fetchEmailAuth('sub.example.com', originalDns);

    expect(fetchMock).toHaveBeenCalled();
    expect(result.hasMx).toBe(true);
  });
});
