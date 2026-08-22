import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, describe, test, vi, beforeEach } from 'vitest';
import LandingPage from './LandingPage';
import * as sources from '../lib/sources';
import * as useAudit from '../lib/useAudit';

vi.mock('../lib/sources', () => ({
  fetchPageSpeed: vi.fn(),
}));

// Create a custom hook to mock useAudit that maintains state
const useMockAudit = () => {
  const [state, setState] = useState<{ phase: string, steps: any[], result: any, error: any, domain: string }>({
    phase: 'idle',
    steps: [],
    result: null,
    error: null,
    domain: '',
  });

  const start = async (input: string) => {
    setState(prev => ({ ...prev, phase: 'running', domain: input }));

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = {
      domain: input,
      pagespeed: {
        strategy: 'mobile',
        scores: { performance: 50, seo: 50, accessibility: 50, bestPractices: 50 },
        lab: { lcpMs: 1000, fcpMs: 1000, cls: 0, tbtMs: 100, speedIndexMs: 1000, serverResponseMs: 100, totalBytes: 1000 },
        field: { available: false, origin: true, lcp: { p75: 100, category: 'FAST' }, cls: { p75: 0, category: 'FAST' }, inp: { p75: 0, category: 'FAST' } }
      },
      coverage: { complete: true, scanned: 1, maxReached: false },
      findings: [],
    };

    setState({
      phase: 'done',
      steps: [],
      result,
      error: null,
      domain: input,
    });

    return result;
  };

  return {
    ...state,
    start,
    reset: () => {},
  };
};

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('handles fetchPageSpeed failure for desktop correctly', async () => {
    const error = new Error('PageSpeed Failed');

    // We override fetchPageSpeed to reject, simulating a desktop fetch failure
    vi.mocked(sources.fetchPageSpeed).mockRejectedValue(error);

    // Mock useAudit to use our stateful mock
    vi.spyOn(useAudit, 'useAudit').mockImplementation(useMockAudit as any);

    render(<LandingPage />);

    // Get the input and submit button
    const input = screen.getByRole('textbox', { name: /Endereço do site a analisar/i });
    const button = screen.getByRole('button', { name: /executar/i });

    // Type a domain and submit
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(button);

    // Wait for the specific failure message to appear on the screen
    await waitFor(() => {
      expect(screen.getByText(/A medição em computador não pôde ser feita agora/i)).toBeTruthy();
    });
  });
});
