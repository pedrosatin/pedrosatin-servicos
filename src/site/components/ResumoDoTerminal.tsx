import React from 'react';
import { resumoDoVeredito } from '../../lib/anuncio';
import type { AuditResult } from '../../lib/types';
import type { AuditPhase } from '../../lib/useAudit';

export const ID_RESULTADO = 'resultado';

interface ResumoDoTerminalProps {
  phase: AuditPhase;
  result: AuditResult | null;
}

const irParaOResultado = (event: React.MouseEvent): void => {
  event.preventDefault();
  const alvo = document.getElementById(ID_RESULTADO);
  alvo?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  alvo?.focus({ preventScroll: true });
};

/**
 * Linha de fechamento exibida no fim do terminal quando a análise termina.
 *
 * Reaproveita `resumoDoVeredito` da região `role="status"` em
 * `AnuncioDaAuditoria`. Como o leitor de tela já anuncia e guarda esse mesmo
 * texto na região de status, o texto visual recebe `aria-hidden="true"` para
 * evitar leitura duplicada. O link `ver resultado` segue na árvore de
 * acessibilidade para que teclado e leitor de tela saltem direto ao veredito.
 */
export const ResumoDoTerminal: React.FC<ResumoDoTerminalProps> = ({ phase, result }) => {
  if (phase !== 'done' || !result) return null;

  return (
    <div className={`lp-terminal-summary ${result.score ? '' : 'no-score'}`}>
      <span className="lp-terminal-summary-text" aria-hidden="true">
        {resumoDoVeredito(result)}
      </span>
      <a className="lp-terminal-summary-link" href={`#${ID_RESULTADO}`} onClick={irParaOResultado}>
        ver resultado
      </a>
    </div>
  );
};
