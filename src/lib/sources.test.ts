import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEmailAuth } from './sources';

// We need to mock fetch since fetchDns uses it indirectly via resolveRecord.
describe('fetchEmailAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle fetchDns error in try/catch block and maintain original dns', async () => {
    const originalDns = {
      domain: 'sub.example.com',
      resolves: true,
      a: [],
      aaaa: [],
      ns: [],
      mx: [], // empty mx triggers apex logic
      txt: ['v=spf1 include:_spf.example.com ~all'],
      cname: [],
      hosting: null,
      dnsProvider: null,
    };

    let fetchCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      fetchCount++;
      // We want to simulate an error inside the fetchDns(apex) call.
      // fetchDns calls resolveRecord for 'example.com' on several types.
      if (url.includes('name=example.com')) {
        throw new Error('Simulated network error');
      }

      // Allow _dmarc.sub.example.com to resolve successfully
      if (url.includes('name=_dmarc.sub.example.com')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            Answer: [{ type: 16, data: '"v=DMARC1; p=reject;"' }]
          }),
        } as unknown as Response;
      }

      return {
        ok: true,
        json: () => Promise.resolve({ Answer: [] }),
      } as unknown as Response;
    });

    const result = await fetchEmailAuth('sub.example.com', originalDns);

    // Because fetchDns failed, it should have kept the original dns.mx (which is empty)
    expect(result.hasMx).toBe(false);
    expect(result.mxProvider).toBe(null);

    // It should have kept the original spf record
    expect(result.spf).toBe('v=spf1 include:_spf.example.com ~all');

    // It should resolve dmarc for the original domain (sub.example.com)
    expect(result.dmarc).toBe('v=DMARC1; p=reject;');
    expect(result.dmarcPolicy).toBe('reject');

    // Ensure fetch was actually called, confirming our mock logic executed
    expect(fetchCount).toBeGreaterThan(0);
  });

  it('should successfully fetch apex dns and use it if it has mx records', async () => {
    const originalDns = {
      domain: 'sub.example.com',
      resolves: true,
      a: [],
      aaaa: [],
      ns: [],
      mx: [], // empty mx triggers apex logic
      txt: [],
      cname: [],
      hosting: null,
      dnsProvider: null,
    };

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      // Simulate apex domain having MX records and SPF
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

      // Simulate DMARC on the apex domain
      if (url.includes('name=_dmarc.example.com')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            Answer: [{ type: 16, data: '"v=DMARC1; p=quarantine;"' }]
          }),
        } as unknown as Response;
      }

      return {
        ok: true,
        json: () => Promise.resolve({ Answer: [] }),
      } as unknown as Response;
    });

    const result = await fetchEmailAuth('sub.example.com', originalDns);

    // It should have updated to the apex dns because fetchDns succeeded and returned MX records
    expect(result.hasMx).toBe(true);
    expect(result.mxProvider).toBe('Google');

    // It should have used the spf record from the apex domain
    expect(result.spf).toBe('v=spf1 include:_spf.google.com ~all');

    // It should resolve dmarc for the apex domain (example.com)
    expect(result.dmarc).toBe('v=DMARC1; p=quarantine;');
    expect(result.dmarcPolicy).toBe('quarantine');
  });
});
