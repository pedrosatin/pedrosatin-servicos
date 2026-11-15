// @vitest-environment node
import { expect, test } from 'vitest';
import { render } from './entry-server';

test('pré-renderiza todas as seções sem scripts de streaming nem boundaries pendentes', () => {
  const html = render();
  for (const id of ['topo', 'analise', 'resolvo', 'google', 'dominio', 'sobre', 'trabalhos', 'atendimento', 'faq']) {
    expect(html).toContain(`id="${id}"`);
  }
  expect(html).not.toContain('<!--$?-->');
  expect(html).not.toContain('<!--$!-->');
  expect(html).not.toContain('$RC(');
});
