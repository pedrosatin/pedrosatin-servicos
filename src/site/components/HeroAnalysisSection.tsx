import React from 'react';
import { CASE_STUDIES, CONTACT, PROFILE } from '../../lib/config';
import { formatMs } from '../../lib/format';
import { auditWhatsAppUrl } from '../../lib/message';
import { googleIndexUrl } from '../../lib/dominio';
import type { AuditResult, AuditStep, PageSpeedReport } from '../../lib/types';
import type { AuditPhase } from '../../lib/useAudit';
import { DeviceStatusBar } from './DeviceStatusBar';
import { StatusGlyph } from './StatusGlyph';

interface SeverityCounts {
  critical: number;
  warning: number;
  info: number;
  good: number;
}

interface HeroAnalysisSectionProps {
  phase: AuditPhase;
  steps: AuditStep[];
  result: AuditResult | null;
  error: string | null;
  domain: string;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onAnalyze: (domain: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  logRef: React.RefObject<HTMLDivElement | null>;
  mobile: PageSpeedReport | null;
  deviceTime: string;
  counts: SeverityCounts | null;
}

export const HeroAnalysisSection: React.FC<HeroAnalysisSectionProps> = ({
  phase,
  steps,
  result,
  error,
  domain,
  input,
  onInputChange,
  onSubmit,
  onAnalyze,
  inputRef,
  logRef,
  mobile,
  deviceTime,
  counts,
}) => (
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
            <form className="lp-prompt" onSubmit={onSubmit}>
              <span className="lp-prompt-sign">$</span>
              <span className="lp-prompt-cmd">analisar</span>
              <input
                ref={inputRef}
                className="lp-prompt-input"
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
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
                    <button key={item.domain} type="button" onClick={() => onAnalyze(item.domain)}>
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
);
