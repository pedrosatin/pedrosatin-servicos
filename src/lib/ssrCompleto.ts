import { rotuloDaSecao, secoesVisiveis } from '../site/secoesDaPagina';

/** Ids do hero, que fica fora da numeração de seções. */
const IDS_DO_HERO = ['topo', 'analise'] as const;

/**
 * Lista o que falta no HTML pré-renderizado para ele ter a página inteira.
 *
 * O prerender e o teste do SSR usam esta função, então os dois leem a mesma
 * lista de seções. Cada seção permanente é procurada pelo rótulo `NN // palavra`,
 * que existe mesmo nas seções sem `id`, e a ordem dos rótulos também é conferida.
 */
export function faltasNoSsr(html: string): string[] {
  const faltas: string[] = [];
  if (/<!--\$(?:!|\?)-->/.test(html)) faltas.push('seção suspensa ou incompleta');
  for (const id of IDS_DO_HERO) {
    if (!html.includes(` id="${id}"`)) faltas.push(`id ${id}`);
  }
  const permanentes = secoesVisiveis({ temComparacao: false, temAchados: false });
  let desde = 0;
  for (const id of permanentes) {
    const rotulo = rotuloDaSecao(id, permanentes);
    const posicao = html.indexOf(`>${rotulo}<`, desde);
    if (posicao === -1) {
      faltas.push(`rótulo ${rotulo}`);
      continue;
    }
    desde = posicao;
  }
  return faltas;
}
