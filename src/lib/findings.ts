/**
 * Converte os dados brutos da auditoria em achados legíveis.
 *
 * Toda regra aqui cita a medição que a originou. Se um dado não foi coletado,
 * nenhum achado é gerado para ele — a ausência de informação nunca vira
 * afirmação.
 */

import type { AuditCoverage, AuditResult, Finding } from './types';

const ms = (value: number | null): string =>
  value === null ? '—' : value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;

const kb = (bytes: number): string =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

export const buildFindings = (result: AuditResult): Finding[] => {
  const out: Finding[] = [];
  const push = (finding: Finding): void => {
    out.push(finding);
  };

  const { content, pagespeed, registration, email, dns } = result;
  const html = content?.html ?? null;

  /* ---------------- Transporte e segurança ---------------- */

  if (content) {
    if (!content.servedOverHttps) {
      push({
        id: 'https-ausente',
        area: 'seguranca',
        severity: 'critical',
        title: 'O site não é entregue por HTTPS',
        evidence: `A resposta final veio de ${content.finalUrl}, sem criptografia.`,
        action:
          'O Chrome marca páginas assim como "Não seguro" e o Google rebaixa o site na busca. Instalar certificado TLS resolve.',
      });
    } else if (content.httpRedirectsToHttps === false) {
      push({
        id: 'http-sem-redirect',
        area: 'seguranca',
        severity: 'warning',
        title: 'A versão sem HTTPS continua acessível',
        evidence: `http://${result.domain} respondeu sem redirecionar para a versão segura.`,
        action:
          'Sem o redirecionamento, o Google pode indexar as duas versões como páginas distintas e dividir a autoridade do site.',
      });
    } else if (content.servedOverHttps) {
      push({
        id: 'https-ok',
        area: 'seguranca',
        severity: 'good',
        title: 'Conexão segura configurada',
        evidence: `O site responde por HTTPS${content.httpRedirectsToHttps ? ' e força o redirecionamento a partir de http://' : ''}.`,
        action: 'Nada a fazer neste ponto.',
      });
    }

    if (content.servedOverHttps && !content.securityHeaders.hsts) {
      push({
        id: 'sem-hsts',
        area: 'seguranca',
        severity: 'info',
        title: 'Cabeçalho HSTS ausente',
        evidence: 'A resposta não traz Strict-Transport-Security.',
        action:
          'Com HSTS o navegador passa a exigir HTTPS já na primeira tentativa, fechando uma janela de interceptação.',
      });
    }

    if (content.poweredBy) {
      push({
        id: 'x-powered-by',
        area: 'seguranca',
        severity: 'info',
        title: 'O servidor expõe a tecnologia usada',
        evidence: `Cabeçalho X-Powered-By: ${content.poweredBy}.`,
        action:
          'Divulgar versão de linguagem ou framework facilita a vida de quem procura vulnerabilidades conhecidas. Remover é trivial.',
      });
    }

    const isCdn = content.server
      ? /cloudflare|vercel|netlify|cloudfront|fastly|akamai/i.test(content.server)
      : false;
    const isCompressed = content.compressed || isCdn;

    if (!isCompressed) {
      push({
        id: 'sem-compressao',
        area: 'desempenho',
        severity: 'warning',
        title: 'O HTML é enviado sem compressão',
        evidence: 'Nenhum Content-Encoding (gzip ou brotli) na resposta.',
        action:
          'Ativar compressão costuma reduzir o HTML em 60% a 80%, com efeito direto no tempo de carregamento em redes móveis.',
      });
    }

    if (!content.cacheControl) {
      push({
        id: 'sem-cache',
        area: 'desempenho',
        severity: 'info',
        title: 'Sem política de cache declarada',
        evidence: 'A resposta não traz Cache-Control.',
        action: 'Cada visita rebaixa tudo do zero, inclusive para quem já esteve no site.',
      });
    }

    if (content.redirects.length > 1) {
      push({
        id: 'redirects-encadeados',
        area: 'desempenho',
        severity: 'warning',
        title: `Cadeia de ${content.redirects.length} redirecionamentos até a página final`,
        evidence: content.redirects.map((hop) => `${hop.status} → ${hop.location}`).join(' | '),
        action:
          'Cada salto custa uma ida e volta de rede antes de qualquer pixel aparecer. O ideal é no máximo um.',
      });
    }
  }

  /* ---------------- Indexação e conteúdo ---------------- */

  if (content?.robots?.blocksAll) {
    push({
      id: 'robots-bloqueia',
      area: 'indexacao',
      severity: 'critical',
      title: 'O robots.txt bloqueia o site inteiro',
      evidence: 'O arquivo contém "Disallow: /" para todos os robôs.',
      action:
        'Enquanto essa linha existir, o Google é instruído a não rastrear nenhuma página. É a causa mais comum de site que some da busca.',
    });
  } else if (content?.robots?.found === false) {
    push({
      id: 'robots-ausente',
      area: 'indexacao',
      severity: 'info',
      title: 'Sem arquivo robots.txt',
      evidence: `Nenhum robots.txt encontrado em ${content.finalUrl}robots.txt.`,
      action: 'Não impede a indexação, mas é onde se aponta o sitemap para os buscadores.',
    });
  }

  if (html?.robotsMeta && /noindex/i.test(html.robotsMeta)) {
    push({
      id: 'meta-noindex',
      area: 'indexacao',
      severity: 'critical',
      title: 'A página pede para não ser indexada',
      evidence: `A meta tag robots contém "${html.robotsMeta}".`,
      action:
        'Essa tag remove a página dos resultados do Google mesmo que todo o resto esteja correto. Costuma ser resquício de ambiente de testes.',
    });
  }

  if (content) {
    if (!content.sitemap.found) {
      push({
        id: 'sitemap-ausente',
        area: 'indexacao',
        severity: 'warning',
        title: 'Nenhum sitemap.xml localizado',
        evidence: 'Não há sitemap em /sitemap.xml nem referência dentro do robots.txt.',
        action:
          'O sitemap é como o Google descobre páginas que não estão linkadas na home. Sem ele, partes do site podem nunca ser rastreadas.',
      });
    } else {
      push({
        id: 'sitemap-ok',
        area: 'indexacao',
        severity: 'good',
        title: 'Sitemap publicado',
        evidence: `${content.sitemap.url} lista ${content.sitemap.urlCount ?? 0} ${content.sitemap.isIndex ? 'sitemaps' : 'endereços'}.`,
        action: 'Nada a fazer neste ponto.',
      });
    }
  }

  if (html) {
    if (!html.title) {
      push({
        id: 'title-ausente',
        area: 'indexacao',
        severity: 'critical',
        title: 'A página não tem título',
        evidence: 'Nenhuma tag <title> foi encontrada no HTML.',
        action:
          'O título é a linha azul clicável no Google. Sem ele, o buscador inventa um texto a partir da página.',
      });
    } else if (html.titleLength > 65) {
      push({
        id: 'title-longo',
        area: 'indexacao',
        severity: 'warning',
        title: 'Título longo demais para o resultado de busca',
        evidence: `${html.titleLength} caracteres: "${html.title}".`,
        action: 'Acima de aproximadamente 60 caracteres o Google corta o texto no meio.',
      });
    } else if (html.titleLength < 20) {
      push({
        id: 'title-curto',
        area: 'indexacao',
        severity: 'warning',
        title: 'Título curto demais',
        evidence: `Apenas ${html.titleLength} caracteres: "${html.title}".`,
        action:
          'Sobra espaço para incluir a atividade e a cidade, que é o que as pessoas realmente digitam na busca.',
      });
    }

    if (!html.metaDescription) {
      push({
        id: 'description-ausente',
        area: 'indexacao',
        severity: 'warning',
        title: 'Sem descrição para o resultado de busca',
        evidence: 'Nenhuma meta description no HTML.',
        action:
          'É o parágrafo exibido abaixo do título no Google. Sem ele o buscador recorta uma frase qualquer da página.',
      });
    } else if (html.metaDescriptionLength > 165) {
      push({
        id: 'description-longa',
        area: 'indexacao',
        severity: 'info',
        title: 'Descrição maior que o espaço disponível',
        evidence: `${html.metaDescriptionLength} caracteres; o Google exibe cerca de 155.`,
        action: 'O texto final aparece cortado com reticências.',
      });
    }

    if (!html.canonical) {
      push({
        id: 'canonical-ausente',
        area: 'indexacao',
        severity: 'warning',
        title: 'Sem URL canônica declarada',
        evidence: 'Nenhuma tag <link rel="canonical"> na página.',
        action:
          'Com www e sem www, com e sem barra final, o mesmo conteúdo vira várias URLs para o Google. A canônica diz qual é a oficial.',
      });
    }

    if (html.h1.length === 0) {
      push({
        id: 'h1-ausente',
        area: 'indexacao',
        severity: 'warning',
        title: 'A página não tem título principal (H1)',
        evidence: 'Nenhuma tag <h1> encontrada no HTML entregue.',
        action:
          'O H1 é o principal sinal de assunto da página. Em sites feitos por construtores visuais, é comum o texto virar apenas um <div> estilizado.',
      });
    } else if (html.h1.length > 1) {
      push({
        id: 'h1-multiplo',
        area: 'indexacao',
        severity: 'info',
        title: `${html.h1.length} títulos principais na mesma página`,
        evidence: html.h1.slice(0, 3).map((text) => `"${text}"`).join(', '),
        action: 'Vários H1 diluem o assunto central da página.',
      });
    }

    if (html.wordCount < 200) {
      push({
        id: 'conteudo-dependente-js',
        area: 'conteudo',
        severity: html.wordCount < 60 ? 'critical' : 'warning',
        title: 'Quase nenhum texto no HTML inicial',
        evidence: `O HTML entregue ao robô tem ${html.wordCount} palavras${html.platform ? ` (plataforma: ${html.platform})` : ''}.`,
        action:
          'Se o conteúdo só aparece depois que o JavaScript roda, o Google precisa de uma segunda visita para enxergá-lo — e nem sempre ela acontece.',
      });
    }

    if (html.jsonLdTypes.length === 0) {
      push({
        id: 'sem-dados-estruturados',
        area: 'indexacao',
        severity: 'info',
        title: 'Sem dados estruturados',
        evidence: 'Nenhum bloco JSON-LD na página.',
        action:
          'Dados estruturados alimentam o painel lateral do Google com endereço, telefone e horário de atendimento.',
      });
    } else {
      push({
        id: 'dados-estruturados-ok',
        area: 'indexacao',
        severity: 'good',
        title: 'Dados estruturados presentes',
        evidence: `Tipos declarados: ${html.jsonLdTypes.join(', ')}.`,
        action: 'Nada a fazer neste ponto.',
      });
    }

    if (!html.openGraph.title || !html.openGraph.image) {
      push({
        id: 'og-ausente',
        area: 'conteudo',
        severity: 'warning',
        title: 'O link não gera prévia ao ser compartilhado',
        evidence: `Open Graph incompleto: ${html.openGraph.title ? 'título presente' : 'sem título'}, ${html.openGraph.image ? 'imagem presente' : 'sem imagem'}.`,
        action:
          'Ao colar o endereço no WhatsApp ou no Instagram, aparece só a URL crua em vez de imagem e descrição.',
      });
    }

    if (!html.viewport) {
      push({
        id: 'viewport-ausente',
        area: 'mobile',
        severity: 'critical',
        title: 'A página não se adapta a celulares',
        evidence: 'Nenhuma meta viewport declarada.',
        action:
          'Sem essa linha o celular renderiza a página em largura de desktop e reduz tudo. O Google avalia o site pela versão móvel.',
      });
    } else if (/maximum-scale|user-scalable\s*=\s*no/i.test(html.viewport)) {
      push({
        id: 'zoom-bloqueado',
        area: 'mobile',
        severity: 'warning',
        title: 'O site impede o visitante de ampliar a tela',
        evidence: `viewport: "${html.viewport}".`,
        action:
          'Bloquear o zoom prejudica quem tem baixa visão e é apontado como falha de acessibilidade nas auditorias do Google.',
      });
    }

    if (html.images.total > 0 && html.images.withoutAlt > 0) {
      push({
        id: 'imagens-sem-alt',
        area: 'conteudo',
        severity: 'info',
        title: `${html.images.withoutAlt} de ${html.images.total} imagens sem texto alternativo`,
        evidence: 'Imagens sem atributo alt no HTML.',
        action:
          'O texto alternativo é o que leitores de tela anunciam e o que permite a imagem aparecer na busca do Google.',
      });
    }

    if (html.images.total > 0 && html.images.withoutDimensions > 0) {
      push({
        id: 'imagens-sem-dimensao',
        area: 'desempenho',
        severity: 'warning',
        title: `${html.images.withoutDimensions} imagens sem largura e altura definidas`,
        evidence: 'Imagens sem os atributos width e height.',
        action:
          'O navegador não reserva o espaço e a página "pula" enquanto carrega, o que faz o visitante clicar no lugar errado.',
      });
    }

    if (html.scripts.blocking > 0) {
      push({
        id: 'scripts-bloqueantes',
        area: 'desempenho',
        severity: html.scripts.blocking > 3 ? 'warning' : 'info',
        title: `${html.scripts.blocking} scripts travam a exibição da página`,
        evidence: `${html.scripts.total} scripts no total, ${html.scripts.external} externos, ${html.scripts.blocking} sem async nem defer.`,
        action:
          'Cada um precisa ser baixado e executado antes de o conteúdo aparecer. Marcar como defer costuma resolver.',
      });
    }

    if (!html.lang) {
      push({
        id: 'lang-ausente',
        area: 'conteudo',
        severity: 'info',
        title: 'Idioma da página não declarado',
        evidence: 'A tag <html> não traz o atributo lang.',
        action: 'Ajuda o Google a servir o site para buscas em português e orienta leitores de tela.',
      });
    }

    if (html.bytes > 500_000) {
      push({
        id: 'html-pesado',
        area: 'desempenho',
        severity: 'warning',
        title: 'HTML muito grande',
        evidence: `O documento tem ${kb(html.bytes)} antes de imagens, scripts e estilos.`,
        action: 'Documentos acima de 500 KB atrasam a primeira renderização em redes móveis.',
      });
    }
  }

  /* ---------------- Desempenho medido pelo Google ---------------- */

  if (pagespeed) {
    const { field, lab, scores } = pagespeed;

    if (field.available && field.lcp.p75 !== null) {
      const seconds = (field.lcp.p75 / 1000).toFixed(1);
      const severity = field.lcp.p75 > 4000 ? 'critical' : field.lcp.p75 > 2500 ? 'warning' : 'good';
      push({
        id: 'lcp-campo',
        area: 'desempenho',
        severity,
        title:
          severity === 'good'
            ? 'Tempo de carregamento aprovado pelo Google'
            : 'Visitantes reais esperam demais pelo conteúdo principal',
        evidence: `${seconds}s no percentil 75 de usuários reais do Chrome${field.origin ? ' (dados de todo o domínio)' : ''}. O limite do Google é 2,5s.`,
        action:
          severity === 'good'
            ? 'Nada a fazer neste ponto.'
            : 'Esta é a métrica que o Google usa como critério de classificação, medida em quem realmente acessa o site — não em simulação.',
      });
    } else if (!field.available) {
      push({
        id: 'sem-dados-campo',
        area: 'desempenho',
        severity: 'info',
        title: 'Sem histórico de usuários reais no Google',
        evidence: 'O relatório CrUX não tem amostra suficiente para este domínio.',
        action:
          'Acontece com sites de baixo tráfego. Indica também que o site recebe poucas visitas vindas da busca.',
      });
    }

    if (field.available && field.cls.p75 !== null && field.cls.p75 > 0.1) {
      push({
        id: 'cls-campo',
        area: 'desempenho',
        severity: field.cls.p75 > 0.25 ? 'critical' : 'warning',
        title: 'O layout se desloca durante o carregamento',
        evidence: `Índice de instabilidade visual de ${field.cls.p75.toFixed(2)} em usuários reais; o aceitável é até 0,10.`,
        action: 'É o efeito de a página "pular" e o visitante clicar sem querer no lugar errado.',
      });
    }

    if (field.available && field.inp.p75 !== null && field.inp.p75 > 200) {
      push({
        id: 'inp-campo',
        area: 'desempenho',
        severity: field.inp.p75 > 500 ? 'critical' : 'warning',
        title: 'O site demora a responder aos toques',
        evidence: `${Math.round(field.inp.p75)}ms entre o toque e a resposta visual; o limite do Google é 200ms.`,
        action: 'A sensação é de travamento, principalmente em celulares mais simples.',
      });
    }

    if (scores.performance !== null) {
      push({
        id: 'score-performance',
        area: 'desempenho',
        severity: scores.performance < 50 ? 'critical' : scores.performance < 90 ? 'warning' : 'good',
        title: `Nota ${scores.performance}/100 em desempenho (${pagespeed.strategy === 'mobile' ? 'celular' : 'computador'})`,
        evidence: `Medição do Lighthouse: maior elemento em ${ms(lab.lcpMs)}, resposta do servidor em ${ms(lab.serverResponseMs)}.`,
        action:
          scores.performance < 90
            ? 'Esta é a mesma nota que qualquer pessoa vê ao consultar o PageSpeed Insights do Google para o seu endereço.'
            : 'Nada a fazer neste ponto.',
      });
    }

    if (scores.seo !== null && scores.seo < 90) {
      push({
        id: 'score-seo',
        area: 'indexacao',
        severity: scores.seo < 70 ? 'warning' : 'info',
        title: `Nota ${scores.seo}/100 nas verificações de SEO do Google`,
        evidence: 'Avaliação automática do Lighthouse sobre a estrutura da página.',
        action: 'Cobre itens básicos de rastreamento que costumam ser rápidos de corrigir.',
      });
    }

    if (scores.accessibility !== null && scores.accessibility < 90) {
      push({
        id: 'score-acessibilidade',
        area: 'conteudo',
        severity: scores.accessibility < 70 ? 'warning' : 'info',
        title: `Nota ${scores.accessibility}/100 em acessibilidade`,
        evidence: 'Contraste de cores, rótulos de formulário e navegação por teclado avaliados pelo Lighthouse.',
        action:
          'Além da questão de inclusão, esses itens afetam a leitura do site por qualquer pessoa em tela pequena e sob sol forte.',
      });
    }

    if (lab.totalBytes !== null && lab.totalBytes > 2_000_000) {
      push({
        id: 'peso-total',
        area: 'desempenho',
        severity: 'warning',
        title: 'A página pesa mais que o razoável para dados móveis',
        evidence: `${kb(lab.totalBytes)} baixados em um único acesso.`,
        action: 'Em 4G instável isso significa vários segundos de tela em branco.',
      });
    }
  }

  /* ---------------- Domínio ---------------- */

  if (registration?.found) {
    const days = registration.daysToExpire;
    if (days !== null && days < 0) {
      push({
        id: 'dominio-vencido',
        area: 'dominio',
        severity: 'critical',
        title: 'O registro do domínio está vencido',
        evidence: `Vencimento em ${formatDate(registration.expiresAt)}, há ${Math.abs(days)} dias.`,
        action: 'Domínio vencido pode ser liberado para terceiros. É o item mais urgente da lista.',
      });
    } else if (days !== null && days < 45) {
      push({
        id: 'dominio-vencendo',
        area: 'dominio',
        severity: 'critical',
        title: `O domínio vence em ${days} dias`,
        evidence: `Registro válido até ${formatDate(registration.expiresAt)}, segundo ${registration.source === 'registro.br' ? 'o Registro.br' : 'a consulta RDAP oficial'}.`,
        action: 'Site e e-mails param no dia do vencimento. A renovação é feita direto no registrador.',
      });
    } else if (days !== null && days < 120) {
      push({
        id: 'dominio-renovacao-proxima',
        area: 'dominio',
        severity: 'warning',
        title: `Renovação do domínio em ${days} dias`,
        evidence: `Registro válido até ${formatDate(registration.expiresAt)}.`,
        action: 'Vale conferir se o cartão cadastrado no registrador continua válido.',
      });
    } else if (days !== null) {
      push({
        id: 'dominio-ok',
        area: 'dominio',
        severity: 'good',
        title: 'Registro do domínio em dia',
        evidence: `Válido até ${formatDate(registration.expiresAt)} (${days} dias), registrado em ${formatDate(registration.registeredAt)}.`,
        action: 'Nada a fazer neste ponto.',
      });
    }

    if (!registration.dnssec && registration.source === 'registro.br') {
      push({
        id: 'sem-dnssec',
        area: 'seguranca',
        severity: 'info',
        title: 'DNSSEC não está ativo',
        evidence: 'O domínio não tem assinatura DNSSEC delegada.',
        action:
          'O Registro.br oferece DNSSEC sem custo adicional. Ele impede que respostas de DNS sejam falsificadas no caminho.',
      });
    }
  }

  if (email) {
    if (!email.hasMx) {
      push({
        id: 'sem-email-proprio',
        area: 'dominio',
        severity: 'info',
        title: 'O domínio não recebe e-mails',
        evidence: 'Nenhum registro MX configurado.',
        action:
          'Significa que o contato ainda usa endereço de Gmail ou Hotmail em vez de um e-mail no próprio domínio.',
      });
    } else {
      if (!email.spf) {
        push({
          id: 'sem-spf',
          area: 'seguranca',
          severity: 'warning',
          title: 'Qualquer pessoa pode enviar e-mail se passando pelo seu domínio',
          evidence: `O domínio recebe e-mails${email.mxProvider ? ` via ${email.mxProvider}` : ''}, mas não publica registro SPF.`,
          action:
            'Sem SPF nada impede um golpista de mandar mensagem como se fosse do seu endereço, e seus próprios e-mails tendem a cair no spam.',
        });
      }
      if (!email.dmarc) {
        push({
          id: 'sem-dmarc',
          area: 'seguranca',
          severity: 'warning',
          title: 'Sem política DMARC publicada',
          evidence: 'Nenhum registro TXT em _dmarc.' + result.domain + '.',
          action:
            'O DMARC diz aos provedores o que fazer com mensagens falsificadas. Gmail e Outlook passaram a exigi-lo de quem envia em volume.',
        });
      } else if (email.dmarcPolicy === 'none') {
        push({
          id: 'dmarc-permissivo',
          area: 'seguranca',
          severity: 'info',
          title: 'DMARC configurado apenas em modo de observação',
          evidence: `Política declarada: p=none.`,
          action: 'Nesse modo os relatórios chegam, mas mensagens falsificadas continuam sendo entregues.',
        });
      }
    }
  }

  if (dns && !dns.resolves) {
    push({
      id: 'dns-nao-resolve',
      area: 'dominio',
      severity: 'critical',
      title: 'O domínio não aponta para nenhum servidor',
      evidence: 'Nenhum registro A ou AAAA encontrado.',
      action:
        'O endereço existe mas não leva a lugar algum. Costuma ser domínio registrado sem hospedagem configurada.',
    });
  }

  const weight = { critical: 0, warning: 1, info: 2, good: 3 } as const;
  return out.sort((a, b) => weight[a.severity] - weight[b.severity]);
};

/**
 * A nota só existe quando as fontes essenciais responderam. Se a leitura do
 * HTML ou a medição do Google falharem, não há base para pontuar: a ausência de
 * defeitos encontrados significaria apenas que nada foi olhado.
 */
export const scoreFromFindings = (
  findings: Finding[],
  coverage?: AuditCoverage,
): { value: number; label: string } | null => {
  if (coverage && !coverage.complete) return null;

  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === 'critical') return total + 15;
    if (finding.severity === 'warning') return total + 6;
    if (finding.severity === 'info') return total + 1.5;
    return total;
  }, 0);

  const value = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const label =
    value >= 85 ? 'Bem resolvido' : value >= 65 ? 'Ajustes pontuais' : value >= 40 ? 'Precisa de atenção' : 'Situação crítica';

  return { value, label };
};

export const countBySeverity = (findings: Finding[]) => ({
  critical: findings.filter((f) => f.severity === 'critical').length,
  warning: findings.filter((f) => f.severity === 'warning').length,
  info: findings.filter((f) => f.severity === 'info').length,
  good: findings.filter((f) => f.severity === 'good').length,
});

export const AREA_LABELS: Record<Finding['area'], string> = {
  indexacao: 'Indexação no Google',
  desempenho: 'Desempenho',
  mobile: 'Celular',
  seguranca: 'Segurança',
  dominio: 'Domínio',
  conteudo: 'Conteúdo',
};
