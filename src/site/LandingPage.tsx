import React from 'react';
import { buildStructuredData } from '../lib/structuredData';
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
import { useAnaliseDaLanding } from './useAnaliseDaLanding';
import { useBriefing } from './useBriefing';
import { useHoraDoAparelho } from './useHoraDoAparelho';

export const LandingPage: React.FC = () => {
  const {
    phase,
    steps,
    result,
    error,
    domain,
    input,
    setInput,
    submit,
    runFor,
    pularParaAnalise,
    inputRef,
    logRef,
    mobile,
    desktop,
    desktopState,
    counts,
    grouped,
  } = useAnaliseDaLanding();
  const [briefing, setBriefing] = useBriefing(result?.domain);
  const deviceTime = useHoraDoAparelho(mobile?.fetchedAt);

  return (
    <div className="lp">
      {/* Primeiro elemento focável da página. Sem JavaScript, o `href` ainda
          rola até a análise; com ele, o foco vai direto para o campo. */}
      <a className="lp-skip" href="#analise" onClick={pularParaAnalise}>
        Pular para a análise
      </a>

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
