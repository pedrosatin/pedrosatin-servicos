/**
 * Seções da página exibidas na navegação do cabeçalho.
 *
 * A barra fixa em telas largas e o painel do menu no celular usam esta mesma
 * lista para que os destinos, os rótulos e o destaque de orçamento fiquem
 * sempre iguais.
 */
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
