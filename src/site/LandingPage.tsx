import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CASE_STUDIES,
  CONTACT,
  DOMAIN_EXTENSIONS,
  PROFILE,
  REGISTRO_BR_URL,
  buildWhatsAppUrl,
} from '../lib/config';
import { FAQ_ITEMS } from '../lib/faq';
import { AREA_LABELS, countBySeverity } from '../lib/findings';
import { formatDate, formatMs } from '../lib/format';
import { auditWhatsAppUrl, briefingWhatsAppUrl, type Briefing } from '../lib/message';
import { SERVICES } from '../lib/services';
import { fetchPageSpeed, googleIndexUrl } from '../lib/sources';
import { buildStructuredData } from '../lib/structuredData';
import type { Finding, PageSpeedReport, Severity } from '../lib/types';
import { useAudit } from '../lib/useAudit';
import './LandingPage.css';

const SEVERITY_TAG: Record<Severity, string> = {
  critical: 'CRÍTICO',
  warning: 'ATENÇÃO',
  info: 'OBSERVAÇÃO',
  good: 'OK',
};

const tone = (value: number | null): string =>
  value === null ? 'none' : value >= 90 ? 'good' : value >= 50 ? 'mid' : 'bad';

/** Barra de status do aparelho: hora à esquerda, ilha ao centro, ícones à direita. */
const DeviceStatusBar: React.FC<{ time: string }> = ({ time }) => (
  <div className="lp-device-statusbar" aria-hidden="true">
    <span className="lp-device-time">{time}</span>
    <span className="lp-device-island" />
    <span className="lp-device-icons">
      <svg viewBox="0 0 13 9" width="12" height="8" fill="currentColor">
        <rect x="0" y="6.2" width="2" height="2.8" rx="0.6" />
        <rect x="3.4" y="4.2" width="2" height="4.8" rx="0.6" />
        <rect x="6.8" y="2.1" width="2" height="6.9" rx="0.6" />
        <rect x="10.2" y="0" width="2" height="9" rx="0.6" />
      </svg>
      <svg viewBox="0 0 12 9" width="11" height="8" fill="none" stroke="currentColor">
        <path d="M0.9 2.6a7.6 7.6 0 0 1 10.2 0" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M2.9 4.9a4.7 4.7 0 0 1 6.2 0" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M4.9 7.2a1.8 1.8 0 0 1 2.2 0" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 17 9" width="16" height="8" fill="currentColor">
        <rect x="0.5" y="0.5" width="13" height="8" rx="2.4" fill="none" stroke="currentColor" />
        <rect x="2" y="2" width="9.5" height="5" rx="1.2" />
        <path d="M15.2 3.1a1.7 1.7 0 0 1 0 2.8V3.1Z" />
      </svg>
    </span>
  </div>
);

const StatusGlyph: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'running') return <span className="lp-glyph running">···</span>;
  if (status === 'done') return <span className="lp-glyph done">ok</span>;
  if (status === 'failed') return <span className="lp-glyph failed">falhou</span>;
  if (status === 'skipped') return <span className="lp-glyph skipped">pulado</span>;
  return <span className="lp-glyph pending">·</span>;
};

const NEEDS = [
  'Tenho um site e ele não aparece no Google',
  'Meu site está lento ou quebrado no celular',
  'Meu site está no ar sem endereço próprio',
  'Preciso de um site novo, do zero',
  'Preciso registrar domínio e publicar',
  'Ainda não sei, quero uma avaliação',
];

export const LandingPage: React.FC = () => {
  const [input, setInput] = useState('');
  const [desktop, setDesktop] = useState<PageSpeedReport | null>(null);
  const [desktopState, setDesktopState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [openedAt, setOpenedAt] = useState<Date | null>(null);
  const [briefing, setBriefing] = useState<Briefing>({
    name: '',
    activity: '',
    need: '',
    currentSite: '',
    notes: '',
  });

  const { phase, steps, result, error, domain, start } = useAudit();
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [steps, phase]);

  useEffect(() => setOpenedAt(new Date()), []);

  // O site analisado alimenta o formulário, para a pessoa não digitar duas vezes.
  useEffect(() => {
    if (result?.domain) {
      setBriefing((prev) => (prev.currentSite ? prev : { ...prev, currentSite: result.domain }));
    }
  }, [result?.domain]);

  const counts = useMemo(
    () => (result ? countBySeverity(result.findings) : null),
    [result],
  );

  const grouped = useMemo(() => {
    if (!result) return [];
    const map = new Map<Finding['area'], Finding[]>();
    for (const finding of result.findings) {
      const list = map.get(finding.area) ?? [];
      list.push(finding);
      map.set(finding.area, list);
    }
    return [...map.entries()];
  }, [result]);

  const run = async (target: string): Promise<void> => {
    if (!target.trim() || phase === 'running') return;

    setDesktop(null);
    setDesktopState('idle');
    const audit = await start(target);

    // A comparação com computador só faz sentido se a medição móvel funcionou.
    if (audit?.pagespeed) {
      setDesktopState('loading');
      try {
        setDesktop(await fetchPageSpeed(audit.domain, 'desktop'));
        setDesktopState('idle');
      } catch {
        setDesktopState('failed');
      }
    }
  };

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    void run(input);
  };

  const runFor = (value: string): void => {
    setInput(value);
    void run(value);
    document.getElementById('analise')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    inputRef.current?.focus();
  };

  const mobile = result?.pagespeed ?? null;
  const briefingReady = briefing.name.trim().length > 0 && briefing.need.trim().length > 0;

  // A barra do aparelho mostra a hora da medição; antes dela, a hora de abertura
  // da página. Ela só é conhecida no navegador: fixá-la na renderização
  // estática serviria a hora da compilação para todos os visitantes.
  const deviceTime = useMemo(() => {
    const when = mobile?.fetchedAt ? new Date(mobile.fetchedAt) : openedAt;
    return when ? when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  }, [mobile?.fetchedAt, openedAt]);

  return (
    <div className="lp">
      <div className="lp-statusbar">
        <div className="lp-wrap lp-statusbar-inner">
          <span className="lp-statusbar-item">
            <span className="lp-pulse" aria-hidden="true" />
            analisador operante
          </span>
          <span className="lp-statusbar-sep">/</span>
          <span className="lp-statusbar-item">atendimento remoto, sob demanda</span>
          <span className="lp-statusbar-sep">/</span>
          <span className="lp-statusbar-item">nenhum resultado desta página é simulado</span>
        </div>
      </div>

      <header className="lp-header">
        <div className="lp-wrap lp-header-inner">
          <a href="#topo" className="lp-brand">
            <span className="lp-brand-mark">ps</span>
            <span className="lp-brand-text">
              <span className="lp-brand-name">Pedro Satin</span>
              <span className="lp-brand-role">engenharia web</span>
            </span>
          </a>
          <nav className="lp-nav">
            <a href="#analise">Análise</a>
            <a href="#resolvo">O que eu resolvo</a>
            <a href="#google">Google</a>
            <a href="#dominio">Domínio</a>
            <a href="#sobre">Sobre mim</a>
            <a href="#trabalhos">Trabalhos</a>
            <a href="#faq">Perguntas</a>
          </nav>
          <a
            className="lp-btn lp-btn-solid"
            href={auditWhatsAppUrl(result, domain)}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        </div>
      </header>

      {/* O conteúdo fica em <main> para que leitores de tela e o "pular para o
          conteúdo" dos navegadores tenham um destino, e para que o buscador
          saiba separar o corpo da página da navegação repetida. */}
      <main className="lp-main">

      {/* ---------- análise: terminal + aparelho ---------- */}

      <section className="lp-hero" id="topo">
        <div className="lp-wrap">
          <div className="lp-hero-top">
            <div className="lp-hero-intro">
              <p className="lp-eyebrow">Diagnóstico antes de proposta</p>
              <h1 className="lp-title">
                Digite o endereço do seu site.
                <span className="lp-title-dim"> Eu mostro o que o Google encontra nele.</span>
              </h1>
              <p className="lp-lede">
                A análise consulta o registro do domínio, a configuração de DNS, o HTML entregue aos
                buscadores e a medição de velocidade do próprio Google, incluindo a captura de como
                a página aparece em um celular. O resultado vem com a evidência de cada ponto.
              </p>
            </div>

            <a
              className="lp-hero-photo"
              href={PROFILE.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="lp-hero-photo-frame">
                {/* Na miniatura o recorte deitado deixaria o rosto pequeno
                    demais, então a tela estreita recebe um arquivo próprio,
                    fechado no rosto. Só um dos dois é baixado. */}
                <picture>
                  <source media="(max-width: 900px)" srcSet={PROFILE.photoSquare} />
                  <img
                    src={PROFILE.photo}
                    alt={PROFILE.photoAlt}
                    width={600}
                    height={750}
                    loading="eager"
                  />
                </picture>
              </span>
              <span className="lp-hero-photo-tag">
                <span className="lp-hero-photo-name">{CONTACT.name}</span>
                <span className="lp-hero-photo-role">{PROFILE.role}</span>
                <span className="lp-hero-photo-link">ver perfil no LinkedIn</span>
              </span>
            </a>
          </div>

          <div className="lp-analysis" id="analise">
            <div className="lp-terminal">
              <div className="lp-terminal-bar">
                <div className="lp-terminal-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="lp-terminal-title">auditoria{domain ? ` — ${domain}` : ''}</span>
                <span className="lp-terminal-meta">
                  {phase === 'running' ? 'executando' : phase === 'done' ? 'concluída' : 'aguardando'}
                </span>
              </div>

              <div className="lp-terminal-body" ref={logRef}>
                <form className="lp-prompt" onSubmit={submit}>
                  <span className="lp-prompt-sign">$</span>
                  <span className="lp-prompt-cmd">analisar</span>
                  <input
                    ref={inputRef}
                    className="lp-prompt-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="seusite.com.br"
                    spellCheck={false}
                    autoComplete="off"
                    disabled={phase === 'running'}
                    aria-label="Endereço do site a analisar"
                  />
                  <button
                    type="submit"
                    className="lp-prompt-run"
                    disabled={phase === 'running' || !input.trim()}
                  >
                    {phase === 'running' ? 'analisando' : 'executar'}
                  </button>
                </form>

                {phase === 'idle' && steps.length === 0 && (
                  <div className="lp-hint">
                    <p>Sem site para testar? Analise esta própria página ou um destes projetos que construí:</p>
                    <div className="lp-presets">
                      {CASE_STUDIES.map((item) => (
                        <button key={item.domain} type="button" onClick={() => runFor(item.domain)}>
                          {item.domain}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {steps.length > 0 && (
                  <ul className="lp-log">
                    {steps.map((step) => (
                      <li key={step.id} className={`lp-log-line ${step.status}`}>
                        <div className="lp-log-head">
                          <StatusGlyph status={step.status} />
                          <code>{step.command}</code>
                          {step.durationMs !== null && (
                            <span className="lp-log-time">{formatMs(step.durationMs)}</span>
                          )}
                        </div>
                        {step.detail && <div className="lp-log-detail">{step.detail}</div>}
                      </li>
                    ))}
                  </ul>
                )}

                {phase === 'running' && (
                  <p className="lp-waiting">
                    A medição do Google costuma levar de 15 a 40 segundos. Ela abre o site em um
                    aparelho simulado e consulta o histórico de visitantes reais.
                  </p>
                )}

                {error && <p className="lp-error">{error}</p>}
              </div>
            </div>

            <div className="lp-device-col">
              <div className="lp-device">
                <DeviceStatusBar time={deviceTime} />
                <div className="lp-device-screen">
                  {mobile?.screenshot ? (
                    <img
                      src={mobile.screenshot}
                      alt={`Como ${result?.domain} aparece em um celular`}
                    />
                  ) : phase === 'running' ? (
                    <div className="lp-device-loading">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : (
                    <div className="lp-device-idle">
                      <p>A captura do seu site aparece aqui</p>
                      <span>gerada pelo Google em aparelho móvel simulado</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="lp-device-caption">
                {result ? (
                  <>
                    {result.domain}
                    {mobile && <> · {new Date(mobile.fetchedAt).toLocaleTimeString('pt-BR')}</>}
                  </>
                ) : (
                  'É esta a versão que o Google usa para posicionar o site'
                )}
              </p>
            </div>
          </div>

          {result && !result.coverage.complete && (
            <div className="lp-incomplete">
              <h2>Análise incompleta</h2>
              <p>
                Não foi possível concluir {result.coverage.missing.join(' e ')}. Sem isso, não há
                base para dar uma nota: a ausência de defeitos encontrados significaria apenas que
                essa parte não foi olhada. O que aparece abaixo se limita ao que realmente
                respondeu.
              </p>
            </div>
          )}

          {result && counts && (
            <div className={`lp-verdict ${result.score ? '' : 'no-score'}`}>
              {result.score && (
                <div className="lp-verdict-score">
                  <span className="lp-verdict-value">{result.score.value}</span>
                  <span className="lp-verdict-max">/100</span>
                  <span className="lp-verdict-label">{result.score.label}</span>
                </div>
              )}
              <div className="lp-verdict-counts">
                <div className="lp-count critical">
                  <strong>{counts.critical}</strong>
                  <span>críticos</span>
                </div>
                <div className="lp-count warning">
                  <strong>{counts.warning}</strong>
                  <span>a corrigir</span>
                </div>
                <div className="lp-count info">
                  <strong>{counts.info}</strong>
                  <span>observações</span>
                </div>
                <div className="lp-count good">
                  <strong>{counts.good}</strong>
                  <span>já corretos</span>
                </div>
              </div>
              <div className="lp-verdict-actions">
                <a
                  className="lp-btn lp-btn-solid"
                  href={auditWhatsAppUrl(result, domain)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Enviar este diagnóstico
                </a>
                <a
                  className="lp-btn lp-btn-ghost"
                  href={googleIndexUrl(result.domain)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver o que o Google indexou
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- celular contra computador ---------- */}

      {mobile && (
        <section className="lp-compare">
          <div className="lp-wrap">
            <h2 className="lp-h2">Celular e computador, lado a lado</h2>
            <p className="lp-h2-sub">
              A mesma página, medida pelo Google nas duas condições. É a coluna da esquerda que conta
              para a busca, e é justamente a que o dono do site menos vê.
            </p>

            <div className="lp-compare-grid">
              <div className="lp-compare-head">
                <span />
                <span className="lp-compare-label mobile">Celular</span>
                <span className="lp-compare-label desktop">Computador</span>
              </div>
              {(
                [
                  ['Desempenho', mobile.scores.performance, desktop?.scores.performance ?? null],
                  ['SEO', mobile.scores.seo, desktop?.scores.seo ?? null],
                  [
                    'Acessibilidade',
                    mobile.scores.accessibility,
                    desktop?.scores.accessibility ?? null,
                  ],
                  [
                    'Boas práticas',
                    mobile.scores.bestPractices,
                    desktop?.scores.bestPractices ?? null,
                  ],
                ] as const
              ).map(([label, m, d]) => (
                <div key={label} className="lp-compare-row">
                  <span className="lp-compare-metric">{label}</span>
                  <span className={`lp-compare-value ${tone(m)}`}>{m ?? '—'}</span>
                  <span className={`lp-compare-value ${tone(d)}`}>
                    {desktopState === 'loading' ? '…' : desktopState === 'failed' ? '—' : (d ?? '—')}
                  </span>
                </div>
              ))}
            </div>

            {desktopState === 'failed' && (
              <p className="lp-compare-note">
                A medição em computador não pôde ser feita agora. Os números do celular continuam
                válidos.
              </p>
            )}

            <div className="lp-metrics">
              <div className="lp-metric">
                <span className="lp-metric-label">Tempo até o conteúdo aparecer</span>
                <strong>
                  {mobile.lab.lcpMs !== null ? `${(mobile.lab.lcpMs / 1000).toFixed(1)} s` : '—'}
                </strong>
                <span className="lp-metric-hint">no aparelho simulado; o bom é abaixo de 2,5 s</span>
              </div>
              <div className="lp-metric">
                <span className="lp-metric-label">Resposta do servidor</span>
                <strong>
                  {mobile.lab.serverResponseMs !== null
                    ? `${Math.round(mobile.lab.serverResponseMs)} ms`
                    : '—'}
                </strong>
                <span className="lp-metric-hint">antes de qualquer coisa ser desenhada na tela</span>
              </div>
              <div className="lp-metric">
                <span className="lp-metric-label">Visitantes reais</span>
                <strong>
                  {mobile.field.lcp.p75 !== null
                    ? `${(mobile.field.lcp.p75 / 1000).toFixed(1)} s`
                    : 'sem amostra'}
                </strong>
                <span className="lp-metric-hint">
                  {mobile.field.available
                    ? 'percentil 75 de quem acessa pelo Chrome'
                    : 'o site ainda não tem tráfego suficiente para amostra'}
                </span>
              </div>
              <div className="lp-metric">
                <span className="lp-metric-label">Adaptação de tela</span>
                <strong>{result?.content?.html?.viewport ? 'declarada' : 'ausente'}</strong>
                <span className="lp-metric-hint">
                  {result?.content?.html?.viewport ?? 'sem meta viewport no HTML'}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------- achados ---------- */}

      {result && (
        <section className="lp-findings">
          <div className="lp-wrap">
            <h2 className="lp-h2">Achados da análise</h2>
            <p className="lp-h2-sub">
              Cada linha traz a medição que a originou. Nada aqui é estimativa.
            </p>

            {result.contentError && (
              <p className="lp-notice">
                A leitura do HTML falhou: {result.contentError}. Os demais dados continuam válidos.
              </p>
            )}
            {result.pagespeedError && (
              <p className="lp-notice">
                A medição de velocidade no celular não pôde ser carregada ({result.pagespeedError}). Todos os dados de segurança, domínio e indexação continuam válidos.
              </p>
            )}

            <div className="lp-groups">
              {grouped.map(([area, findings]) => (
                <div key={area} className="lp-group">
                  <h3 className="lp-group-title">
                    {AREA_LABELS[area]}
                    <span>{findings.length}</span>
                  </h3>
                  <ul className="lp-list">
                    {findings.map((finding) => (
                      <li key={finding.id} className={`lp-item ${finding.severity}`}>
                        <div className="lp-item-head">
                          <span className={`lp-sev ${finding.severity}`}>
                            {SEVERITY_TAG[finding.severity]}
                          </span>
                          <h4>{finding.title}</h4>
                        </div>
                        <p className="lp-item-evidence">{finding.evidence}</p>
                        <p className="lp-item-action">{finding.action}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="lp-findings-cta">
              <p>
                Quer entender o que é urgente e o que pode esperar? Me mande este diagnóstico. Eu
                respondo com a leitura de cada ponto antes de qualquer compromisso.
              </p>
              <a
                className="lp-btn lp-btn-solid"
                href={auditWhatsAppUrl(result, domain)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Enviar no WhatsApp
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ---------- o que eu resolvo ---------- */}

      <section className="lp-services" id="resolvo">
        <div className="lp-wrap">
          <h2 className="lp-h2">O que eu resolvo</h2>
          <p className="lp-h2-sub">
            Cada item abaixo é um problema concreto que aparece com frequência. Se o seu caso for um
            deles, a análise no topo já mostra o tamanho do estrago.
          </p>
          <div className="lp-service-grid">
            {SERVICES.map((service, index) => (
              <article key={service.title} className="lp-service">
                <span className="lp-service-index">{String(index + 1).padStart(2, '0')}</span>
                <h3>{service.title}</h3>
                <p>{service.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- google ---------- */}

      <section className="lp-google" id="google">
        <div className="lp-wrap">
          <h2 className="lp-h2">Como o Google encontra o seu site</h2>
          <p className="lp-h2-sub">
            Aparecer na busca não é uma configuração que se liga. São quatro etapas, e um site pode
            falhar em qualquer uma delas enquanto continua abrindo normalmente para quem digita o
            endereço.
          </p>

          <ol className="lp-steps-flow">
            <li>
              <span className="lp-flow-num">1</span>
              <h3>Descoberta</h3>
              <p>
                O Google precisa saber que a página existe. Isso vem de um sitemap enviado, de links
                apontando para ela ou do rastreamento do próprio domínio. Sem nenhum desses
                caminhos, a página fica invisível por tempo indeterminado.
              </p>
            </li>
            <li>
              <span className="lp-flow-num">2</span>
              <h3>Rastreamento</h3>
              <p>
                O robô visita a página com um agente móvel. Um arquivo robots.txt mal configurado,
                uma meta tag de bloqueio ou um servidor que demora demais para responder fazem a
                visita terminar sem que nada seja lido.
              </p>
            </li>
            <li>
              <span className="lp-flow-num">3</span>
              <h3>Indexação</h3>
              <p>
                O conteúdo lido é interpretado e arquivado. Aqui pesam o título, a descrição, a
                estrutura de cabeçalhos e a tag canônica. Se o texto só aparece depois que o
                JavaScript roda, o robô pode arquivar uma página praticamente vazia.
              </p>
            </li>
            <li>
              <span className="lp-flow-num">4</span>
              <h3>Posicionamento</h3>
              <p>
                Entre as páginas indexadas, o Google escolhe a ordem. Velocidade no celular,
                estabilidade do layout e clareza do conteúdo entram nessa conta, junto com fatores
                que ninguém controla. Sem passar pelas três etapas anteriores, esta nem começa.
              </p>
            </li>
          </ol>

          <div className="lp-google-check">
            <div>
              <h3>Veja você mesmo o que está indexado</h3>
              <p>
                O operador <code>site:</code> lista o que o Google guardou do seu domínio. Não existe
                API pública que devolva esse número, então em vez de inventar uma contagem, esta
                página leva você direto à busca real.
              </p>
            </div>
            <a
              className="lp-btn lp-btn-ghost"
              href={googleIndexUrl(result?.domain ?? domain ?? 'pedrosatin.com')}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar no Google
            </a>
          </div>
        </div>
      </section>

      {/* ---------- domínio ---------- */}

      <section className="lp-domain" id="dominio">
        <div className="lp-wrap">
          <h2 className="lp-h2">O domínio é seu, e a escolha também</h2>
          <p className="lp-h2-sub">
            Domínios terminados em .br saem no Registro.br, o órgão oficial no Brasil, a partir de
            aproximadamente R$ 40 por ano conforme a extensão. Fora do .br, o registro é feito em
            registradores internacionais, com preços próprios. Em qualquer caso o pagamento é seu,
            direto ao registrador, e eu não coloco margem sobre isso.
          </p>

          <div className="lp-domain-facts">
            <ul>
              <li>
                <strong>Titularidade</strong>
                <span>seu CPF ou CNPJ desde o primeiro dia, sem intermediário no cadastro</span>
              </li>
              <li>
                <strong>Custo do registro</strong>
                <span>a partir de cerca de R$ 40 ao ano, pago por você direto ao registrador</span>
              </li>
              <li>
                <strong>Acréscimo meu sobre o domínio</strong>
                <span>nenhum</span>
              </li>
              <li>
                <strong>Meu trabalho</strong>
                <span>orientação na escolha e no cadastro, DNS, certificado e publicação</span>
              </li>
            </ul>
          </div>

          {result?.registration?.found && (
            <div className="lp-domain-live">
              <span className="lp-domain-live-label">
                Consulta feita agora em {result.domain}
              </span>
              <dl>
                <div>
                  <dt>Registrador</dt>
                  <dd>{result.registration.registrar ?? 'não informado'}</dd>
                </div>
                <div>
                  <dt>Registrado em</dt>
                  <dd>{formatDate(result.registration.registeredAt)}</dd>
                </div>
                <div>
                  <dt>Válido até</dt>
                  <dd>
                    {formatDate(result.registration.expiresAt)}
                    {result.registration.daysToExpire !== null && (
                      <span> ({result.registration.daysToExpire} dias)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>DNSSEC</dt>
                  <dd>{result.registration.dnssec ? 'ativo' : 'não configurado'}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="lp-domain-ext">
            <h3>A extensão fala pela profissão</h3>
            <p className="lp-domain-ext-lede">
              O .com.br atende quase todo mundo, mas o Registro.br mantém extensões por área de
              atuação. Um endereço terminado em .adv.br já diz que ali existe um advogado, e o
              mesmo vale para as demais. Algumas têm regras próprias de cadastro, que eu verifico
              junto com você antes de registrar.
            </p>
            <ul className="lp-ext-list">
              {DOMAIN_EXTENSIONS.map((item) => (
                <li key={item.suffix}>
                  <code>{item.suffix}</code>
                  <span className="lp-ext-audience">{item.audience}</span>
                </li>
              ))}
            </ul>
            <a
              className="lp-inline-link"
              href={REGISTRO_BR_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver a lista completa no Registro.br
            </a>
          </div>
        </div>
      </section>

      {/* ---------- como trabalho ---------- */}

      <section className="lp-terms">
        <div className="lp-wrap">
          <h2 className="lp-h2">Como o trabalho funciona</h2>
          <div className="lp-terms-grid">
            <article>
              <h3>Sob demanda, sem mensalidade</h3>
              <p>
                Não vendo plano mensal nem contrato de manutenção. Fazemos o levantamento do que
                você precisa, eu orço aquele trabalho e o combinado é aquilo. Se meses depois surgir
                outra necessidade, fazemos um novo levantamento e um novo orçamento.
              </p>
            </article>
            <article>
              <h3>O código é seu</h3>
              <p>
                O código-fonte é entregue a você e não fica preso a nenhuma plataforma proprietária.
                Se um dia quiser trabalhar com outra pessoa, ela assume o projeto sem precisar
                pedir nada a mim.
              </p>
            </article>
            <article>
              <h3>As contas ficam no seu nome</h3>
              <p>
                Domínio, hospedagem e serviços são criados em contas suas, com o seu acesso. Eu
                configuro tudo, mas a titularidade é sua desde o começo, não algo transferido no
                fim.
              </p>
            </article>
            <article>
              <h3>Atendimento remoto</h3>
              <p>
                Todo o processo acontece por WhatsApp e, quando ajuda, por chamada de vídeo. Vale
                para o levantamento, o acompanhamento do desenvolvimento e o suporte depois de
                publicado.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ---------- quem faz ---------- */}

      <section className="lp-about" id="sobre">
        <div className="lp-wrap">
          <h2 className="lp-h2">Quem faz o trabalho</h2>
          <p className="lp-h2-sub">
            Não é uma agência nem um revendedor de plataforma. Quem levanta o requisito, escreve o
            código e responde no WhatsApp é a mesma pessoa.
          </p>

          <div className="lp-about-grid">
            <div className="lp-about-text">
              <p>
                Sou Pedro Satin, bacharel em Engenharia de Software pela UniCesumar e pós-graduado
                em Desenvolvimento Frontend. Atuo como engenheiro de software na Saúde Bliss,
                desenvolvendo automações com inteligência artificial e integrações com operadoras de
                plano de saúde, com React e TypeScript no frontend, serviços em Node.js e infraestrutura na AWS.
              </p>
              <p>
                Sou também professor universitário na UniCesumar, onde ministro a disciplina de
                Tecnologias Emergentes (cobrindo IA generativa, agentes autônomos e arquiteturas web)
                no curso de Engenharia de Software, além de passagens anteriores por Análise e
                Desenvolvimento de Sistemas. A rotina docente exige clareza conceitual e domínio profundo
                de cada camada do desenvolvimento.
              </p>
              <p>
                Antes disso fui desenvolvedor frontend no Inter (time do Intershop), participando da
                migração de Gatsby para Next.js, da evolução do SEO da loja, de design systems e de
                observabilidade em grande escala. Esse histórico une o rigor técnico de quem ensina
                com a experiência prática de quem coloca produtos no ar com alta performance.
              </p>
            </div>

            <ul className="lp-about-facts">
              <li>
                <strong>Engenharia</strong>
                <span>Engenheiro de software na Saúde Bliss (IA e integrações)</span>
              </li>
              <li>
                <strong>Docência</strong>
                <span>Professor de Engenharia de Software na UniCesumar</span>
              </li>
              <li>
                <strong>Experiência</strong>
                <span>Frontend no Inter (Intershop), Claranet e UniCesumar (Studeo)</span>
              </li>
              <li>
                <strong>Formação</strong>
                <span>Bacharel em Engenharia de Software com pós em Frontend</span>
              </li>
            </ul>
          </div>

          <div className="lp-about-links">
            <a href={PROFILE.linkedin} target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
            <a href={PROFILE.github} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href={PROFILE.portfolio} target="_blank" rel="noopener noreferrer">
              pedrosatin.com
            </a>
          </div>
        </div>
      </section>

      {/* ---------- trabalhos ---------- */}

      <section className="lp-work" id="trabalhos">
        <div className="lp-wrap">
          <h2 className="lp-h2">Sites que eu fiz</h2>
          <p className="lp-h2-sub">
            Estão no ar agora. Rode a análise em qualquer um deles e compare com a do seu site. Os
            números vêm da mesma fonte.
          </p>
          <div className="lp-work-grid">
            {CASE_STUDIES.map((item) => (
              <article key={item.domain} className="lp-work-card">
                <h3>{item.name}</h3>
                <p className="lp-work-segment">{item.segment}</p>
                <p className="lp-work-summary">{item.summary}</p>
                <div className="lp-work-actions">
                  <a href={`https://${item.domain}`} target="_blank" rel="noopener noreferrer">
                    {item.domain}
                  </a>
                  <button type="button" onClick={() => runFor(item.domain)}>
                    analisar este
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- atendimento em 3 passos ---------- */}

      <section className="lp-request" id="atendimento">
        <div className="lp-wrap">
          <h2 className="lp-h2">Solicitar atendimento em três passos</h2>
          <p className="lp-h2-sub">
            Preencha o essencial abaixo. O botão abre o WhatsApp com a mensagem já escrita, incluindo
            o resultado da análise se você tiver rodado. Nada é enviado antes disso.
          </p>

          <div className="lp-request-grid">
            <div className="lp-request-form">
              <div className="lp-field-step">
                <span className="lp-step-badge">1</span>
                <div className="lp-step-body">
                  <h3>Quem é você</h3>
                  <div className="lp-field-row">
                    <label className="lp-field">
                      <span>Nome</span>
                      <input
                        value={briefing.name}
                        onChange={(event) =>
                          setBriefing({ ...briefing, name: event.target.value })
                        }
                        placeholder="como devo te chamar"
                        autoComplete="name"
                      />
                    </label>
                    <label className="lp-field">
                      <span>Atividade</span>
                      <input
                        value={briefing.activity}
                        onChange={(event) =>
                          setBriefing({ ...briefing, activity: event.target.value })
                        }
                        placeholder="advocacia, clínica, comércio"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="lp-field-step">
                <span className="lp-step-badge">2</span>
                <div className="lp-step-body">
                  <h3>Do que você precisa</h3>
                  <div className="lp-needs">
                    {NEEDS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`lp-need ${briefing.need === item ? 'active' : ''}`}
                        onClick={() => setBriefing({ ...briefing, need: item })}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lp-field-step">
                <span className="lp-step-badge">3</span>
                <div className="lp-step-body">
                  <h3>Situação atual</h3>
                  <label className="lp-field">
                    <span>Site atual, se houver</span>
                    <input
                      value={briefing.currentSite}
                      onChange={(event) =>
                        setBriefing({ ...briefing, currentSite: event.target.value })
                      }
                      placeholder="seusite.com.br"
                      spellCheck={false}
                    />
                  </label>
                  <label className="lp-field">
                    <span>Algo que eu deva saber antes</span>
                    <textarea
                      value={briefing.notes}
                      onChange={(event) => setBriefing({ ...briefing, notes: event.target.value })}
                      placeholder="prazo, orçamento previsto, quem fez o site hoje"
                      rows={3}
                    />
                  </label>
                </div>
              </div>

              <div className="lp-request-submit">
                <p className="lp-request-note">
                  Resposta em horário comercial. O levantamento não tem custo e não obriga a nada.
                </p>
                {briefingReady ? (
                  <a
                    className="lp-btn lp-btn-solid lp-btn-lg"
                    href={briefingWhatsAppUrl(briefing, result)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir WhatsApp com esta mensagem
                  </a>
                ) : (
                  <button
                    type="button"
                    className="lp-btn lp-btn-solid lp-btn-lg disabled"
                    disabled
                  >
                    Preencha nome e necessidade
                  </button>
                )}
              </div>
            </div>

            <aside className="lp-request-side">
              <h3>O que acontece depois</h3>
              <ol>
                <li>
                  <strong>Levantamento</strong>
                  <span>
                    conversamos sobre o que existe hoje e o que você precisa. Se houver site, eu
                    analiso antes de opinar.
                  </span>
                </li>
                <li>
                  <strong>Orçamento</strong>
                  <span>
                    valor fechado do trabalho, com escopo escrito e prazo. Itens opcionais aparecem
                    com preço separado.
                  </span>
                </li>
                <li>
                  <strong>Execução e entrega</strong>
                  <span>
                    desenvolvimento com acompanhamento, publicação nas suas contas e a mesma medição
                    refeita para comparar.
                  </span>
                </li>
              </ol>
              <div className="lp-request-contact">
                <span>WhatsApp</span>
                <a
                  href={buildWhatsAppUrl('Olá Pedro, vim pela sua página de serviços.')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {CONTACT.whatsappDisplay}
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ---------- perguntas ---------- */}

      <section className="lp-faq" id="faq">
        <div className="lp-wrap">
          <h2 className="lp-h2">Perguntas frequentes</h2>
          <p className="lp-h2-sub">
            As dúvidas que aparecem em quase toda primeira conversa, respondidas antes dela.
          </p>
          <div className="lp-faq-list">
            {/* `<details>` em vez de estado do React por três razões: a resposta
                fica sempre no HTML, e não só quando aberta, o que a torna
                indexável e a mantém idêntica ao que os dados estruturados
                declaram; o teclado e o leitor de tela funcionam sem código; e a
                abertura funciona com o JavaScript desligado. */}
            {FAQ_ITEMS.map((item, index) => (
              <details
                key={item.q}
                className="lp-faq-item"
                name="faq"
                open={index === 0}
              >
                <summary className="lp-faq-button">
                  <span>{item.q}</span>
                  <span className="lp-faq-sign" aria-hidden="true" />
                </summary>
                <div className="lp-faq-answer">
                  {item.a.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- fechamento ---------- */}

      <section className="lp-cta">
        <div className="lp-wrap lp-cta-inner">
          <div>
            <h2>Comece pela análise, não pela proposta</h2>
            <p>
              Rode o diagnóstico no seu site e me mande o resultado. Eu respondo dizendo o que é
              urgente, o que pode esperar e quanto custa cada parte, antes de qualquer compromisso.
            </p>
          </div>
          <div className="lp-cta-actions">
            <a className="lp-btn lp-btn-solid lp-btn-lg" href="#analise">
              Analisar meu site
            </a>
            <a
              className="lp-btn lp-btn-ghost lp-btn-lg"
              href={auditWhatsAppUrl(result, domain)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <div className="lp-footer-main">
            <span className="lp-footer-name">Pedro Satin</span>
            <span className="lp-footer-role">engenharia de software e desenvolvimento web</span>
            <span className="lp-footer-remote">atendimento remoto</span>
          </div>
          <div className="lp-footer-sources">
            Fontes da análise: PageSpeed Insights do Google, RDAP do Registro.br, DNS público e
            leitura direta do HTML do site consultado.
          </div>
          <div className="lp-signature">
            <span className="lp-signature-label">feito por</span>
            <a
              className="lp-signature-handle"
              href="https://pedrosatin.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              {CONTACT.handle}
            </a>
          </div>
        </div>
      </footer>

      {/* Dados estruturados. Ficam no corpo, junto do texto que descrevem, e
          por isso saem no HTML pré-renderizado. `application/ld+json` não é
          executado: é dado, e a CSP o trata como tal. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildStructuredData() }}
      />
    </div>
  );
};

export default LandingPage;
