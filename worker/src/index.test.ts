import { describe, it, expect } from 'vitest';
import { normalizeTarget } from './index';

describe('normalizeTarget', () => {
  it('returns valid URLs unchanged if they have a supported protocol', () => {
    expect(normalizeTarget('https://example.com')?.href).toBe('https://example.com/');
    expect(normalizeTarget('http://example.com')?.href).toBe('http://example.com/');
    expect(normalizeTarget('https://example.com/path')?.href).toBe('https://example.com/path');
  });

  it('adds https:// if no protocol is provided', () => {
    expect(normalizeTarget('example.com')?.href).toBe('https://example.com/');
    expect(normalizeTarget('www.example.com/path')?.href).toBe('https://www.example.com/path');
  });

  it('returns null for empty strings or only whitespace', () => {
    expect(normalizeTarget('')).toBeNull();
    expect(normalizeTarget('   ')).toBeNull();
  });

  it('returns null for unsupported protocols', () => {
    expect(normalizeTarget('ftp://example.com')).toBeNull();
    expect(normalizeTarget('file:///etc/passwd')).toBeNull();
  });

  it('returns null if the hostname has no dot', () => {
    expect(normalizeTarget('localhost')).toBeNull();
    expect(normalizeTarget('https://intranet')).toBeNull();
  });

  it('returns null for internal hosts', () => {
    expect(normalizeTarget('https://127.0.0.1')).toBeNull();
    expect(normalizeTarget('https://192.168.1.1')).toBeNull();
    expect(normalizeTarget('https://10.0.0.1')).toBeNull();
    expect(normalizeTarget('https://[::1]')).toBeNull();
  });

  it('handles invalid URLs that throw during new URL() (error path test)', () => {
    // These should cause new URL() to throw and fall into the catch block
    expect(normalizeTarget('https://')).toBeNull();
    expect(normalizeTarget('http://')).toBeNull();
    expect(normalizeTarget('https://:80')).toBeNull();
    // Use an unparseable string with https://
    expect(normalizeTarget('https://%%%')).toBeNull();
  });
});
