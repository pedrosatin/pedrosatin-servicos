import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPageSpeed } from './sources';

describe('buscarPageSpeed', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call clearTimeout in the finally block when fetch rejects', async () => {
    const spy = vi.spyOn(globalThis, 'clearTimeout');

    // Simulate a network failure or a timeout from fetch
    mockFetch.mockRejectedValue(new Error('Network error'));

    // initiate the call which internally uses buscarPageSpeed and its try/catch
    const promise = fetchPageSpeed('example.com').catch(() => {});

    // Flush microtasks so the fetch rejection is handled and the finally block executes
    await Promise.resolve();
    await Promise.resolve();

    // Check that clearTimeout was called to clean up the abort timer
    expect(spy).toHaveBeenCalled();

    // Allow the retry delays to resolve
    await vi.runAllTimersAsync();
    await promise;
  });

  it('should call clearTimeout in the finally block when fetch succeeds', async () => {
    const spy = vi.spyOn(globalThis, 'clearTimeout');

    // Simulate a successful response
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      lighthouseResult: {
        categories: {},
        audits: {}
      }
    })));

    const promise = fetchPageSpeed('example.com').catch(() => {});

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(spy).toHaveBeenCalled();

    await vi.runAllTimersAsync();
    await promise;
  });
});
