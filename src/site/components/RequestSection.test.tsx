import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { Briefing } from '../../lib/message';
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
