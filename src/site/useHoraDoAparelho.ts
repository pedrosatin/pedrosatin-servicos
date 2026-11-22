import { useEffect, useMemo, useState } from 'react';

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
