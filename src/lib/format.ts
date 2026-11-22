
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
