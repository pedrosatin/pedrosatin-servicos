/**
 * Fonte única dos tipos do payload de auditoria trocado entre o Worker
 * (`worker/src/`) e o front (`src/lib/`).
 *
 * Só contém `interface`/`type` — zero runtime. Os dois lados importam daqui
 * apenas em tempo de tipo (`import type`), sem bundling cruzado: o Worker
 * continua um deploy isolado. A regra que isto resolve: antes, cada campo
 * vivia duplicado nos dois lados e nada acusava divergência; agora, mudar um
 * campo aqui quebra o `typecheck` do front e o do Worker ao mesmo tempo.
 */

export interface ImageStats {
  total: number;
  withoutAlt: number;
  withoutDimensions: number;
  lazy: number;
}

export interface ScriptStats {
  total: number;
  blocking: number;
  external: number;
}

export interface HtmlReport {
  bytes: number;
  lang: string | null;
  charset: string | null;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonical: string | null;
  robotsMeta: string | null;
  viewport: string | null;
  h1: string[];
  h2Count: number;
  images: ImageStats;
  openGraph: { title: string | null; description: string | null; image: string | null };
  twitterCard: string | null;
  jsonLdTypes: string[];
  favicon: boolean;
  scripts: ScriptStats;
  stylesheets: number;
  inlineStyleBytes: number;
  generator: string | null;
  hreflang: string[];
  wordCount: number;
  platform: string | null;
}

export interface RobotsReport {
  found: boolean;
  blocksAll: boolean;
  sitemaps: string[];
}

export interface RedirectHop {
  url: string;
  status: number;
  location: string | null;
}

export interface SecurityHeaders {
  hsts: string | null;
  contentTypeOptions: string | null;
  frameOptions: string | null;
  csp: string | null;
  referrerPolicy: string | null;
  permissionsPolicy: string | null;
}

export interface SitemapReport {
  found: boolean;
  url: string | null;
  urlCount: number | null;
  isIndex: boolean;
}

/**
 * Corpo devolvido por `GET /audit`. No Worker é o `AuditResponse`; no front é
 * reexportado como `ContentReport` e embutido em `AuditResult`.
 */
export interface AuditResponse {
  ok: boolean;
  error?: string;
  input: string;
  requestedUrl: string;
  finalUrl: string;
  status: number;
  redirects: RedirectHop[];
  servedOverHttps: boolean;
  httpRedirectsToHttps: boolean | null;
  edgeResponseMs: number;
  server: string | null;
  poweredBy: string | null;
  cacheControl: string | null;
  contentEncoding: string | null;
  compressed: boolean;
  securityHeaders: SecurityHeaders;
  html: HtmlReport | null;
  robots: RobotsReport | null;
  sitemap: SitemapReport;
  checkedAt: string;
}
