/**
 * Ordem e rótulo de terminal das seções permanentes que têm título `h2`.
 *
 * Os números sequenciais com dois dígitos nascem da posição nesta lista para que
 * uma reordenação na página não obrigue a renumerar cada componente à mão.
 * O herói usa título `h1` com eyebrow próprio, e as seções condicionais da
 * auditoria ficam fora da sequência porque só aparecem depois de uma análise
 * e entram acima da primeira seção fixa.
 */
export const SECOES_DA_PAGINA = [
  { id: 'resolvo', palavra: 'serviços' },
  { id: 'google', palavra: 'google' },
  { id: 'dominio', palavra: 'domínio' },
  { id: 'condicoes', palavra: 'condições' },
  { id: 'sobre', palavra: 'sobre' },
  { id: 'trabalhos', palavra: 'trabalhos' },
  { id: 'atendimento', palavra: 'orçamento' },
  { id: 'faq', palavra: 'perguntas' },
  { id: 'contato', palavra: 'contato' },
] as const;

export type IdSecaoDaPagina = (typeof SECOES_DA_PAGINA)[number]['id'];

export function rotuloDaSecao(id: IdSecaoDaPagina): string {
  const indice = SECOES_DA_PAGINA.findIndex((secao) => secao.id === id);
  const secao = SECOES_DA_PAGINA[indice];
  if (!secao) {
    throw new Error(`Seção desconhecida: ${id}`);
  }
  return `${String(indice + 1).padStart(2, '0')} // ${secao.palavra}`;
}
