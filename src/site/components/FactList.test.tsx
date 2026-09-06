import { render } from '@testing-library/react';
import { expect, describe, test } from 'vitest';
import { FactList } from './FactList';

describe('FactList', () => {
  test('renders a <ul> by default with one <li> per item', () => {
    const { container } = render(
      <FactList
        items={[
          { label: 'Um', value: 'primeiro' },
          { label: 'Dois', value: 'segundo' },
        ]}
      />,
    );

    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list?.hasAttribute('class')).toBe(false);

    const items = Array.from(container.querySelectorAll('li'));
    expect(items).toHaveLength(2);
    expect(items[0]?.innerHTML).toBe('<strong>Um</strong><span>primeiro</span>');
    expect(items[1]?.querySelector('strong')?.textContent).toBe('Dois');
    expect(items[1]?.querySelector('span')?.textContent).toBe('segundo');
  });

  test('renders an <ol> when as="ol" and applies className', () => {
    const { container } = render(
      <FactList as="ol" className="lp-about-facts" items={[{ label: 'X', value: 'y' }]} />,
    );

    const list = container.querySelector('ol');
    expect(list).not.toBeNull();
    expect(list?.getAttribute('class')).toBe('lp-about-facts');
    expect(container.querySelector('ul')).toBeNull();
  });
});
