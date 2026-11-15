import { describe, expect, test } from 'vitest';
import { SECOES_DO_MENU } from './secoesDoMenu';
import { SECOES_DA_PAGINA, rotuloDaSecao, type IdSecaoDaPagina } from './secoesDaPagina';

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

  test('rejeita identificador fora da lista', () => {
    expect(() => rotuloDaSecao('inexistente' as IdSecaoDaPagina)).toThrow();
  });
});
