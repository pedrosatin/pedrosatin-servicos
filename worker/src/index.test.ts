import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { checkHttpsUpgrade } from './index';

// We need to mock the global fetch function
describe('checkHttpsUpgrade', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return null when the fetch throws an error (e.g., timeout or network failure)', async () => {
    // Mock fetch to throw an error, simulating a network failure
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    const result = await checkHttpsUpgrade('example.com');

    // Assert that the function correctly catches the error and returns null
    expect(result).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://example.com/',
      expect.objectContaining({ redirect: 'manual' })
    );
  });

  it('should return true when redirecting to https', async () => {
    // Mock fetch to return a 301 redirect to https
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 301,
      headers: new Headers({ location: 'https://example.com/' })
    } as unknown as Response);

    const result = await checkHttpsUpgrade('example.com');

    expect(result).toBe(true);
  });

  it('should return false when redirecting to http', async () => {
    // Mock fetch to return a 301 redirect to http
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 301,
      headers: new Headers({ location: 'http://example.com/other' })
    } as unknown as Response);

    const result = await checkHttpsUpgrade('example.com');

    expect(result).toBe(false);
  });

  it('should return false when there is no redirect', async () => {
    // Mock fetch to return a 200 OK
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers()
    } as unknown as Response);

    const result = await checkHttpsUpgrade('example.com');

    expect(result).toBe(false);
  });
});
