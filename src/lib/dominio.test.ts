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
    it('should remove http://', () => {
      expect(normalizeDomain('http://example.com')).toBe('example.com');
    });

    it('should remove https://', () => {
      expect(normalizeDomain('https://example.com')).toBe('example.com');
    });

    it('should remove www.', () => {
      expect(normalizeDomain('www.example.com')).toBe('example.com');
    });

    it('should remove https://www.', () => {
      expect(normalizeDomain('https://www.example.com')).toBe('example.com');
    });

    it('should remove trailing path', () => {
      expect(normalizeDomain('example.com/path/to/page')).toBe('example.com');
    });

    it('should remove port', () => {
      expect(normalizeDomain('example.com:8080')).toBe('example.com');
    });

    it('should trim whitespace', () => {
      expect(normalizeDomain('  example.com  ')).toBe('example.com');
    });

    it('should convert to lowercase', () => {
      expect(normalizeDomain('Example.COM')).toBe('example.com');
    });

    it('should handle combination of all cases', () => {
      expect(normalizeDomain('  HTTPS://WWW.Example.COM:3000/some/path  ')).toBe('example.com');
    });
  });

  describe('isValidDomain', () => {
    it('should return true for valid domains', () => {
      expect(isValidDomain('example.com')).toBe(true);
      expect(isValidDomain('sub.example.com')).toBe(true);
      expect(isValidDomain('example.com.br')).toBe(true);
      expect(isValidDomain('my-domain.org')).toBe(true);
    });

    it('should return false for invalid domains', () => {
      expect(isValidDomain('example')).toBe(false); // missing .
      expect(isValidDomain('.com')).toBe(false);
      expect(isValidDomain('example.')).toBe(false);
      expect(isValidDomain('ex ample.com')).toBe(false); // space
      expect(isValidDomain('example..com')).toBe(false);
    });
  });

  describe('getApexDomain', () => {
    it('should return the domain itself if it is already an apex domain', () => {
      expect(getApexDomain('example.com')).toBe('example.com');
    });

    it('should extract apex domain from subdomain', () => {
      expect(getApexDomain('sub.example.com')).toBe('example.com');
      expect(getApexDomain('a.b.example.com')).toBe('example.com');
    });

    it('should handle .br domains correctly', () => {
      expect(getApexDomain('example.com.br')).toBe('example.com.br');
      expect(getApexDomain('sub.example.com.br')).toBe('example.com.br');
      expect(getApexDomain('a.b.example.com.br')).toBe('example.com.br');
    });

    it('should treat long sld in .br as regular domains', () => {
      // The rule is that the SLD length must be 3 or less for .br domains
      expect(getApexDomain('sub.longname.br')).toBe('longname.br');
    });
  });

  describe('googleIndexUrl', () => {
    it('should construct correct Google search URL for site operator', () => {
      expect(googleIndexUrl('example.com')).toBe('https://www.google.com/search?q=site%3Aexample.com');
    });
  });

  describe('searchConsoleUrl', () => {
    it('should construct correct Search Console URL for standard domains', () => {
      expect(searchConsoleUrl('example.com')).toBe(
        'https://search.google.com/search-console?resource_id=sc-domain%3Aexample.com'
      );
    });

    it('should construct correct Search Console URL for subdomains', () => {
      expect(searchConsoleUrl('sub.example.com')).toBe(
        'https://search.google.com/search-console?resource_id=sc-domain%3Asub.example.com'
      );
    });
  });
});
