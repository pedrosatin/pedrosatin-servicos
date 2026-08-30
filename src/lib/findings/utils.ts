export const ms = (value: number | null): string =>
  value === null ? '—' : value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;

export const kb = (bytes: number): string =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

export const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
