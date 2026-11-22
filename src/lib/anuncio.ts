
import type { AuditResult } from './types';
import type { AuditPhase } from './useAudit';

type Veredito = Pick<AuditResult, 'score' | 'coverage'>;

const minusculaInicial = (texto: string): string =>
  texto.charAt(0).toLowerCase() + texto.slice(1);

export const resumoDoVeredito = ({ score }: Veredito): string =>
  score
    ? `Nota ${score.value} de 100: ${minusculaInicial(score.label)}`
    : 'Sem nota: cobertura incompleta';

export const motivoSemNota = ({ score, coverage }: Veredito): string | null =>
  score || coverage.missing.length === 0
    ? null
    : `Não foi possível concluir ${coverage.missing.join(' e ')}.`;

interface EstadoDoAnuncio {
  phase: AuditPhase;
  domain: string;
  result: AuditResult | null;
}

export const anuncioDaAuditoria = ({ phase, domain, result }: EstadoDoAnuncio): string => {
  if (phase === 'running') return `Análise de ${domain} iniciada.`;
  if (phase !== 'done' || !result) return '';

  const motivo = motivoSemNota(result);
  const concluida = `Análise de ${result.domain} concluída. ${resumoDoVeredito(result)}.`;
  return motivo ? `${concluida} ${motivo}` : concluida;
};
