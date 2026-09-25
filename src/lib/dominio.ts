/**
 * Funções de domínio que não fazem rede.
 *
 * Elas moram fora de `sources.ts` por um motivo de carregamento: a página usa
 * `normalizeDomain` e `isValidDomain` já na primeira digitação, enquanto o
 * resto de `sources.ts` só serve depois que a análise começa. Se estivessem no
 * mesmo arquivo, o import estático destas arrastaria todo o motor de consultas
 * para o pacote que abre a página, e o `import()` dinâmico de `audit.ts` não
 * teria o que separar.
 */

/** Remove protocolo, caminho e www para obter o domínio registrável. */
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

/**
 * Extrai o domínio raiz (apex) a partir de um subdomínio (ex.: servicos.pedrosatin.com -> pedrosatin.com).
 */
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

/**
 * O Google não expõe API pública de contagem de resultados, e raspar a busca
 * violaria os termos de uso. O caminho honesto é levar a pessoa direto ao
 * operador `site:` para que ela mesma veja o resultado.
 */
export const googleIndexUrl = (domain: string): string =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:${domain}`)}`;

