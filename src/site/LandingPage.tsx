import React, { useMemo } from 'react';
import { buildStructuredData } from '../lib/structuredData';
import './LandingPage.css';
import { CompareSection, FindingsSection } from './deferredSections';
import { LazySection } from './components/LazySection';
import { AboutSection } from './components/AboutSection';
import { CtaSection } from './components/CtaSection';
import { DomainSection } from './components/DomainSection';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { GoogleSection } from './components/GoogleSection';
import { HeroAnalysisSection } from './components/HeroAnalysisSection';
import { RequestSection } from './components/RequestSection';
import { ServicesSection } from './components/ServicesSection';
import { SiteHeader } from './components/SiteHeader';
import { TermsSection } from './components/TermsSection';
import { WorkSection } from './components/WorkSection';
import { SecoesVisiveisContext } from './SecoesVisiveisContext';
import { secoesVisiveis } from './secoesDaPagina';
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
  const [briefing, setBriefing, escolherNecessidade] = useBriefing(result?.domain);
  const deviceTime = useHoraDoAparelho(mobile?.fetchedAt);
  const visiveis = useMemo(
    () => secoesVisiveis({ temComparacao: Boolean(mobile), temAchados: Boolean(result) }),
    [mobile, result],
  );
  const rodapeAlternado = (1 + visiveis.length) % 2 === 1;

  return (
    <div className="lp">
      <a className="lp-skip" href="#analise" onClick={pularParaAnalise}>
        Pular para a análise
      </a>

      <SiteHeader result={result} domain={domain} />

      <SecoesVisiveisContext.Provider value={visiveis}>
        <main className="lp-main">
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

          {mobile && (
            <LazySection>
              <CompareSection
                mobile={mobile}
                desktop={desktop}
                desktopState={desktopState}
                result={result}
              />
            </LazySection>
          )}

          {result && (
            <LazySection>
              <FindingsSection result={result} grouped={grouped} domain={domain} />
            </LazySection>
          )}

          <ServicesSection onQueroResolver={escolherNecessidade} />

          <GoogleSection domainToConsult={result?.domain ?? domain ?? 'pedrosatin.com'} />

          <DomainSection
            domain={result?.domain}
            registration={result?.registration ?? null}
          />

          <TermsSection />

          <AboutSection />

          <WorkSection onAnalyze={runFor} />

          <RequestSection briefing={briefing} onChange={setBriefing} result={result} />

          <FaqSection />

          <CtaSection result={result} domain={domain} />
        </main>
      </SecoesVisiveisContext.Provider>

      <Footer fundoAlternado={rodapeAlternado} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildStructuredData().replace(/</g, '\\u003c') }}
      />
    </div>
  );
};

export default LandingPage;
