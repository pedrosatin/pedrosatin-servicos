import { useEffect, useState } from 'react';
import type { Briefing } from '../lib/message';
import { ID_CAMPO_NOME } from './components/RequestSection';

const BRIEFING_VAZIO: Briefing = {
  name: '',
  activity: '',
  need: '',
  currentSite: '',
  notes: '',
};

/**
 * Rola até o formulário e põe o foco no campo Nome. Como na análise, o foco
 * usa `preventScroll`. Sem essa opção, ele interrompe a rolagem suave e deixa
 * o campo no meio da tela, com o título do formulário fora de vista.
 */
const irParaOFormulario = (): void => {
  document.getElementById('atendimento')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById(ID_CAMPO_NOME)?.focus({ preventScroll: true });
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

  /** Destino do link "Quero resolver isso" de cada card de serviço. */
  const escolherNecessidade = (need: string): void => {
    setBriefing((prev) => ({ ...prev, need }));
    irParaOFormulario();
  };

  return [briefing, setBriefing, escolherNecessidade] as const;
};
