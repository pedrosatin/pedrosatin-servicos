/**
 * Textos curtos que resumem a auditoria para quem não está olhando o terminal:
 * a região `role="status"` da página e o resumo que fecha o terminal.
 *
 * O número só aparece quando o resultado traz `score`. Com cobertura
 * incompleta, `scoreFromFindings` devolve `null` e o texto diz "sem nota",
 * porque qualquer valor seria calculado sobre fontes que não responderam.
 */

import type { AuditResult } from './types';
import type { AuditPhase } from './useAudit';

type Veredito = Pick<AuditResult, 'score' | 'coverage'>;

const minusculaInicial = (texto: string): string =>
  texto.charAt(0).toLowerCase() + texto.slice(1);

/** "Nota 92 de 100: bem resolvido" ou "Sem nota: cobertura incompleta". */
export const resumoDoVeredito = ({ score }: Veredito): string =>
  score
    ? `Nota ${score.value} de 100: ${minusculaInicial(score.label)}`
    : 'Sem nota: cobertura incompleta';

/** O que faltou medir, na mesma redação do aviso de análise incompleta. */
export const motivoSemNota = ({ score, coverage }: Veredito): string | null =>
  score || coverage.missing.length === 0
    ? null
    : `Não foi possível concluir ${coverage.missing.join(' e ')}.`;

interface EstadoDoAnuncio {
  phase: AuditPhase;
  domain: string;
  result: AuditResult | null;
}

/**
 * Texto da região `role="status"`. Anuncia o início e o fim da análise; as
 * linhas do terminal ficam de fora para o leitor de tela não ler cada etapa.
 * O erro vai para a região `role="alert"`, então aqui ele dá texto vazio.
 */
export const anuncioDaAuditoria = ({ phase, domain, result }: EstadoDoAnuncio): string => {
  if (phase === 'running') return `Análise de ${domain} iniciada.`;
  if (phase !== 'done' || !result) return '';

  const motivo = motivoSemNota(result);
  const concluida = `Análise de ${result.domain} concluída. ${resumoDoVeredito(result)}.`;
  return motivo ? `${concluida} ${motivo}` : concluida;
};
