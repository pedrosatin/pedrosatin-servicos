import { lazy } from 'react';

export const CompareSection = lazy(() =>
  import('./components/CompareSection').then((module) => ({ default: module.CompareSection })),
);

export const FindingsSection = lazy(() =>
  import('./components/FindingsSection').then((module) => ({ default: module.FindingsSection })),
);
