import { describe, expect, test } from 'vitest';
import { SECOES_DO_MENU } from './secoesDoMenu';
import {
  SECOES_DA_PAGINA,
  rotuloDaSecao,
  secoesVisiveis,
  type IdSecaoDaPagina,
} from './secoesDaPagina';

describe('SECOES_DA_PAGINA e rotuloDaSecao', () => {
  test('cada seção usa palavra única em minúscula no formato NN // palavra', () => {
    const rotulos = SECOES_DA_PAGINA.map((secao) => rotuloDaSecao(secao.id));

    rotulos.forEach((rotulo, indice) => {
      const numero = String(indice + 1).padStart(2, '0');
      expect(rotulo).toMatch(/^\d{2} \/\/ [a-zà-ú]+$/);
      expect(rotulo.startsWith(`${numero} // `)).toBe(true);
    });
  });

  test('não repete identificadores e cobre todas as seções com h2 do menu', () => {
    const ids = SECOES_DA_PAGINA.map((secao) => secao.id);
    expect(new Set(ids).size).toBe(ids.length);

    const idsDoMenuComH2 = SECOES_DO_MENU.map((secao) => secao.id).filter((id) => id !== 'analise');
    for (const id of idsDoMenuComH2) {
      expect(ids).toContain(id);
    }
  });

  test('enumera em sequência sem lacuna nos três estados de exibição', () => {
    const semAnalise = secoesVisiveis({ temComparacao: false, temAchados: false });
    expect(semAnalise.map((id) => rotuloDaSecao(id, semAnalise))).toEqual([
      '01 // serviços',
      '02 // google',
      '03 // domínio',
      '04 // condições',
      '05 // sobre',
      '06 // trabalhos',
      '07 // orçamento',
      '08 // perguntas',
      '09 // contato',
    ]);

    const completa = secoesVisiveis({ temComparacao: true, temAchados: true });
    expect(completa.map((id) => rotuloDaSecao(id, completa))).toEqual([
      '01 // comparação',
      '02 // achados',
      '03 // serviços',
      '04 // google',
      '05 // domínio',
      '06 // condições',
      '07 // sobre',
      '08 // trabalhos',
      '09 // orçamento',
      '10 // perguntas',
      '11 // contato',
    ]);

    const semPageSpeed = secoesVisiveis({ temComparacao: false, temAchados: true });
    expect(semPageSpeed.map((id) => rotuloDaSecao(id, semPageSpeed))).toEqual([
      '01 // achados',
      '02 // serviços',
      '03 // google',
      '04 // domínio',
      '05 // condições',
      '06 // sobre',
      '07 // trabalhos',
      '08 // orçamento',
      '09 // perguntas',
      '10 // contato',
    ]);
  });

  test('rejeita identificador fora da lista ou ausente das seções visíveis', () => {
    expect(() => rotuloDaSecao('inexistente' as IdSecaoDaPagina)).toThrow();
    const semAnalise = secoesVisiveis({ temComparacao: false, temAchados: false });
    expect(() => rotuloDaSecao('comparacao', semAnalise)).toThrow();
    expect(() => rotuloDaSecao('achados', semAnalise)).toThrow();
  });
});
