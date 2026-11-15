/**
 * Dispatcher do undici para o servidor Node de desenvolvimento.
 *
 * Em produção, o runtime da Cloudflare impede saída para redes privadas. No
 * Node essa barreira não existe, e a resolução local do sistema operacional
 * pode divergir do DoH checado pelo Worker. Este módulo cria um conector
 * que resolve o destino pelo mesmo DoH público, recusa qualquer IP interno ou
 * reservado na hora da conexão e ignora o DNS local para alvos externos.
 */

import { lookup as nodeDnsLookup } from 'node:dns';
import { isIP } from 'node:net';
import { Agent, buildConnector } from 'undici';
import { canonicalHost, ipVerdict, isInternalName, resolveDoh } from './src/index.ts';

const blockedConnectionError = (hostname) =>
  Object.assign(new Error(`Conexão bloqueada para endereço interno ou inválido: ${hostname}`), {
    code: 'ERR_BLOCKED_TARGET',
  });

const notFoundError = (hostname) =>
  Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
    code: 'ENOTFOUND',
  });

/**
 * Verdadeiro quando o destino já é um nome interno conhecido ou um IP literal
 * não público. O Node não chama `lookup` para IPs literais em `net.connect`,
 * então a checagem precisa rodar também antes do conector padrão.
 *
 * @param {string} hostname
 */
export const isBlockedLiteralOrName = (hostname) => {
  const host = canonicalHost(hostname);
  if (!host || isInternalName(host)) return true;
  if (isIP(host) !== 0) return ipVerdict(host) !== false;
  return ipVerdict(host) === true;
};

const toPublicAddressEntries = (ips) => {
  const entries = [];
  for (const rawIp of ips) {
    const address = canonicalHost(rawIp);
    const family = isIP(address);
    if (ipVerdict(address) !== false || (family !== 4 && family !== 6)) return null;
    entries.push({ address, family });
  }
  return entries;
};

const filterByFamily = (entries, family) => {
  if (!entries) return null;
  return family === 4 || family === 6
    ? entries.filter((entry) => entry.family === family)
    : entries;
};

const deliverLookupResult = (entries, hostname, options, callback) => {
  if (!entries) {
    callback(blockedConnectionError(hostname));
    return;
  }
  if (entries.length === 0) {
    callback(notFoundError(hostname));
    return;
  }
  if (options?.all) {
    callback(null, entries);
    return;
  }
  callback(null, entries[0].address, entries[0].family);
};

const resolvePublicViaDoh = async (hostname, dohLookup) => {
  const results = await Promise.allSettled([dohLookup(hostname, 'A'), dohLookup(hostname, 'AAAA')]);
  const ips = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  if (ips.length > 0) return toPublicAddressEntries(ips);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) throw failed.reason;
  return [];
};

const normalizeSystemAddresses = (addressOrList, family) => {
  if (Array.isArray(addressOrList)) return addressOrList.map((entry) => entry.address);
  return typeof addressOrList === 'string' && (family === 4 || family === 6 || isIP(addressOrList) !== 0)
    ? [addressOrList]
    : [];
};

const resolveSystemPublic = (hostname, options, systemLookup, callback) => {
  systemLookup(hostname, { ...options, all: true }, (error, addressOrList, family) => {
    if (error) {
      callback(error);
      return;
    }
    const ips = normalizeSystemAddresses(addressOrList, family);
    const entries = ips.length === 0 ? [] : filterByFamily(toPublicAddressEntries(ips), options?.family);
    deliverLookupResult(entries, hostname, options, callback);
  });
};

/**
 * @typedef {(hostname: string, type: 'A' | 'AAAA') => Promise<string[]>} DohLookup
 * @typedef {{ address: string; family: number }} LookupEntry
 * @typedef {(
 *   error: Error | null,
 *   addressOrList?: string | LookupEntry[],
 *   family?: number,
 * ) => void} LookupCallback
 * @typedef {(
 *   hostname: string,
 *   options: { all?: boolean; family?: number },
 *   callback: LookupCallback,
 * ) => void} SystemLookup
 * @typedef {(
 *   hostname: string,
 *   optionsOrCallback: { all?: boolean; family?: number } | LookupCallback,
 *   callback?: LookupCallback,
 * ) => void} SafeLookup
 * @typedef {(
 *   options: { hostname: string },
 *   callback: (error: Error | null, socket?: unknown) => void,
 * ) => unknown} ConnectorFn
 * @typedef {(options: { lookup: SafeLookup }) => ConnectorFn} BuildConnectorFn
 */

/**
 * Lookup compatível com `net.connect` que resolve destinos via DoH público e
 * falha fechado se qualquer endereço for interno, reservado ou inválido. Só o
 * servidor DoH usa a resolução do sistema, para não haver recursão. O
 * resultado passa pelas mesmas regras de IP público.
 *
 * @param {{
 *   dohLookup?: DohLookup;
 *   systemLookup?: SystemLookup;
 *   dohHostname?: string;
 * }} [options]
 * @returns {SafeLookup}
 */
export const createSafeLookup = ({
  dohLookup = resolveDoh,
  systemLookup = nodeDnsLookup,
  dohHostname = 'cloudflare-dns.com',
} = {}) => (hostname, options, callback) => {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'function' ? {} : (options ?? {});
  const host = canonicalHost(hostname);

  if (isBlockedLiteralOrName(host)) {
    cb(blockedConnectionError(hostname));
    return;
  }

  if (host === dohHostname) {
    resolveSystemPublic(host, opts, systemLookup, cb);
    return;
  }

  resolvePublicViaDoh(host, dohLookup).then(
    (entries) => deliverLookupResult(filterByFamily(entries, opts.family), hostname, opts, cb),
    (error) => cb(error instanceof Error ? error : new Error(String(error))),
  );
};

/**
 * Cria um `Agent` do undici que barra IPs literais privados e fixa toda
 * resolução de hostname ao endereço público retornado pelo DoH.
 *
 * @param {{
 *   dohLookup?: DohLookup;
 *   systemLookup?: SystemLookup;
 *   dohHostname?: string;
 *   buildConnectorFn?: BuildConnectorFn;
 *   [key: string]: unknown;
 * }} [options]
 */
export const createSafeAgent = ({
  dohLookup = resolveDoh,
  systemLookup = nodeDnsLookup,
  dohHostname = 'cloudflare-dns.com',
  buildConnectorFn = buildConnector,
  ...agentOptions
} = {}) => {
  const lookup = createSafeLookup({ dohLookup, systemLookup, dohHostname });
  const baseConnect = buildConnectorFn({ lookup });
  const connect = (options, callback) => {
    if (isBlockedLiteralOrName(options.hostname)) {
      callback(blockedConnectionError(options.hostname));
      return;
    }
    return baseConnect(options, callback);
  };
  return new Agent({ ...agentOptions, connect });
};
