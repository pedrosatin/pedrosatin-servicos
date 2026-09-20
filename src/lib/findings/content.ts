import type { AuditResult, Finding, ContentReport, HtmlReport } from "../types";
import { kb } from "./utils";

export const NOINDEX_ACTION_MESSAGE =
  "Essa tag remove a página dos resultados do Google mesmo que todo o resto esteja correto. Costuma ser resquício de ambiente de testes.";

const checkRobots = (
  content: ContentReport | null,
  html: HtmlReport | null,
  push: (finding: Finding) => void,
): void => {
  if (content?.robots?.blocksAll) {
    push({
      id: "robots-bloqueia",
      area: "indexacao",
      severity: "critical",
      title: "O robots.txt bloqueia o site inteiro",
      evidence: 'O arquivo contém "Disallow: /" para todos os robôs.',
      action:
        "Enquanto essa linha existir, o Google é instruído a não rastrear nenhuma página. É a causa mais comum de site que some da busca.",
    });
  } else if (content?.robots?.found === false) {
    push({
      id: "robots-ausente",
      area: "indexacao",
      severity: "info",
      title: "Sem arquivo robots.txt",
      evidence: `Nenhum robots.txt encontrado em ${content.finalUrl}robots.txt.`,
      action:
        "Não impede a indexação, mas é onde se aponta o sitemap para os buscadores.",
    });
  }

  if (html?.robotsMeta && /noindex/i.test(html.robotsMeta)) {
    push({
      id: "meta-noindex",
      area: "indexacao",
      severity: "critical",
      title: "A página pede para não ser indexada",
      evidence: `A meta tag robots contém "${html.robotsMeta}".`,
      action: NOINDEX_ACTION_MESSAGE,
    });
  }
};

const checkSitemap = (
  content: ContentReport | null,
  push: (finding: Finding) => void,
): void => {
  if (content) {
    if (!content.sitemap.found) {
      push({
        id: "sitemap-ausente",
        area: "indexacao",
        severity: "warning",
        title: "Nenhum sitemap.xml localizado",
        evidence:
          "Não há sitemap em /sitemap.xml nem referência dentro do robots.txt.",
        action:
          "O sitemap é como o Google descobre páginas que não estão linkadas na home. Sem ele, partes do site podem nunca ser rastreadas.",
      });
    } else {
      push({
        id: "sitemap-ok",
        area: "indexacao",
        severity: "good",
        title: "Sitemap publicado",
        evidence: `${content.sitemap.url} lista ${content.sitemap.urlCount ?? 0} ${content.sitemap.isIndex ? "sitemaps" : "endereços"}.`,
        action: "Nada a fazer neste ponto.",
      });
    }
  }
};

const checkMetaTags = (
  html: HtmlReport | null,
  push: (finding: Finding) => void,
): void => {
  if (!html) return;
  if (!html.title) {
    push({
      id: "title-ausente",
      area: "indexacao",
      severity: "critical",
      title: "A página não tem título",
      evidence: "Nenhuma tag <title> foi encontrada no HTML.",
      action:
        "O título é a linha azul clicável no Google. Sem ele, o buscador inventa um texto a partir da página.",
    });
  } else if (html.titleLength > 65) {
    push({
      id: "title-longo",
      area: "indexacao",
      severity: "warning",
      title: "Título longo demais para o resultado de busca",
      evidence: `${html.titleLength} caracteres: "${html.title}".`,
      action:
        "Acima de aproximadamente 60 caracteres o Google corta o texto no meio.",
    });
  } else if (html.titleLength < 20) {
    push({
      id: "title-curto",
      area: "indexacao",
      severity: "warning",
      title: "Título curto demais",
      evidence: `Apenas ${html.titleLength} caracteres: "${html.title}".`,
      action:
        "Sobra espaço para incluir a atividade e a cidade, que é o que as pessoas realmente digitam na busca.",
    });
  }

  if (!html.metaDescription) {
    push({
      id: "description-ausente",
      area: "indexacao",
      severity: "warning",
      title: "Sem descrição para o resultado de busca",
      evidence: "Nenhuma meta description no HTML.",
      action:
        "É o parágrafo exibido abaixo do título no Google. Sem ele o buscador recorta uma frase qualquer da página.",
    });
  } else if (html.metaDescriptionLength > 165) {
    push({
      id: "description-longa",
      area: "indexacao",
      severity: "info",
      title: "Descrição maior que o espaço disponível",
      evidence: `${html.metaDescriptionLength} caracteres; o Google exibe cerca de 155.`,
      action: "O texto final aparece cortado com reticências.",
    });
  }

  if (!html.canonical) {
    push({
      id: "canonical-ausente",
      area: "indexacao",
      severity: "warning",
      title: "Sem URL canônica declarada",
      evidence: 'Nenhuma tag <link rel="canonical"> na página.',
      action:
        "Com www e sem www, com e sem barra final, o mesmo conteúdo vira várias URLs para o Google. A canônica diz qual é a oficial.",
    });
  }

  if (!html.lang) {
    push({
      id: "lang-ausente",
      area: "conteudo",
      severity: "info",
      title: "Idioma da página não declarado",
      evidence: "A tag <html> não traz o atributo lang.",
      action:
        "Ajuda o Google a servir o site para buscas em português e orienta leitores de tela.",
    });
  }
};

const checkHeadingsAndContent = (
  html: HtmlReport | null,
  push: (finding: Finding) => void,
): void => {
  if (!html) return;
  if (html.h1.length === 0) {
    push({
      id: "h1-ausente",
      area: "indexacao",
      severity: "warning",
      title: "A página não tem título principal (H1)",
      evidence: "Nenhuma tag <h1> encontrada no HTML entregue.",
      action:
        "O H1 é o principal sinal de assunto da página. Em sites feitos por construtores visuais, é comum o texto virar apenas um <div> estilizado.",
    });
  } else if (html.h1.length > 1) {
    push({
      id: "h1-multiplo",
      area: "indexacao",
      severity: "info",
      title: `${html.h1.length} títulos principais na mesma página`,
      evidence: html.h1
        .slice(0, 3)
        .map((text) => `"${text}"`)
        .join(", "),
      action: "Vários H1 diluem o assunto central da página.",
    });
  }

  if (html.wordCount < 200) {
    push({
      id: "conteudo-dependente-js",
      area: "conteudo",
      severity: html.wordCount < 60 ? "critical" : "warning",
      title: "Quase nenhum texto no HTML inicial",
      evidence: `O HTML entregue ao robô tem ${html.wordCount} palavras${html.platform ? ` (plataforma: ${html.platform})` : ""}.`,
      action:
        "Se o conteúdo só aparece depois que o JavaScript roda, o Google precisa de uma segunda visita para enxergá-lo — e nem sempre ela acontece.",
    });
  }
};

const checkStructuredData = (
  html: HtmlReport | null,
  push: (finding: Finding) => void,
): void => {
  if (!html) return;
  if (html.jsonLdTypes.length === 0) {
    push({
      id: "sem-dados-estruturados",
      area: "indexacao",
      severity: "info",
      title: "Sem dados estruturados",
      evidence: "Nenhum bloco JSON-LD na página.",
      action:
        "Dados estruturados alimentam o painel lateral do Google com endereço, telefone e horário de atendimento.",
    });
  } else {
    push({
      id: "dados-estruturados-ok",
      area: "indexacao",
      severity: "good",
      title: "Dados estruturados presentes",
      evidence: `Tipos declarados: ${html.jsonLdTypes.join(", ")}.`,
      action: "Nada a fazer neste ponto.",
    });
  }
};

const checkSocial = (
  html: HtmlReport | null,
  push: (finding: Finding) => void,
): void => {
  if (!html) return;
  if (!html.openGraph.title || !html.openGraph.image) {
    push({
      id: "og-ausente",
      area: "conteudo",
      severity: "warning",
      title: "O link não gera prévia ao ser compartilhado",
      evidence: `Open Graph incompleto: ${html.openGraph.title ? "título presente" : "sem título"}, ${html.openGraph.image ? "imagem presente" : "sem imagem"}.`,
      action:
        "Ao colar o endereço no WhatsApp ou no Instagram, aparece só a URL crua em vez de imagem e descrição.",
    });
  }
};

const checkMobile = (
  html: HtmlReport | null,
  push: (finding: Finding) => void,
): void => {
  if (!html) return;
  if (!html.viewport) {
    push({
      id: "viewport-ausente",
      area: "mobile",
      severity: "critical",
      title: "A página não se adapta a celulares",
      evidence: "Nenhuma meta viewport declarada.",
      action:
        "Sem essa linha o celular renderiza a página em largura de desktop e reduz tudo. O Google avalia o site pela versão móvel.",
    });
  } else if (/maximum-scale|user-scalable\s*=\s*no/i.test(html.viewport)) {
    push({
      id: "zoom-bloqueado",
      area: "mobile",
      severity: "warning",
      title: "O site impede o visitante de ampliar a tela",
      evidence: `viewport: "${html.viewport}".`,
      action:
        "Bloquear o zoom prejudica quem tem baixa visão e é apontado como falha de acessibilidade nas auditorias do Google.",
    });
  }
};

const checkAssets = (
  html: HtmlReport | null,
  push: (finding: Finding) => void,
): void => {
  if (!html) return;
  if (html.images.total > 0 && html.images.withoutAlt > 0) {
    push({
      id: "imagens-sem-alt",
      area: "conteudo",
      severity: "info",
      title: `${html.images.withoutAlt} de ${html.images.total} imagens sem texto alternativo`,
      evidence: "Imagens sem atributo alt no HTML.",
      action:
        "O texto alternativo é o que leitores de tela anunciam e o que permite a imagem aparecer na busca do Google.",
    });
  }

  if (html.images.total > 0 && html.images.withoutDimensions > 0) {
    push({
      id: "imagens-sem-dimensao",
      area: "desempenho",
      severity: "warning",
      title: `${html.images.withoutDimensions} imagens sem largura e altura definidas`,
      evidence: "Imagens sem os atributos width e height.",
      action:
        'O navegador não reserva o espaço e a página "pula" enquanto carrega, o que faz o visitante clicar no lugar errado.',
    });
  }

  if (html.scripts.blocking > 0) {
    push({
      id: "scripts-bloqueantes",
      area: "desempenho",
      severity: html.scripts.blocking > 3 ? "warning" : "info",
      title: `${html.scripts.blocking} scripts travam a exibição da página`,
      evidence: `${html.scripts.total} scripts no total, ${html.scripts.external} externos, ${html.scripts.blocking} sem async nem defer.`,
      action:
        "Cada um precisa ser baixado e executado antes de o conteúdo aparecer. Marcar como defer costuma resolver.",
    });
  }

  if (html.bytes > 500_000) {
    push({
      id: "html-pesado",
      area: "desempenho",
      severity: "warning",
      title: "HTML muito grande",
      evidence: `O documento tem ${kb(html.bytes)} antes de imagens, scripts e estilos.`,
      action:
        "Documentos acima de 500 KB atrasam a primeira renderização em redes móveis.",
    });
  }
};

export const buildContentFindings = (
  result: AuditResult,
  push: (finding: Finding) => void,
): void => {
  const { content } = result;
  const html = content?.html ?? null;

  checkRobots(content, html, push);
  checkSitemap(content, push);
  checkMetaTags(html, push);
  checkHeadingsAndContent(html, push);
  checkStructuredData(html, push);
  checkSocial(html, push);
  checkMobile(html, push);
  checkAssets(html, push);
};
