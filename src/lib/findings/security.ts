import type { AuditResult, ContentReport, Finding } from '../types';

const checkHttps = (content: ContentReport, domain: string): Finding | undefined => {
  if (!content.servedOverHttps) {
    return {
      id: 'https-ausente',
      area: 'seguranca',
      severity: 'critical',
      title: 'O site não é entregue por HTTPS',
      evidence: `A resposta final veio de ${content.finalUrl}, sem criptografia.`,
      action:
        'O Chrome marca páginas assim como "Não seguro" e o Google rebaixa o site na busca. Instalar certificado TLS resolve.',
    };
  }
  if (content.httpRedirectsToHttps === false) {
    return {
      id: 'http-sem-redirect',
      area: 'seguranca',
      severity: 'warning',
      title: 'A versão sem HTTPS continua acessível',
      evidence: `http://${domain} respondeu sem redirecionar para a versão segura.`,
      action:
        'Sem o redirecionamento, o Google pode indexar as duas versões como páginas distintas e dividir a autoridade do site.',
    };
  }
  if (content.servedOverHttps) {
    return {
      id: 'https-ok',
      area: 'seguranca',
      severity: 'good',
      title: 'Conexão segura configurada',
      evidence: `O site responde por HTTPS${content.httpRedirectsToHttps ? ' e força o redirecionamento a partir de http://' : ''}.`,
      action: 'Nada a fazer neste ponto.',
    };
  }
  return undefined;
};

const checkHsts = (content: ContentReport): Finding | undefined => {
  if (content.servedOverHttps && !content.securityHeaders.hsts) {
    return {
      id: 'sem-hsts',
      area: 'seguranca',
      severity: 'info',
      title: 'Cabeçalho HSTS ausente',
      evidence: 'A resposta não traz Strict-Transport-Security.',
      action:
        'Com HSTS o navegador passa a exigir HTTPS já na primeira tentativa, fechando uma janela de interceptação.',
    };
  }
  return undefined;
};

const checkPoweredBy = (content: ContentReport): Finding | undefined => {
  if (content.poweredBy) {
    return {
      id: 'x-powered-by',
      area: 'seguranca',
      severity: 'info',
      title: 'O servidor expõe a tecnologia usada',
      evidence: `Cabeçalho X-Powered-By: ${content.poweredBy}.`,
      action:
        'Divulgar versão de linguagem ou framework facilita a vida de quem procura vulnerabilidades conhecidas. Remover é trivial.',
    };
  }
  return undefined;
};

const checkCompression = (content: ContentReport): Finding | undefined => {
  const isCdn = content.server
    ? /cloudflare|vercel|netlify|cloudfront|fastly|akamai/i.test(content.server)
    : false;
  const isCompressed = content.compressed || isCdn;

  if (!isCompressed) {
    return {
      id: 'sem-compressao',
      area: 'desempenho',
      severity: 'warning',
      title: 'O HTML é enviado sem compressão',
      evidence: 'Nenhum Content-Encoding (gzip ou brotli) na resposta.',
      action:
        'Ativar compressão costuma reduzir o HTML em 60% a 80%, com efeito direto no tempo de carregamento em redes móveis.',
    };
  }
  return undefined;
};

const checkCacheControl = (content: ContentReport): Finding | undefined => {
  if (!content.cacheControl) {
    return {
      id: 'sem-cache',
      area: 'desempenho',
      severity: 'info',
      title: 'Sem política de cache declarada',
      evidence: 'A resposta não traz Cache-Control.',
      action: 'Cada visita rebaixa tudo do zero, inclusive para quem já esteve no site.',
    };
  }
  return undefined;
};

const checkRedirectChain = (content: ContentReport): Finding | undefined => {
  if (content.redirects.length > 1) {
    return {
      id: 'redirects-encadeados',
      area: 'desempenho',
      severity: 'warning',
      title: `Cadeia de ${content.redirects.length} redirecionamentos até a página final`,
      evidence: content.redirects.map((hop) => `${hop.status} → ${hop.location}`).join(' | '),
      action:
        'Cada salto custa uma ida e volta de rede antes de qualquer pixel aparecer. O ideal é no máximo um.',
    };
  }
  return undefined;
};

export const buildSecurityFindings = (result: AuditResult): Finding[] => {
  const out: Finding[] = [];
  const { content } = result;
  if (!content) return out;

  const https = checkHttps(content, result.domain);
  if (https) out.push(https);
  const hsts = checkHsts(content);
  if (hsts) out.push(hsts);
  const poweredBy = checkPoweredBy(content);
  if (poweredBy) out.push(poweredBy);
  const compression = checkCompression(content);
  if (compression) out.push(compression);
  const cache = checkCacheControl(content);
  if (cache) out.push(cache);
  const redirects = checkRedirectChain(content);
  if (redirects) out.push(redirects);

  return out;
};
