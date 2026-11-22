import { lazy } from 'react';

export const CompareSection = lazy(() =>
  import('./components/CompareSection').then((module) => ({ default: module.CompareSection })),
);

export const FindingsSection = lazy(() =>
  import('./components/FindingsSection').then((module) => ({ default: module.FindingsSection })),
);

export function preloadSecoesDaAnalise(): void {
  void import('./components/CompareSection').catch(() => undefined);
  void import('./components/FindingsSection').catch(() => undefined);
}
