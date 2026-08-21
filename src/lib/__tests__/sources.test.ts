import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { fetchPageSpeed } from '../sources';

describe('fetchPageSpeed error handling', () => {
  let fetchMock: Mock;

  beforeEach(() => {
    vi.resetAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should retry on network error and eventually fail', async () => {
    fetchMock.mockRejectedValue(new Error('Network Error'));

    const promise = fetchPageSpeed('example.com');

    const advanceTimers = async () => {
      for (let i = 0; i < 5; i++) {
        await vi.runAllTimersAsync();
      }
    };

    await Promise.all([
      expect(promise).rejects.toThrow('Não foi possível falar com o PageSpeed Insights do Google.'),
      advanceTimers(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should retry on AbortError and eventually fail with timeout message', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    const promise = fetchPageSpeed('example.com');

    const advanceTimers = async () => {
      for (let i = 0; i < 5; i++) {
        await vi.runAllTimersAsync();
      }
    };

    await Promise.all([
      expect(promise).rejects.toThrow('O Google demorou demais para responder a medição de velocidade.'),
      advanceTimers(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should retry on HTTP 429 Limit Error with specific message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { code: 429, message: 'Too Many Requests' } }),
    });

    const promise = fetchPageSpeed('example.com');

    const advanceTimers = async () => {
      for (let i = 0; i < 5; i++) {
        await vi.runAllTimersAsync();
      }
    };

    await Promise.all([
      expect(promise).rejects.toThrow('Serviço do Google momentaneamente sobrecarregado. Tente novamente em instantes.'),
      advanceTimers(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should not retry on HTTP 400 definitive error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 400, message: 'Bad Request' } }),
    });

    const promise = fetchPageSpeed('example.com');

    const advanceTimers = async () => {
      for (let i = 0; i < 5; i++) {
        await vi.runAllTimersAsync();
      }
    };

    await Promise.all([
      expect(promise).rejects.toThrow('A medição de velocidade do Google não pôde ser concluída no momento.'),
      advanceTimers(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1); // Fails immediately, no retries
  });
});
