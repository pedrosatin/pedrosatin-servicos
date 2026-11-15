import { useEffect, useState } from 'react';
import type { Briefing } from '../lib/message';

const BRIEFING_VAZIO: Briefing = {
  name: '',
  activity: '',
  need: '',
  currentSite: '',
  notes: '',
};

/**
 * Briefing do formulário de atendimento. O site analisado preenche o campo do
 * site atual, para a pessoa não digitar duas vezes, sem sobrescrever o que ela
 * já escreveu ali.
 */
export const useBriefing = (siteAnalisado: string | undefined) => {
  const [briefing, setBriefing] = useState<Briefing>(BRIEFING_VAZIO);

  useEffect(() => {
    if (siteAnalisado) {
      setBriefing((prev) => (prev.currentSite ? prev : { ...prev, currentSite: siteAnalisado }));
    }
  }, [siteAnalisado]);

  return [briefing, setBriefing] as const;
};
