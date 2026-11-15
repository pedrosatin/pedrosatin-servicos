import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { Briefing } from '../../lib/message';
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
    expect(grupo.querySelectorAll('button[aria-pressed]')).toHaveLength(6);
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
