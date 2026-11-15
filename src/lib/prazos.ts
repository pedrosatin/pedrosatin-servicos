/**
 * Prazos prometidos na página, num lugar só.
 *
 * Os passos de "O que acontece depois" e a resposta do FAQ sobre prazo leem
 * daqui. Com cópias separadas, um número muda num lado e o outro continua
 * prometendo o antigo.
 */
export const PRAZO_DEPLOY = '1 a 3 dias úteis';

export interface EtapaDepois {
  /** Nome do passo, na mesma ordem em que aparece na página. */
  etapa: string;
  prazo: string;
  voceFaz: string;
}

export const ETAPAS_DEPOIS: EtapaDepois[] = [
  {
    etapa: 'Levantamento',
    prazo: 'resposta em horário comercial, sem custo',
    voceFaz: 'manda o link ou descreve o projeto',
  },
  {
    etapa: 'Orçamento',
    prazo: 'junto com o levantamento',
    voceFaz: 'aprova o escopo escrito e o valor',
  },
  {
    etapa: 'Execução e entrega',
    prazo: `deploy em ${PRAZO_DEPLOY}; demais serviços, o prazo do orçamento`,
    voceFaz: 'cria as contas no seu nome (domínio, hospedagem) e me dá acesso',
  },
];
