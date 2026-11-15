import { lazy } from 'react';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { LazySection } from './LazySection';

test('a rejeição do chunk preserva o conteúdo ao redor da seção', async () => {
  const failedImport = lazy(() => Promise.reject(new Error('Chunk indisponível')));
  const Failed = failedImport;
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(<><h1>Página preservada</h1><LazySection><Failed /></LazySection></>);
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(screen.getByRole('heading', { name: 'Página preservada' })).toBeVisible();
  } finally {
    consoleError.mockRestore();
  }
});
