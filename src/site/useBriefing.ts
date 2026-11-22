import { useEffect, useState } from 'react';
import type { Briefing } from '../lib/message';
import { ID_CAMPO_NOME } from './fieldIds';

const BRIEFING_VAZIO: Briefing = {
  name: '',
  activity: '',
  need: '',
  currentSite: '',
  notes: '',
};

const irParaOFormulario = (): void => {
  document.getElementById('atendimento')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById(ID_CAMPO_NOME)?.focus({ preventScroll: true });
};

export const useBriefing = (siteAnalisado: string | undefined) => {
  const [briefing, setBriefing] = useState<Briefing>(BRIEFING_VAZIO);

  useEffect(() => {
    if (siteAnalisado) {
      setBriefing((prev) => (prev.currentSite ? prev : { ...prev, currentSite: siteAnalisado }));
    }
  }, [siteAnalisado]);

  const escolherNecessidade = (need: string): void => {
    setBriefing((prev) => ({ ...prev, need }));
    irParaOFormulario();
  };

  return [briefing, setBriefing, escolherNecessidade] as const;
};
