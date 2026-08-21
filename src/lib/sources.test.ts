import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRegistration } from './sources';

describe('fetchRegistration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset vi mocks
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  it('should return a default object with found: false when fetch throws an error', async () => {
    // Arrange: Mock fetch to throw a network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    // Act: Call fetchRegistration
    const result = await fetchRegistration('example.com');

    // Assert: Verify the fallback object is returned correctly
    expect(result).toEqual({
      found: false,
      domain: 'example.com',
      registrar: null,
      registeredAt: null,
      expiresAt: null,
      changedAt: null,
      daysToExpire: null,
      status: [],
      nameservers: [],
      dnssec: false,
      source: 'rdap.org',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://rdap.org/domain/example.com',
      { headers: { accept: 'application/rdap+json' } }
    );
  });

  it('should return a default object with found: false for .br domains when fetch throws an error', async () => {
    // Arrange: Mock fetch to throw a network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    // Act: Call fetchRegistration
    const result = await fetchRegistration('example.com.br');

    // Assert: Verify the fallback object is returned correctly
    expect(result).toEqual({
      found: false,
      domain: 'example.com.br',
      registrar: null,
      registeredAt: null,
      expiresAt: null,
      changedAt: null,
      daysToExpire: null,
      status: [],
      nameservers: [],
      dnssec: false,
      source: 'registro.br',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://rdap.registro.br/domain/example.com.br',
      { headers: { accept: 'application/rdap+json' } }
    );
  });
});
