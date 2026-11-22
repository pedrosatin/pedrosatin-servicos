import { rotuloDaSecao, secoesVisiveis } from '../site/secoesDaPagina';

const IDS_DO_HERO = ['topo', 'analise'] as const;

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
