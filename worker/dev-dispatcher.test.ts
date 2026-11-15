// @vitest-environment node
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fetch as undiciFetch } from 'undici';
import { createSafeAgent, createSafeLookup, isBlockedLiteralOrName } from './dev-dispatcher.mjs';

type LookupCallback = (
  error: Error | null,
  addressOrList?: string | { address: string; family: number }[],
  family?: number,
) => void;

const runLookup = (
  lookupFn: ReturnType<typeof createSafeLookup>,
  hostname: string,
  options?: { all?: boolean; family?: number },
) =>
  new Promise<{ address?: string; family?: number; list?: { address: string; family: number }[] }>((resolve, reject) => {
    const cb: LookupCallback = (error, addressOrList, family) => {
      if (error) {
        reject(error);
        return;
      }
      if (Array.isArray(addressOrList)) {
        resolve({ list: addressOrList });
        return;
      }
      resolve({ address: addressOrList, family });
    };
    if (options === undefined) {
      lookupFn(hostname, cb);
      return;
    }
    lookupFn(hostname, options, cb);
  });

describe('dev-dispatcher', () => {
  let loopbackPort = 0;
  let loopbackHits = 0;
  const server = createServer((_req, res) => {
    loopbackHits += 1;
    res.writeHead(200);
    res.end('local-secret');
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        loopbackPort = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('ignora resolução local para 127.0.0.1 quando o DoH responde IP público', async () => {
    loopbackHits = 0;
    const systemLookup = vi.fn((_host: string, _opts: unknown, cb: LookupCallback) => {
      cb(null, [{ address: '127.0.0.1', family: 4 }]);
    });
    const dohLookup = vi.fn(async (_name: string, type: 'A' | 'AAAA') =>
      type === 'A' ? ['93.184.215.14'] : [],
    );

    const lookup = createSafeLookup({ dohLookup, systemLookup });
    const allResult = await runLookup(lookup, 'evil.example', { all: true });
    expect(allResult.list).toEqual([{ address: '93.184.215.14', family: 4 }]);
    expect(systemLookup).not.toHaveBeenCalled();

    const singleResult = await runLookup(lookup, 'evil.example');
    expect(singleResult).toEqual({ address: '93.184.215.14', family: 4 });

    const observedAddresses: { address: string; family: number }[][] = [];
    const buildConnectorFn = vi.fn(({ lookup: agentLookup }: { lookup: ReturnType<typeof createSafeLookup> }) => {
      return (opts: { hostname: string }, cb: (err: Error | null, socket?: unknown) => void) => {
        agentLookup(opts.hostname, { all: true }, (err, list) => {
          if (err) {
            cb(err);
            return;
          }
          observedAddresses.push(list as { address: string; family: number }[]);
          cb(new Error('captured-without-network'));
        });
      };
    });

    const agent = createSafeAgent({ dohLookup, systemLookup, buildConnectorFn });
    await expect(
      undiciFetch(`http://evil.example:${loopbackPort}/`, { dispatcher: agent }),
    ).rejects.toThrow();
    await agent.close();

    expect(observedAddresses).toEqual([[{ address: '93.184.215.14', family: 4 }]]);
    expect(loopbackHits).toBe(0);
  });

  it('recusa conexão para IPs literais internos e nomes locais antes de abrir socket', async () => {
    loopbackHits = 0;
    const dohLookup = vi.fn(async () => ['93.184.215.14']);
    const agent = createSafeAgent({ dohLookup });

    const blockedUrls = [
      `http://127.0.0.1:${loopbackPort}/`,
      `http://[::1]:${loopbackPort}/`,
      `http://localhost:${loopbackPort}/`,
      `http://app.localhost:${loopbackPort}/`,
      `http://printer.local:${loopbackPort}/`,
      `http://metadata.internal:${loopbackPort}/`,
      `http://router.home.arpa:${loopbackPort}/`,
    ];

    for (const url of blockedUrls) {
      await expect(undiciFetch(url, { dispatcher: agent }), url).rejects.toThrow();
    }

    await agent.close();
    expect(dohLookup).not.toHaveBeenCalled();
    expect(loopbackHits).toBe(0);
    expect(isBlockedLiteralOrName('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedLiteralOrName('fe80::1%eth0')).toBe(true);
    expect(isBlockedLiteralOrName('93.184.215.14')).toBe(false);
  });

  it('recusa IPs privados, reservados ou inválidos retornados pelo DoH', async () => {
    loopbackHits = 0;
    const blockedAnswers = [
      ['127.0.0.1'],
      ['10.0.0.1'],
      ['172.16.0.1'],
      ['192.168.1.1'],
      ['169.254.169.254'],
      ['100.64.0.1'],
      ['::1'],
      ['fc00::1'],
      ['fe80::1'],
      ['::ffff:127.0.0.1'],
      ['64:ff9b::10.0.0.1'],
      ['2002:7f00:1::1'],
      ['not-an-ip'],
      ['93.184.215.14', '127.0.0.1'],
    ];

    for (const answers of blockedAnswers) {
      const dohLookup = vi.fn(async (_name: string, type: 'A' | 'AAAA') =>
        type === 'A' ? answers : [],
      );
      const agent = createSafeAgent({ dohLookup });
      await expect(
        undiciFetch(`http://rebind.example:${loopbackPort}/`, { dispatcher: agent }),
        answers.join(','),
      ).rejects.toThrow();
      await agent.close();
    }

    expect(loopbackHits).toBe(0);
  });

  it('aceita IP público quando uma consulta DoH falha mas a outra traz endereço público', async () => {
    const dohLookup = vi.fn(async (_name: string, type: 'A' | 'AAAA') => {
      if (type === 'AAAA') throw new Error('AAAA servfail');
      return ['93.184.215.14'];
    });
    const lookup = createSafeLookup({ dohLookup });

    const result = await runLookup(lookup, 'example.com', { all: true });
    expect(result.list).toEqual([{ address: '93.184.215.14', family: 4 }]);
  });

  it('filtra por família IPv4/IPv6 e falha fechado quando DoH não traz endereço', async () => {
    const dualStack = createSafeLookup({
      dohLookup: async (_name, type) => (type === 'A' ? ['93.184.215.14'] : ['2606:4700:4700::1111']),
    });
    expect(await runLookup(dualStack, 'dual.example', { all: true, family: 6 })).toEqual({
      list: [{ address: '2606:4700:4700::1111', family: 6 }],
    });

    const v4Only = createSafeLookup({
      dohLookup: async (_name, type) => (type === 'A' ? ['93.184.215.14'] : []),
    });
    await expect(runLookup(v4Only, 'v4.example', { all: true, family: 6 })).rejects.toMatchObject({
      code: 'ENOTFOUND',
    });

    const empty = createSafeLookup({ dohLookup: async () => [] });
    await expect(runLookup(empty, 'nxdomain.example', { all: true })).rejects.toMatchObject({
      code: 'ENOTFOUND',
    });

    const failing = createSafeLookup({
      dohLookup: async () => {
        throw new Error('DoH indisponível');
      },
    });
    await expect(runLookup(failing, 'outage.example', { all: true })).rejects.toThrow('DoH indisponível');
  });

  it('permite IP literal público no conector sem chamar DNS', async () => {
    const baseConnect = vi.fn((_opts: unknown, cb: (err: Error | null) => void) => {
      cb(new Error('reached-base-connector'));
    });
    const buildConnectorFn = vi.fn(() => baseConnect);
    const agent = createSafeAgent({ buildConnectorFn });

    await expect(undiciFetch('http://93.184.215.14/', { dispatcher: agent })).rejects.toThrow();
    await agent.close();

    expect(baseConnect).toHaveBeenCalledTimes(1);
  });

  it('protege a resolução de cloudflare-dns.com contra IPs internos do sistema', async () => {
    const localSpoof = createSafeLookup({
      systemLookup: (_host, _opts, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]),
    });
    await expect(runLookup(localSpoof, 'cloudflare-dns.com', { all: true })).rejects.toMatchObject({
      code: 'ERR_BLOCKED_TARGET',
    });

    const publicTuple = createSafeLookup({
      systemLookup: (_host, _opts, cb) => cb(null, '1.1.1.1', 4),
    });
    expect(await runLookup(publicTuple, 'cloudflare-dns.com', { all: true })).toEqual({
      list: [{ address: '1.1.1.1', family: 4 }],
    });

    const systemError = createSafeLookup({
      systemLookup: (_host, _opts, cb) => cb(new Error('dns offline')),
    });
    await expect(runLookup(systemError, 'cloudflare-dns.com', { all: true })).rejects.toThrow('dns offline');
  });
});
