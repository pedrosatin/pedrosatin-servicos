import { useEffect, useMemo, useState } from 'react';

/**
 * Hora mostrada na barra do aparelho: a da medição, quando há uma; antes dela,
 * a hora de abertura da página. Ela só é conhecida no navegador: fixá-la na
 * renderização estática serviria a hora da compilação para todos os
 * visitantes, por isso o HTML estático sai com `--:--`.
 */
export const useHoraDoAparelho = (fetchedAt: string | undefined): string => {
  const [openedAt, setOpenedAt] = useState<Date | null>(null);

  useEffect(() => {
    setOpenedAt(new Date());
  }, []);

  return useMemo(() => {
    const when = fetchedAt ? new Date(fetchedAt) : openedAt;
    return when ? when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  }, [fetchedAt, openedAt]);
};
