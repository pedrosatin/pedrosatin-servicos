import { useCallback, useRef, useState } from 'react';
import type { AuditOptions } from './audit';
import { normalizeDomain } from './dominio';
import type { AuditResult, AuditStep } from './types';

export type AuditPhase = 'idle' | 'running' | 'done' | 'error';

export interface UseAuditReturn {
  phase: AuditPhase;
  steps: AuditStep[];
  result: AuditResult | null;
  error: string | null;
  domain: string;
  start: (input: string) => Promise<AuditResult | null>;
  reset: () => void;
}

/**
 * Hook compartilhado pelos protótipos. Mantém o estado das etapas para que a
 * interface acompanhe a auditoria enquanto ela acontece.
 */
export const useAudit = (options: AuditOptions = {}): UseAuditReturn => {
  const [phase, setPhase] = useState<AuditPhase>('idle');
  const [steps, setSteps] = useState<AuditStep[]>([]);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState('');

  // Evita que uma auditoria antiga sobrescreva o resultado de outra mais nova.
  const runId = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const start = useCallback(async (input: string): Promise<AuditResult | null> => {
    const target = normalizeDomain(input);
    const current = runId.current + 1;
    runId.current = current;

    setDomain(target);
    setPhase('running');
    setError(null);
    setResult(null);

    try {
      // O motor da análise só serve depois deste clique, e responder à primeira
      // pintura da página é o que decide a nota de quem chega pelo celular. Por
      // isso ele é buscado aqui, e não no pacote que abre a página. A espera é
      // de um arquivo já em cache do mesmo domínio, muito menor que os 15 a 40
      // segundos da medição que vem em seguida.
      const { createSteps, runAudit } = await import('./audit');

      if (runId.current !== current) return null;
      setSteps(createSteps(target));

      const audit = await runAudit(input, {
        ...optionsRef.current,
        onStep: (step) => {
          if (runId.current !== current) return;
          setSteps((previous) => {
            const index = previous.findIndex((s) => s.id === step.id);
            if (index === -1) return [...previous, step];
            const next = [...previous];
            next[index] = step;
            return next;
          });
          optionsRef.current.onStep?.(step);
        },
      });

      if (runId.current !== current) return null;
      setResult(audit);
      setPhase('done');
      return audit;
    } catch (err) {
      if (runId.current !== current) return null;
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a análise.');
      setPhase('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    setPhase('idle');
    setSteps([]);
    setResult(null);
    setError(null);
    setDomain('');
  }, []);

  return { phase, steps, result, error, domain, start, reset };
};
