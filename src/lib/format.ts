/** Formatadores usados na apresentação dos resultados. */

export const formatMs = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
};

export const formatBytes = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
};

export const formatDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

export const formatDateTime = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const formatScore = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : String(value);

/** Verde acima de 90, âmbar entre 50 e 89, vermelho abaixo — a escala do Lighthouse. */
export const scoreTone = (value: number | null | undefined): 'good' | 'average' | 'poor' | 'none' => {
  if (value === null || value === undefined) return 'none';
  if (value >= 90) return 'good';
  if (value >= 50) return 'average';
  return 'poor';
};

