import React from 'react';
import { CASE_STUDIES } from '../../lib/config';

interface WorkSectionProps {
  onAnalyze: (domain: string) => void;
}

export const WorkSection: React.FC<WorkSectionProps> = ({ onAnalyze }) => (
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
              <button type="button" onClick={() => onAnalyze(item.domain)}>
                analisar este
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);
