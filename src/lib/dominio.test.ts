import { describe, it, expect } from 'vitest';
import { normalizeDomain } from './dominio';

describe('dominio', () => {
  describe('normalizeDomain', () => {
    it('should return plain domain unmodified', () => {
      expect(normalizeDomain('example.com')).toBe('example.com');
    });

    it('should remove http protocol', () => {
      expect(normalizeDomain('http://example.com')).toBe('example.com');
    });

    it('should remove https protocol', () => {
      expect(normalizeDomain('https://example.com')).toBe('example.com');
    });

    it('should remove www.', () => {
      expect(normalizeDomain('www.example.com')).toBe('example.com');
    });

    it('should remove both protocol and www.', () => {
      expect(normalizeDomain('https://www.example.com')).toBe('example.com');
    });

    it('should remove trailing slash', () => {
      expect(normalizeDomain('example.com/')).toBe('example.com');
    });

    it('should remove paths', () => {
      expect(normalizeDomain('example.com/path/to/page')).toBe('example.com');
    });

    it('should remove ports', () => {
      expect(normalizeDomain('example.com:8080')).toBe('example.com');
    });

    it('should handle ports and paths together', () => {
      // The current implementation removes the path first via `/\/.*$/`
      // So `example.com:8080/path` would become `example.com:8080` then `example.com`
      expect(normalizeDomain('example.com:8080/path')).toBe('example.com');
    });

    it('should trim whitespaces', () => {
      expect(normalizeDomain('  example.com  ')).toBe('example.com');
    });

    it('should convert to lowercase', () => {
      expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
    });

    it('should handle complex combinations', () => {
      expect(normalizeDomain('  HTTPS://WWW.EXAMPLE.COM:443/PATH/TO/PAGE  ')).toBe('example.com');
    });

    it('should handle single subdomain', () => {
      expect(normalizeDomain('sub.example.com')).toBe('sub.example.com');
    });

    it('should handle multiple subdomains', () => {
      expect(normalizeDomain('a.b.c.example.com')).toBe('a.b.c.example.com');
    });
  });
});
