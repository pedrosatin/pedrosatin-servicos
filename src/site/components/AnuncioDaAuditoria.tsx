import React from 'react';
import { anuncioDaAuditoria } from '../../lib/anuncio';
import type { AuditResult } from '../../lib/types';
import type { AuditPhase } from '../../lib/useAudit';

interface AnuncioDaAuditoriaProps {
  phase: AuditPhase;
  domain: string;
  result: AuditResult | null;
}

export const AnuncioDaAuditoria: React.FC<AnuncioDaAuditoriaProps> = ({
  phase,
  domain,
  result,
}) => (
  <p role="status" className="lp-sr-only">
    {anuncioDaAuditoria({ phase, domain, result })}
  </p>
);
