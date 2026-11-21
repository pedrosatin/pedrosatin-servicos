import { beforeEach, expect, test, vi } from 'vitest';
import { recoverPreload } from './recoverPreload';

beforeEach(() => sessionStorage.clear());

test('recarrega uma vez e cancela os próximos erros da sessão', () => {
  const reload = vi.fn();
  vi.stubGlobal('window', { location: { reload } });
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const event = new Event('vite:preloadError', { cancelable: true });
      recoverPreload(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(reload).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('preserva a página se sessionStorage estiver bloqueado', () => {
  vi.stubGlobal('sessionStorage', {
    getItem() { throw new Error('Armazenamento bloqueado'); },
  });
  const reload = vi.fn();
  vi.stubGlobal('window', { location: { reload } });
  try {
    recoverPreload(new Event('vite:preloadError'));
    expect(reload).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
