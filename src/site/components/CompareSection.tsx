import React from 'react';
import type { AuditResult, PageSpeedReport } from '../../lib/types';

const tone = (value: number | null): string =>
  value === null ? 'none' : value >= 90 ? 'good' : value >= 50 ? 'mid' : 'bad';

interface CompareSectionProps {
  mobile: PageSpeedReport;
  desktop: PageSpeedReport | null;
  desktopState: 'idle' | 'loading' | 'failed';
  result: AuditResult | null;
}

export const CompareSection: React.FC<CompareSectionProps> = ({
  mobile,
  desktop,
  desktopState,
  result,
}) => (
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
);
