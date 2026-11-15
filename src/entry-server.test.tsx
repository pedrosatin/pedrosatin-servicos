// @vitest-environment node
import { expect, test } from 'vitest';
import { faltasNoSsr, render } from './entry-server';

test('pré-renderiza o hero e todas as seções permanentes, em ordem, sem boundary pendente', () => {
  const html = render();
  expect(faltasNoSsr(html)).toEqual([]);
  expect(html).not.toContain('$RC(');
});

test('acusa seção ausente, inclusive as que não têm id', () => {
  const html = render();
  const semCondicoes = html.replace('>04 // condições<', '><');
  expect(faltasNoSsr(semCondicoes)).toEqual(['rótulo 04 // condições']);
  expect(faltasNoSsr(html.replace(' id="topo"', ''))).toEqual(['id topo']);
  expect(faltasNoSsr(`${html}<!--$!-->`)).toEqual(['seção suspensa ou incompleta']);
});
