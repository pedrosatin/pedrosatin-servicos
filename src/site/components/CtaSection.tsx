import React from 'react';
import { auditWhatsAppUrl } from '../../lib/message';
import type { AuditResult } from '../../lib/types';

interface CtaSectionProps {
  result: AuditResult | null;
  domain: string;
}

export const CtaSection: React.FC<CtaSectionProps> = ({ result, domain }) => (
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
);
