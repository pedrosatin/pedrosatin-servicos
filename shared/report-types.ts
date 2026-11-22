
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
  error?: string;
}

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
