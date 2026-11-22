export const SECOES_DA_PAGINA = [
  { id: 'comparacao', palavra: 'comparação', condicional: true },
  { id: 'achados', palavra: 'achados', condicional: true },
  { id: 'resolvo', palavra: 'serviços', condicional: false },
  { id: 'google', palavra: 'google', condicional: false },
  { id: 'dominio', palavra: 'domínio', condicional: false },
  { id: 'condicoes', palavra: 'condições', condicional: false },
  { id: 'sobre', palavra: 'sobre', condicional: false },
  { id: 'trabalhos', palavra: 'trabalhos', condicional: false },
  { id: 'atendimento', palavra: 'orçamento', condicional: false },
  { id: 'faq', palavra: 'perguntas', condicional: false },
  { id: 'contato', palavra: 'contato', condicional: false },
] as const;

export type IdSecaoDaPagina = (typeof SECOES_DA_PAGINA)[number]['id'];

export interface CondicoesDeExibicao {
  temComparacao: boolean;
  temAchados: boolean;
}

export const IDS_DA_PAGINA: readonly IdSecaoDaPagina[] = SECOES_DA_PAGINA.map(
  (secao) => secao.id,
);

export function secoesVisiveis({
  temComparacao,
  temAchados,
}: CondicoesDeExibicao): readonly IdSecaoDaPagina[] {
  return SECOES_DA_PAGINA.filter((secao) => {
    if (secao.id === 'comparacao') return temComparacao;
    if (secao.id === 'achados') return temAchados;
    return true;
  }).map((secao) => secao.id);
}

export function rotuloDaSecao(
  id: IdSecaoDaPagina,
  visiveis: readonly IdSecaoDaPagina[] = IDS_DA_PAGINA,
): string {
  const secao = SECOES_DA_PAGINA.find((item) => item.id === id);
  if (!secao) {
    throw new Error(`Seção desconhecida: ${id}`);
  }
  const indice = visiveis.indexOf(id);
  if (indice === -1) {
    throw new Error(`Seção fora da lista visível: ${id}`);
  }
  return `${String(indice + 1).padStart(2, '0')} // ${secao.palavra}`;
}
