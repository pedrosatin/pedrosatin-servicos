import { describe, it, expect } from 'vitest';
import {
  normalizeDomain,
  isValidDomain,
  getApexDomain,
  googleIndexUrl,
  searchConsoleUrl,
} from './dominio';

describe('dominio', () => {
  describe('normalizeDomain', () => {
    it('removes protocol', () => {
      expect(normalizeDomain('http://example.com')).toBe('example.com');
      expect(normalizeDomain('https://example.com')).toBe('example.com');
    });

    it('removes www', () => {
      expect(normalizeDomain('www.example.com')).toBe('example.com');
      expect(normalizeDomain('https://www.example.com')).toBe('example.com');
    });

    it('removes trailing paths', () => {
      expect(normalizeDomain('example.com/path/to/page')).toBe('example.com');
      expect(normalizeDomain('https://example.com/path')).toBe('example.com');
    });

    it('removes trailing ports', () => {
      expect(normalizeDomain('example.com:8080')).toBe('example.com');
      expect(normalizeDomain('https://example.com:3000')).toBe('example.com');
    });

    it('trims whitespace and lowercase', () => {
      expect(normalizeDomain('  Example.COM  ')).toBe('example.com');
    });
  });

  describe('isValidDomain', () => {
    it('returns true for valid domains', () => {
      expect(isValidDomain('example.com')).toBe(true);
      expect(isValidDomain('sub.example.com')).toBe(true);
      expect(isValidDomain('my-domain.com.br')).toBe(true);
    });

    it('returns false for invalid domains', () => {
      expect(isValidDomain('example')).toBe(false);
      expect(isValidDomain('.com')).toBe(false);
      expect(isValidDomain('example.')).toBe(false);
      expect(isValidDomain('ex_ample.com')).toBe(false);
      expect(isValidDomain('http://example.com')).toBe(false); // Should be normalized first
    });
  });

  describe('getApexDomain', () => {
    it('returns apex domain for simple subdomains', () => {
      expect(getApexDomain('sub.example.com')).toBe('example.com');
      expect(getApexDomain('a.b.c.example.com')).toBe('example.com');
    });

    it('handles Brazilian domains correctly', () => {
      expect(getApexDomain('servicos.pedrosatin.com.br')).toBe('pedrosatin.com.br');
      expect(getApexDomain('sub.domain.com.br')).toBe('domain.com.br');
      expect(getApexDomain('gov.br')).toBe('gov.br'); // Edge case, though usually people input specific sites
    });

    it('returns the domain itself if already apex', () => {
      expect(getApexDomain('example.com')).toBe('example.com');
      expect(getApexDomain('example.com.br')).toBe('example.com.br');
    });
  });

  describe('googleIndexUrl', () => {
    it('constructs correct URL with encoded domain', () => {
      expect(googleIndexUrl('example.com')).toBe('https://www.google.com/search?q=site%3Aexample.com');
      expect(googleIndexUrl('sub.domain.com')).toBe('https://www.google.com/search?q=site%3Asub.domain.com');
    });
  });

  describe('searchConsoleUrl', () => {
    it('constructs correct URL with encoded domain', () => {
      expect(searchConsoleUrl('example.com')).toBe('https://search.google.com/search-console?resource_id=sc-domain%3Aexample.com');
      expect(searchConsoleUrl('sub.domain.com')).toBe('https://search.google.com/search-console?resource_id=sc-domain%3Asub.domain.com');
    });
  });
});
