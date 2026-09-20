import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { buildSecurityFindings } from './security';
import type { AuditResult, Finding } from '../types';

describe('buildSecurityFindings', () => {
  let pushMock: Mock<(finding: Finding) => void>;

  beforeEach(() => {
    pushMock = vi.fn();
  });

  describe('HTTPS and Redirects', () => {
    it('pushes https-ausente when servedOverHttps is false', () => {
      const result = {
        content: {
          servedOverHttps: false,
          finalUrl: 'http://example.com',
          redirects: [],
          securityHeaders: { hsts: true }
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'https-ausente',
        area: 'seguranca',
        severity: 'critical'
      }));
    });

    it('pushes http-sem-redirect when servedOverHttps is true but httpRedirectsToHttps is false', () => {
      const result = {
        domain: 'example.com',
        content: {
          servedOverHttps: true,
          httpRedirectsToHttps: false,
          redirects: [],
          securityHeaders: { hsts: true }
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'http-sem-redirect',
        area: 'seguranca',
        severity: 'warning'
      }));
    });

    it('pushes https-ok when servedOverHttps is true and httpRedirectsToHttps is true', () => {
      const result = {
        content: {
          servedOverHttps: true,
          httpRedirectsToHttps: true,
          securityHeaders: { hsts: true },
          cacheControl: 'max-age=3600',
          redirects: [],
          compressed: true
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'https-ok',
        area: 'seguranca',
        severity: 'good'
      }));
    });
  });

  describe('Security Headers', () => {
    it('pushes sem-hsts when servedOverHttps is true and hsts is false', () => {
      const result = {
        content: {
          servedOverHttps: true,
          securityHeaders: { hsts: false },
          cacheControl: 'max-age=3600',
          redirects: [],
          compressed: true
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'sem-hsts',
        area: 'seguranca',
        severity: 'info'
      }));
    });

    it('does not push sem-hsts when servedOverHttps is false', () => {
      const result = {
        content: {
          servedOverHttps: false,
          securityHeaders: { hsts: false },
          finalUrl: 'http://example.com',
          cacheControl: 'max-age=3600',
          redirects: [],
          compressed: true
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).not.toHaveBeenCalledWith(expect.objectContaining({
        id: 'sem-hsts'
      }));
    });
  });

  describe('Powered By', () => {
    it('pushes x-powered-by when poweredBy is present', () => {
      const result = {
        content: {
          servedOverHttps: true,
          securityHeaders: { hsts: true },
          poweredBy: 'Express',
          cacheControl: 'max-age=3600',
          redirects: [],
          compressed: true
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'x-powered-by',
        area: 'seguranca',
        severity: 'info'
      }));
    });
  });

  describe('Compression', () => {
    it('pushes sem-compressao when neither compressed nor CDN is used', () => {
      const result = {
        content: {
          servedOverHttps: true,
          securityHeaders: { hsts: true },
          compressed: false,
          server: 'Apache',
          cacheControl: 'max-age=3600',
          redirects: []
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'sem-compressao',
        area: 'desempenho',
        severity: 'warning'
      }));
    });

    it('does not push sem-compressao when compressed is true', () => {
      const result = {
        content: {
          servedOverHttps: true,
          securityHeaders: { hsts: true },
          compressed: true,
          server: 'Apache',
          cacheControl: 'max-age=3600',
          redirects: []
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).not.toHaveBeenCalledWith(expect.objectContaining({
        id: 'sem-compressao'
      }));
    });

    it('does not push sem-compressao when server is a known CDN', () => {
      const result = {
        content: {
          servedOverHttps: true,
          securityHeaders: { hsts: true },
          compressed: false,
          server: 'cloudflare',
          cacheControl: 'max-age=3600',
          redirects: []
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).not.toHaveBeenCalledWith(expect.objectContaining({
        id: 'sem-compressao'
      }));
    });
  });

  describe('Cache Control', () => {
    it('pushes sem-cache when cacheControl is falsy', () => {
      const result = {
        content: {
          servedOverHttps: true,
          securityHeaders: { hsts: true },
          compressed: true,
          cacheControl: null,
          redirects: []
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'sem-cache',
        area: 'desempenho',
        severity: 'info'
      }));
    });
  });

  describe('Redirects', () => {
    it('pushes redirects-encadeados when redirects length > 1', () => {
      const result = {
        content: {
          servedOverHttps: true,
          securityHeaders: { hsts: true },
          compressed: true,
          cacheControl: 'max-age=3600',
          redirects: [
            { status: 301, location: 'http://www.example.com' },
            { status: 301, location: 'https://www.example.com' }
          ]
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'redirects-encadeados',
        area: 'desempenho',
        severity: 'warning'
      }));
    });

    it('does not push redirects-encadeados when redirects length is 1 or less', () => {
      const result = {
        content: {
          servedOverHttps: true,
          securityHeaders: { hsts: true },
          compressed: true,
          cacheControl: 'max-age=3600',
          redirects: [
            { status: 301, location: 'https://example.com' }
          ]
        }
      } as unknown as AuditResult;

      buildSecurityFindings(result, pushMock);

      expect(pushMock).not.toHaveBeenCalledWith(expect.objectContaining({
        id: 'redirects-encadeados'
      }));
    });
  });
});
