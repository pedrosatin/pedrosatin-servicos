import React from 'react';
import { anuncioDaAuditoria } from '../../lib/anuncio';
import type { AuditResult } from '../../lib/types';
import type { AuditPhase } from '../../lib/useAudit';

interface AnuncioDaAuditoriaProps {
  phase: AuditPhase;
  domain: string;
  result: AuditResult | null;
}

/**
 * Região lida pelo leitor de tela, invisível na tela. Ela sai vazia no HTML
 * pré-renderizado. O leitor só anuncia mudanças em uma região que já existia,
 * então montá-la junto com o texto faria o primeiro anúncio se perder.
 */
export const AnuncioDaAuditoria: React.FC<AnuncioDaAuditoriaProps> = ({
  phase,
  domain,
  result,
}) => (
  <p role="status" className="lp-sr-only">
    {anuncioDaAuditoria({ phase, domain, result })}
  </p>
);
