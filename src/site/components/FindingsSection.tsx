import React from 'react';
import { AREA_LABELS } from '../../lib/achados';
import type { Finding } from '../../lib/types';

const SEVERITY_TAG: Record<string, string> = {
  critical: 'CRÍTICO',
  warning: 'ATENÇÃO',
  info: 'OBSERVAÇÃO',
  good: 'OK',
};

interface FindingsSectionProps {
  findings: Finding[];
}

export const FindingsSection: React.FC<FindingsSectionProps> = ({ findings }) => {
  if (findings.length === 0) return null;

  return (
    <section className="lp-findings">
      <div className="lp-wrap">
        <h2 className="lp-h2">Relatório do site</h2>
        <p className="lp-h2-sub">
          A situação técnica por trás da tela, mostrada de forma que dá para entender.
        </p>

        <div className="lp-findings-list">
          {findings.map((f, i) => (
            <div
              key={i}
              className={`lp-finding-card severity-${f.severity} area-${f.area}`}
            >
              <div className="lp-finding-header">
                <span className="lp-finding-area">{AREA_LABELS[f.area]}</span>
                <span className="lp-finding-severity">
                  {SEVERITY_TAG[f.severity]}
                </span>
              </div>
              <h3 className="lp-finding-title">{f.title}</h3>
              <p className="lp-finding-desc"><span className="lp-finding-evidence">{f.evidence}</span><span className="lp-finding-action">{f.action}</span></p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
