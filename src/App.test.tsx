import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { App } from './App';

vi.mock('./site/LandingPage', () => ({
  LandingPage: () => <div data-testid="landing-page-mock">Mocked Landing Page</div>,
}));

describe('App Component', () => {
  it('renders the LandingPage component', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('landing-page-mock')).toBeInTheDocument();
  });
});
