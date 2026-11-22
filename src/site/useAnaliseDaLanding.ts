import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { countBySeverity, groupByArea } from '../lib/achados';
import { isValidDomain, normalizeDomain } from '../lib/dominio';
import type { PageSpeedReport } from '../lib/types';
import { useAudit } from '../lib/useAudit';
import { preloadSecoesDaAnalise } from './deferredSections';

export type DesktopState = 'idle' | 'loading' | 'failed';

const medirComputador = (domain: string): Promise<PageSpeedReport> | null => {
  if (!isValidDomain(domain)) return null;
  const medicao = import('../lib/sources').then((modulo) =>
    modulo.fetchPageSpeed(domain, 'desktop'),
  );
  medicao.catch(() => undefined);
  return medicao;
};

const rolarAteAnalise = (): void => {
  document.getElementById('analise')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const focarCampo = (campo: HTMLInputElement | null): void => {
  const alvo = campo && !campo.disabled ? campo : document.getElementById('analise');
  alvo?.focus({ preventScroll: true });
};

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
    preloadSecoesDaAnalise();

    const medicaoComputador = medirComputador(normalizeDomain(target));
    if (medicaoComputador) setDesktopState('loading');

    const audit = await start(target);

    if (!medicaoComputador) return;

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
    rolarAteAnalise();
    if (phase === 'running') {
      queuedPresetRef.current = target;
      return;
    }
    void run(target);
    focarCampo(inputRef.current);
  };

  const pularParaAnalise = (event: React.MouseEvent): void => {
    event.preventDefault();
    rolarAteAnalise();
    focarCampo(inputRef.current);
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
    pularParaAnalise,
    inputRef,
    logRef,
    mobile: result?.pagespeed ?? null,
    desktop,
    desktopState,
    counts,
    grouped,
  };
};
