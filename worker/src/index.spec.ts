import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from './index';

describe('fetchWithTimeout', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('clears timeout and returns response on success', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    // We can spy on clearTimeout
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const res = await fetchWithTimeout('https://example.com');

    expect(res).toBe(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('propagates fetch errors and clears timeout', async () => {
    const error = new Error('Network failure');
    global.fetch = vi.fn().mockRejectedValue(error);

    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    await expect(fetchWithTimeout('https://example.com')).rejects.toThrow('Network failure');

    // Despite throwing, it should clear the timer
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });
});
