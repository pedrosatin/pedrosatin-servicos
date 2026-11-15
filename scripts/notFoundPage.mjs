/**
 * Gera o HTML estático de `dist/404.html` a partir da casca do build.
 *
 * Reaproveita a folha de estilo com hash e o preload das fontes sem carregar
 * o bundle JavaScript nem repetir metadados canônicos e sociais da home.
 */

export const ROOT_MARKER = '<div id="root"></div>';

const TITLE_404 = '<title>Página não encontrada | Pedro Satin</title>';
const ROBOTS_NOINDEX = '<meta name="robots" content="noindex" />';

/** Marcação estática da página 404 no visual da landing page. */
export function buildNotFoundMarkup() {
  return [
    '<div class="lp lp-not-found">',
    '  <header class="lp-header">',
    '    <div class="lp-wrap lp-header-inner">',
    '      <a href="/" class="lp-brand">',
    '        <span class="lp-brand-mark">ps</span>',
    '        <span class="lp-brand-text">',
    '          <span class="lp-brand-name">Pedro Satin</span>',
    '          <span class="lp-brand-role">engenharia web</span>',
    '        </span>',
    '      </a>',
    '    </div>',
    '  </header>',
    '  <main class="lp-main lp-404">',
    '    <div class="lp-wrap lp-404-wrap">',
    '      <p class="lp-eyebrow">Erro 404</p>',
    '      <h1 class="lp-title">Página não encontrada</h1>',
    '      <p class="lp-lede">',
    '        Este endereço não existe ou mudou de lugar. Volte para a página inicial ou teste um endereço na análise técnica.',
    '      </p>',
    '      <div class="lp-terminal lp-404-terminal">',
    '        <div class="lp-terminal-bar">',
    '          <div class="lp-terminal-dots" aria-hidden="true"><span></span><span></span><span></span></div>',
    '          <span class="lp-terminal-title">resposta http</span>',
    '          <span class="lp-terminal-meta lp-404-status">404</span>',
    '        </div>',
    '        <div class="lp-terminal-body lp-404-body">',
    '          <p class="lp-404-line"><span class="lp-glyph failed">[404]</span> nenhuma página publicada neste endereço</p>',
    '          <p class="lp-404-line"><span class="lp-glyph done">[200]</span> página inicial disponível em /</p>',
    '        </div>',
    '      </div>',
    '      <div class="lp-404-actions">',
    '        <a class="lp-btn lp-btn-solid lp-btn-lg" href="/">Voltar para a home</a>',
    '        <a class="lp-btn lp-btn-ghost lp-btn-lg" href="/#analise">Analisar um site</a>',
    '      </div>',
    '    </div>',
    '  </main>',
    '  <footer class="lp-footer">',
    '    <div class="lp-wrap lp-footer-inner">',
    '      <div class="lp-signature">',
    '        <span class="lp-signature-label">feito por</span>',
    '        <a class="lp-signature-handle" href="https://pedrosatin.com" target="_blank" rel="noopener noreferrer">@pedrosatin</a>',
    '        <a class="lp-footer-link" href="/">Página inicial</a>',
    '        <a class="lp-footer-link" href="/llms.txt" target="_blank" rel="noopener noreferrer">llms.txt</a>',
    '      </div>',
    '    </div>',
    '  </footer>',
    '</div>',
  ].join('\n');
}

function replaceHeadForNotFound(html) {
  return html
    .replace(/<title>[^<]*<\/title>/, () => TITLE_404)
    .replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/, () => ROBOTS_NOINDEX)
    .replace(/\s*<link\s+rel="canonical"[^>]*\/?>/g, () => '')
    .replace(
      /\s*<meta\s+(?:name|property)="(?:description|og:[^"]+|twitter:[^"]+|profile:[^"]+)"[^>]*\/?>/g,
      () => '',
    )
    .replace(/\s*<link[^>]*type="application\/json\+oembed"[^>]*\/?>/g, () => '')
    .replace(/\s*<script\s+type="module"[^>]*><\/script>/g, () => '');
}

function replaceBodyForNotFound(html) {
  return html
    .replace(ROOT_MARKER, () => buildNotFoundMarkup())
    .replace(/\s*<noscript>[\s\S]*?<\/noscript>/g, () => '');
}

function assertValidNotFoundHtml(html) {
  const checks = [
    [!html.includes(ROBOTS_NOINDEX), 'Meta robots noindex ausente em 404.html.'],
    [html.includes('rel="canonical"'), 'Canonical da home vazou para 404.html.'],
    [html.includes('property="og:'), 'Metadados Open Graph vazaram para 404.html.'],
    [html.includes('type="module"'), 'Script do app vazou para 404.html.'],
    [html.includes(ROOT_MARKER), 'Marcador root não foi substituído em 404.html.'],
  ];
  for (const [failed, message] of checks) {
    if (failed) throw new Error(message);
  }
}

/** Constrói `404.html` a partir do HTML base do build com fontes em preload. */
export function buildNotFoundHtml(shellHtml) {
  if (!shellHtml.includes(ROOT_MARKER)) {
    throw new Error(`Marcador ${ROOT_MARKER} não encontrado para gerar 404.html.`);
  }
  const html = replaceBodyForNotFound(replaceHeadForNotFound(shellHtml));
  assertValidNotFoundHtml(html);
  return html;
}
