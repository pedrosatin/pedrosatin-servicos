import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { Briefing } from '../../lib/message';
import { FAQ_ITEMS } from '../../lib/faq';
import { PRAZO_DEPLOY } from '../../lib/prazos';
import { NEEDS } from '../../lib/services';
import { RequestSection } from './RequestSection';

const Formulario = () => {
  const [briefing, setBriefing] = useState<Briefing>({
    name: '',
    activity: '',
    need: '',
    currentSite: '',
    notes: '',
  });
  return <RequestSection briefing={briefing} onChange={setBriefing} result={null} />;
};

describe('RequestSection: necessidades', () => {
  test('agrupa as opções sob o título do passo', () => {
    render(<Formulario />);

    const grupo = screen.getByRole('group', { name: 'Do que você precisa' });
    expect(grupo.querySelectorAll('button[aria-pressed]')).toHaveLength(7);
  });

  test('"Quero que meu site apareça no Google" vem antes de "Ainda não sei", que fica por último', () => {
    render(<Formulario />);

    const grupo = screen.getByRole('group', { name: 'Do que você precisa' });
    const textos = Array.from(grupo.querySelectorAll('button')).map((b) => b.textContent);

    expect(textos.slice(-2)).toEqual([NEEDS.google, NEEDS.naoSei]);
  });

  test('aria-pressed acompanha a opção escolhida', () => {
    render(<Formulario />);
    const bugs = screen.getByRole('button', { name: /está com bugs/ });
    const lento = screen.getByRole('button', { name: /lento ou quebrado/ });

    expect(bugs).toHaveAttribute('aria-pressed', 'false');
    expect(lento).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(bugs);
    expect(bugs).toHaveAttribute('aria-pressed', 'true');
    expect(lento).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(lento);
    expect(bugs).toHaveAttribute('aria-pressed', 'false');
    expect(lento).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('RequestSection: o que acontece depois', () => {
  const etapas = () => {
    render(<Formulario />);
    const lista = screen.getByRole('list');
    return within(lista).getAllByRole('listitem');
  };

  test('mantém os 3 passos numa lista ordenada', () => {
    const itens = etapas();

    expect(screen.getByRole('list').tagName).toBe('OL');
    expect(itens).toHaveLength(3);
  });

  test.each([
    [
      0,
      'Levantamento',
      'resposta em horário comercial, sem custo',
      'manda o link ou descreve o projeto',
    ],
    [1, 'Orçamento', 'junto com o levantamento', 'aprova o escopo escrito e o valor'],
    [
      2,
      'Execução e entrega',
      'deploy em 1 a 3 dias úteis; demais serviços, o prazo do orçamento',
      'cria as contas no seu nome (domínio, hospedagem) e me dá acesso',
    ],
  ])('passo %i (%s) mostra o prazo e o que o cliente faz', (indice, titulo, prazo, voceFaz) => {
    const item = etapas()[indice]!;

    expect(within(item).getByText(titulo)).toBeInTheDocument();
    expect(within(item).getByText('Prazo').nextElementSibling).toHaveTextContent(prazo);
    expect(within(item).getByText('Você faz').nextElementSibling).toHaveTextContent(voceFaz);
  });

  test('rótulos e valores são termo e definição, lidos como par', () => {
    const item = etapas()[0]!;

    expect(item.querySelectorAll('dt')).toHaveLength(2);
    expect(item.querySelectorAll('dd')).toHaveLength(2);
  });

  test('o prazo de deploy do passo 3 é o mesmo que o FAQ promete', () => {
    const passo3 = etapas()[2]!;
    const faq = FAQ_ITEMS.find((item) => item.q.startsWith('Em quanto tempo'))!;

    expect(passo3).toHaveTextContent(PRAZO_DEPLOY);
    expect(faq.a.join(' ')).toContain(PRAZO_DEPLOY);
  });
});
