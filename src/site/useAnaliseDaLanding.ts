import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { countBySeverity, groupByArea } from '../lib/achados';
import { isValidDomain, normalizeDomain } from '../lib/dominio';
import type { PageSpeedReport } from '../lib/types';
import { useAudit } from '../lib/useAudit';

export type DesktopState = 'idle' | 'loading' | 'failed';

/**
 * Dispara a medição em computador, ou devolve `null` quando o domínio não é
 * válido e a medição não tem o que medir.
 */
const medirComputador = (domain: string): Promise<PageSpeedReport> | null => {
  if (!isValidDomain(domain)) return null;
  const medicao = import('../lib/sources').then((modulo) =>
    modulo.fetchPageSpeed(domain, 'desktop'),
  );
  // A promessa só é lida depois da auditoria. Sem isto, uma falha rápida
  // vira "unhandled rejection" no console antes de chegarmos ao catch.
  medicao.catch(() => undefined);
  return medicao;
};

/**
 * Estado da análise da página: o campo do domínio, a auditoria, a medição em
 * computador que roda junto dela e a fila do domínio pedido por um card
 * enquanto outra análise ainda corre.
 */
export const useAnaliseDaLanding = () => {
  const [input, setInput] = useState('');
  const [desktop, setDesktop] = useState<PageSpeedReport | null>(null);
  const [desktopState, setDesktopState] = useState<DesktopState>('idle');

  const { phase, steps, result, error, domain, start } = useAudit();
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queuedPresetRef = useRef<string | null>(null);
  const runRef = useRef<(target: string) => Promise<void>>(async () => undefined);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [steps, phase]);

  const counts = useMemo(
    () => (result ? countBySeverity(result.findings) : null),
    [result],
  );

  const grouped = useMemo(() => (result ? groupByArea(result.findings) : []), [result]);

  const run = async (target: string): Promise<void> => {
    if (!target.trim() || phase === 'running') return;

    setDesktop(null);
    setDesktopState('idle');

    // As duas medições são independentes e cada uma leva de 15 a 40 segundos.
    // Encadeá-las custava a soma das duas ao visitante; disparadas juntas, a
    // espera passa a ser a da mais demorada. O domínio já dá para normalizar
    // aqui, então a de computador não precisa esperar a auditoria terminar
    // para saber o que medir.
    const medicaoComputador = medirComputador(normalizeDomain(target));
    if (medicaoComputador) setDesktopState('loading');

    const audit = await start(target);

    if (!medicaoComputador) return;

    // A comparação com computador só faz sentido se a medição móvel funcionou.
    if (!audit?.pagespeed) {
      setDesktopState('idle');
      return;
    }

    try {
      setDesktop(await medicaoComputador);
      setDesktopState('idle');
    } catch {
      setDesktopState('failed');
    }
  };

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    void run(input);
  };

  const runFor = (value: string): void => {
    const target = normalizeDomain(value);
    setInput(target);
    document.getElementById('analise')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (phase === 'running') {
      queuedPresetRef.current = target;
      return;
    }
    void run(target);
    // Sem `preventScroll`, o foco interrompe a rolagem suave acima e deixa o
    // campo no meio da tela, em vez de logo abaixo do cabeçalho.
    inputRef.current?.focus({ preventScroll: true });
  };

  runRef.current = run;

  useEffect(() => {
    if (phase === 'running' || !queuedPresetRef.current) return;
    const target = queuedPresetRef.current;
    queuedPresetRef.current = null;
    void runRef.current(target);
  }, [phase]);

  return {
    phase,
    steps,
    result,
    error,
    domain,
    input,
    setInput,
    submit,
    runFor,
    inputRef,
    logRef,
    mobile: result?.pagespeed ?? null,
    desktop,
    desktopState,
    counts,
    grouped,
  };
};
