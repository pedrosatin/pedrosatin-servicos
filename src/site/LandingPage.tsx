import React, { useEffect, useMemo, useRef, useState } from 'react';
import { countBySeverity } from '../lib/achados';
import { isValidDomain, normalizeDomain } from '../lib/dominio';
import { buildStructuredData } from '../lib/structuredData';
import type { Briefing } from '../lib/message';
import type { Finding, PageSpeedReport } from '../lib/types';
import { useAudit } from '../lib/useAudit';
import './LandingPage.css';
import { AboutSection } from './components/AboutSection';
import { CompareSection } from './components/CompareSection';
import { CtaSection } from './components/CtaSection';
import { DomainSection } from './components/DomainSection';
import { FaqSection } from './components/FaqSection';
import { FindingsSection } from './components/FindingsSection';
import { Footer } from './components/Footer';
import { GoogleSection } from './components/GoogleSection';
import { HeroAnalysisSection } from './components/HeroAnalysisSection';
import { RequestSection } from './components/RequestSection';
import { ServicesSection } from './components/ServicesSection';
import { SiteHeader } from './components/SiteHeader';
import { TermsSection } from './components/TermsSection';
import { WorkSection } from './components/WorkSection';

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
    const groups: [Finding['area'], Finding[]][] = [];
    const map = new Map<Finding['area'], Finding[]>();
    for (const finding of result.findings) {
      let list = map.get(finding.area);
      if (list === undefined) {
        list = [finding];
        map.set(finding.area, list);
        groups.push([finding.area, list]);
      } else {
        list.push(finding);
      }
    }
    return groups;
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

  // A barra do aparelho mostra a hora da medição; antes dela, a hora de abertura
  // da página. Ela só é conhecida no navegador: fixá-la na renderização
  // estática serviria a hora da compilação para todos os visitantes.
  const deviceTime = useMemo(() => {
    const when = mobile?.fetchedAt ? new Date(mobile.fetchedAt) : openedAt;
    return when ? when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  }, [mobile?.fetchedAt, openedAt]);

  return (
    <div className="lp">
      <SiteHeader result={result} domain={domain} />

      {/* O conteúdo fica em <main> para que leitores de tela e o "pular para o
          conteúdo" dos navegadores tenham um destino, e para que o buscador
          saiba separar o corpo da página da navegação repetida. */}
      <main className="lp-main">
        {/* ---------- análise: terminal + aparelho ---------- */}
        <HeroAnalysisSection
          phase={phase}
          steps={steps}
          result={result}
          error={error}
          domain={domain}
          input={input}
          onInputChange={setInput}
          onSubmit={submit}
          onAnalyze={runFor}
          inputRef={inputRef}
          logRef={logRef}
          mobile={mobile}
          deviceTime={deviceTime}
          counts={counts}
        />

        {/* ---------- celular contra computador ---------- */}
        {mobile && (
          <CompareSection
            mobile={mobile}
            desktop={desktop}
            desktopState={desktopState}
            result={result}
          />
        )}

        {/* ---------- achados ---------- */}
        {result && (
          <FindingsSection result={result} grouped={grouped} domain={domain} />
        )}

        {/* ---------- o que eu resolvo ---------- */}
        <ServicesSection />

        {/* ---------- google ---------- */}
        <GoogleSection domainToConsult={result?.domain ?? domain ?? 'pedrosatin.com'} />

        {/* ---------- domínio ---------- */}
        <DomainSection
          domain={result?.domain}
          registration={result?.registration ?? null}
        />

        {/* ---------- como trabalho ---------- */}
        <TermsSection />

        {/* ---------- quem faz ---------- */}
        <AboutSection />

        {/* ---------- trabalhos ---------- */}
        <WorkSection onAnalyze={runFor} />

        {/* ---------- atendimento em 3 passos ---------- */}
        <RequestSection briefing={briefing} onChange={setBriefing} result={result} />

        {/* ---------- perguntas ---------- */}
        <FaqSection />

        {/* ---------- fechamento ---------- */}
        <CtaSection result={result} domain={domain} />
      </main>

      <Footer />

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
