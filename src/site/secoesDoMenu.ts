export interface SecaoDoMenu {
  id: string;
  label: string;
  destaque?: boolean;
}

export const SECOES_DO_MENU: SecaoDoMenu[] = [
  { id: 'analise', label: 'Análise' },
  { id: 'resolvo', label: 'O que eu resolvo' },
  { id: 'google', label: 'Google' },
  { id: 'dominio', label: 'Domínio' },
  { id: 'sobre', label: 'Sobre mim' },
  { id: 'trabalhos', label: 'Trabalhos' },
  { id: 'faq', label: 'Perguntas' },
  { id: 'atendimento', label: 'Orçamento', destaque: true },
];
