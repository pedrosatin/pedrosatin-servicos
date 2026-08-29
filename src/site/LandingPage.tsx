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
import { AREA_LABELS, countBySeverity } from '../lib/achados';
import { formatDate, formatMs } from '../lib/format';
import { auditWhatsAppUrl, briefingWhatsAppUrl, type Briefing } from '../lib/message';
import { SERVICES } from '../lib/services';
import { googleIndexUrl, isValidDomain, normalizeDomain } from '../lib/dominio';
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
  'Fiz um projeto com IA e não sei como publicar',
  'Meu projeto feito com IA está com bugs ou travou',
  'Preciso integrar banco de dados, login ou pagamentos',
  'Meu site feito com IA está lento ou quebrado no celular',
  'Quero transformar meu protótipo de IA em um produto real',
  'Ainda não sei, quero uma avaliação técnica',
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
  const queuedPresetRef = useRef<string | null>(null);
  const runRef = useRef<(target: string) => Promise<void>>(async () => undefined);

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

    // As duas medições são independentes e cada uma leva de 15 a 40 segundos.
    // Encadeá-las custava a soma das duas ao visitante; disparadas juntas, a
    // espera passa a ser a da mais demorada. O domínio já dá para normalizar
    // aqui, então a de computador não precisa esperar a auditoria terminar
    // para saber o que medir.
    const domain = normalizeDomain(target);
    let medicaoComputador: Promise<PageSpeedReport> | null = null;

    if (isValidDomain(domain)) {
      setDesktopState('loading');
      medicaoComputador = import('../lib/sources').then((modulo) =>
        modulo.fetchPageSpeed(domain, 'desktop'),
      );
      // A promessa só é lida depois da auditoria. Sem isto, uma falha rápida
      // vira "unhandled rejection" no console antes de chegarmos ao catch.
      medicaoComputador.catch(() => undefined);
    }

    const audit = await start(target);

    if (!medicaoComputador) return;

    // A comparação com computador só faz sentido se a medição móvel funcionou.
    if (!audit?.pagespeed) {
      setDesktopState('idle');
      return;
    }

    try {
      setDesktop(await medicaoComputador);
      setDesktopState('idle');
    } catch {
      setDesktopState('failed');
    }
  };

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    void run(input);
  };

  const runFor = (value: string): void => {
    const target = normalizeDomain(value);
    setInput(target);
    document.getElementById('analise')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (phase === 'running') {
      queuedPresetRef.current = target;
      return;
    }
    void run(target);
    inputRef.current?.focus();
  };

  runRef.current = run;

  useEffect(() => {
    if (phase === 'running' || !queuedPresetRef.current) return;
    const target = queuedPresetRef.current;
    queuedPresetRef.current = null;
    void runRef.current(target);
  }, [phase]);

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
          <span className="lp-statusbar-item">projetos com IA e aplicações web</span>
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
            Falar no WhatsApp
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
              <p className="lp-eyebrow">Engenharia web para projetos de IA</p>
              <h1 className="lp-title">
                Você criou no Cursor, Lovable ou v0.
                <span className="lp-title-dim"> Eu coloco em produção.</span>
              </h1>
              <p className="lp-lede">
                Deploy com domínio próprio, banco de dados real, correção de bugs e velocidade no celular. Sem mensalidade, código 100% seu. Tem um link público ou protótipo? Teste a saúde dele abaixo.
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
                <span className="lp-terminal-title">auditoria{domain ? `: ${domain}` : ''}</span>
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
                    <p>Já publicou em um link temporário ou domínio? Teste seu projeto ou analise um destes:</p>
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
                  Enviar diagnóstico no WhatsApp
                </a>
                <a
                  className="lp-btn lp-btn-ghost"
                  href={googleIndexUrl(result.domain)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver no Google
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
                Quer saber o que é crítico e o que pode esperar? Me envie este diagnóstico no WhatsApp.
                Respondo com a leitura técnica antes de qualquer compromisso.
              </p>
              <a
                className="lp-btn lp-btn-solid"
                href={auditWhatsAppUrl(result, domain)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Enviar diagnóstico no WhatsApp
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
            Problemas reais que destravam o lançamento do seu projeto. A auditoria no topo mede o impacto de cada um.
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
          <h2 className="lp-h2">Por que seu projeto de IA não aparece no Google?</h2>
          <p className="lp-h2-sub">
            Aparecer na busca não é uma chave que se liga. Aplicações geradas por IA costumam entregar um HTML vazio: o usuário vê a tela, mas o robô lê uma página em branco.
          </p>

          <ol className="lp-steps-flow">
            <li>
              <span className="lp-flow-num">1</span>
              <h3>Descoberta</h3>
              <p>
                O robô precisa encontrar seu endereço através de sitemap e links indexados.
              </p>
            </li>
            <li>
              <span className="lp-flow-num">2</span>
              <h3>Rastreamento</h3>
              <p>
                O robô precisa acessar seu servidor sem bloqueios de robots.txt ou lentidão de resposta.
              </p>
            </li>
            <li>
              <span className="lp-flow-num">3</span>
              <h3>Indexação</h3>
              <p>
                O conteúdo precisa estar no HTML inicial para ser arquivado, e não apenas no JavaScript.
              </p>
            </li>
            <li>
              <span className="lp-flow-num">4</span>
              <h3>Posicionamento</h3>
              <p>
                Velocidade no celular e estabilidade de layout definem a ordem nas buscas.
              </p>
            </li>
          </ol>

          <div className="lp-google-check">
            <div>
              <h3>Consulte o que o Google guardou do seu site</h3>
              <p>
                O comando <code>site:seusite.com.br</code> mostra exatamente as páginas arquivadas pelo Google. Veja o resultado real da busca.
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
          <h2 className="lp-h2">Domínio e infraestrutura no seu nome</h2>
          <p className="lp-h2-sub">
            Domínios .com.br custam a partir de R$ 40 por ano direto no Registro.br. Você paga aos provedores oficiais, sem taxa intermediária ou dependência técnica.
          </p>

          <div className="lp-domain-facts">
            <ul>
              <li>
                <strong>Titularidade</strong>
                <span>seu CPF ou CNPJ desde o primeiro dia, sem intermediário</span>
              </li>
              <li>
                <strong>Custo do domínio</strong>
                <span>a partir de R$ 40 ao ano pago direto ao Registro.br</span>
              </li>
              <li>
                <strong>Hospedagem</strong>
                <span>configurada em contas suas (Vercel, Cloudflare, AWS)</span>
              </li>
              <li>
                <strong>Meu trabalho</strong>
                <span>arquitetura, apontamento de DNS, SSL e publicação</span>
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
            <h3>Extensões mais comuns</h3>
            <p className="lp-domain-ext-lede">
              O .com.br atende a maioria dos projetos. Para apps e MVPs, extensões como .app.br e .dev.br destacam seu produto.
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
                Levantamento técnico, orçamento com valor fechado e prazo definido. Sem contratos recorrentes obrigatórios.
              </p>
            </article>
            <article>
              <h3>Código 100% seu</h3>
              <p>
                Repositório no GitHub transferido para a sua conta. Sem amarras nem plataformas proprietárias.
              </p>
            </article>
            <article>
              <h3>Contas na sua titularidade</h3>
              <p>
                Domínio, hospedagem e banco pertencem a você desde o primeiro dia.
              </p>
            </article>
            <article>
              <h3>Atendimento direto</h3>
              <p>
                Contato direto comigo pelo WhatsApp durante todo o projeto.
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
            Você fala diretamente com quem programa e resolve, sem intermediários ou agências.
          </p>

          <div className="lp-about-grid">
            <div className="lp-about-text">
              <p>
                Sou Pedro Satin, engenheiro de software na Saúde Bliss e professor universitário. Entendo a fundo como Cursor, Lovable, v0 e Bolt geram código, e sei onde a engenharia sênior precisa intervir para garantir banco de dados, segurança, estabilidade e performance.
              </p>
            </div>

            <ul className="lp-about-facts">
              <li>
                <strong>Engenharia</strong>
                <span>Software Engineer na Saúde Bliss (IA e integrações)</span>
              </li>
              <li>
                <strong>Docência</strong>
                <span>Professor de Tecnologias Emergentes na UniCesumar</span>
              </li>
              <li>
                <strong>Experiência</strong>
                <span>Frontend no Inter (Intershop), Claranet e UniCesumar</span>
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
          <h2 className="lp-h2">Sites no ar</h2>
          <p className="lp-h2-sub">
            Projetos em produção agora. Teste qualquer um deles na ferramenta de auditoria e compare com o seu.
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
          <h2 className="lp-h2">Solicitar orçamento em 3 passos</h2>
          <p className="lp-h2-sub">
            Preencha o essencial abaixo. O botão gera a mensagem pronta no WhatsApp com o diagnóstico da análise se você tiver rodado.
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
                      <span>Atividade ou projeto</span>
                      <input
                        value={briefing.activity}
                        onChange={(event) =>
                          setBriefing({ ...briefing, activity: event.target.value })
                        }
                        placeholder="aplicação web, MVP, SaaS, clínica, e-commerce"
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
                    <span>Link do projeto ou site atual (opcional)</span>
                    <input
                      value={briefing.currentSite}
                      onChange={(event) =>
                        setBriefing({ ...briefing, currentSite: event.target.value })
                      }
                      placeholder="seusite.com.br, link do Lovable/v0/Bolt ou deixe em branco"
                      spellCheck={false}
                    />
                  </label>
                  <label className="lp-field">
                    <span>Algo que eu deva saber antes</span>
                    <textarea
                      value={briefing.notes}
                      onChange={(event) => setBriefing({ ...briefing, notes: event.target.value })}
                      placeholder="ferramenta usada (Cursor, Lovable, v0, Bolt), erros encontrados, integrações necessárias"
                      rows={3}
                    />
                  </label>
                </div>
              </div>

              <div className="lp-request-submit">
                <p className="lp-request-note">
                  Resposta rápida em horário comercial. O levantamento não tem custo.
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
                    conversamos sobre o projeto e necessidades. Se houver link, eu analiso a saúde técnica.
                  </span>
                </li>
                <li>
                  <strong>Orçamento</strong>
                  <span>
                    valor fechado do trabalho com escopo escrito e prazo claro.
                  </span>
                </li>
                <li>
                  <strong>Execução e entrega</strong>
                  <span>
                    desenvolvimento com acompanhamento, publicação nas suas contas e auditoria final.
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
            Respostas diretas para as dúvidas mais comuns.
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
            <h2>Pronto para colocar seu projeto no ar?</h2>
            <p>
              Seja para publicar do zero, corrigir bugs ou integrar banco de dados e pagamentos: fale comigo no WhatsApp.
            </p>
          </div>
          <div className="lp-cta-actions">
            <a className="lp-btn lp-btn-solid lp-btn-lg" href="#analise">
              Analisar meu projeto
            </a>
            <a
              className="lp-btn lp-btn-ghost lp-btn-lg"
              href={auditWhatsAppUrl(result, domain)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chamar no WhatsApp
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
              href={PROFILE.portfolio}
              target="_blank"
              rel="noopener noreferrer"
            >
              {CONTACT.handle}
            </a>
            <span className="lp-footer-divider" aria-hidden="true">·</span>
            <a
              className="lp-footer-link"
              href={PROFILE.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            <span className="lp-footer-divider" aria-hidden="true">·</span>
            <a
              className="lp-footer-link"
              href={PROFILE.github}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <span className="lp-footer-divider" aria-hidden="true">·</span>
            <a className="lp-footer-link" href="/llms.txt" target="_blank" rel="noopener noreferrer">
              llms.txt
            </a>
          </div>
        </div>
      </footer>

      {/* Dados estruturados. Ficam no corpo, junto do texto que descrevem, e
          por isso saem no HTML pré-renderizado. `application/ld+json` não é
          executado: é dado, e a CSP o trata como tal. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildStructuredData().replace(/</g, '\\u003c') }}
      />
    </div>
  );
};

export default LandingPage;
