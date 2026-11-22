
export const normalizeDomain = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^www\./, '');

export const isValidDomain = (domain: string): boolean =>
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain) &&
  domain.includes('.');

export const getApexDomain = (domain: string): string => {
  const parts = domain.toLowerCase().split('.');
  if (parts.length <= 2) return domain;
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  if (tld === 'br' && parts.length >= 3 && sld && sld.length <= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
};

export const googleIndexUrl = (domain: string): string =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:${domain}`)}`;

