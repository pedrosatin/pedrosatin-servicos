import React from 'react';
import { AREA_LABELS } from '../../lib/achados';
import { auditWhatsAppUrl } from '../../lib/message';
import type { AuditResult, Finding, Severity } from '../../lib/types';

const SEVERITY_TAG: Record<Severity, string> = {
  critical: 'CRÍTICO',
  warning: 'ATENÇÃO',
  info: 'OBSERVAÇÃO',
  good: 'OK',
};

interface FindingsSectionProps {
  result: AuditResult;
  grouped: Array<[Finding['area'], Finding[]]>;
  domain: string;
}

export const FindingsSection: React.FC<FindingsSectionProps> = ({
  result,
  grouped,
  domain,
}) => (
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
);
