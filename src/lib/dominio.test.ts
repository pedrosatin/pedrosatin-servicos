import { describe, it, expect } from 'vitest';
import { getApexDomain } from './dominio';

describe('getApexDomain', () => {
  it('returns the domain as-is for domains with 2 or fewer parts', () => {
    expect(getApexDomain('example.com')).toBe('example.com');
    expect(getApexDomain('localhost')).toBe('localhost');
  });

  it('extracts the apex domain for non-.br TLDs', () => {
    expect(getApexDomain('sub.example.com')).toBe('example.com');
    expect(getApexDomain('a.b.c.example.com')).toBe('example.com');
    expect(getApexDomain('www.example.org')).toBe('example.org');
  });

  it('extracts the apex domain correctly for .br TLDs with 3-char or shorter SLDs', () => {
    expect(getApexDomain('example.com.br')).toBe('example.com.br');
    expect(getApexDomain('sub.example.com.br')).toBe('example.com.br');
    expect(getApexDomain('a.b.c.example.com.br')).toBe('example.com.br');
    expect(getApexDomain('gov.br')).toBe('gov.br'); // 2 parts
  });

  it('falls back to 2 parts for .br TLDs with SLDs longer than 3 chars', () => {
    // Current logic treats SLDs > 3 chars as the apex domain itself
    // e.g. "blog.br" is 2 parts -> returns "blog.br"
    // "example.blog.br" -> SLD is "blog" (len 4) -> returns slice(-2) -> "blog.br"
    expect(getApexDomain('example.blog.br')).toBe('blog.br');
    expect(getApexDomain('sub.example.blog.br')).toBe('blog.br');
  });

  it('handles case-insensitivity correctly', () => {
    expect(getApexDomain('SUB.EXAMPLE.COM')).toBe('example.com');
    expect(getApexDomain('EXAMPLE.COM.BR')).toBe('example.com.br');
  });
});
