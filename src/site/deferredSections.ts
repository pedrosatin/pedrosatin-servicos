import { lazy } from 'react';

export const CompareSection = lazy(() =>
  import('./components/CompareSection').then((module) => ({ default: module.CompareSection })),
);

export const FindingsSection = lazy(() =>
  import('./components/FindingsSection').then((module) => ({ default: module.FindingsSection })),
);

/**
 * Pede os dois chunks no começo da análise. Eles chegam enquanto as medições
 * rodam, e uma falha de carregamento acontece antes do resultado existir, sem
 * descartar uma análise pronta. O erro fica com `vite:preloadError` e com o
 * boundary da seção.
 */
export function preloadSecoesDaAnalise(): void {
  void import('./components/CompareSection').catch(() => undefined);
  void import('./components/FindingsSection').catch(() => undefined);
}
