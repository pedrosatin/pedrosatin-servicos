import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { buildSecurityFindings } from './security';
import type { AuditResult, Finding } from '../types';

describe('buildSecurityFindings', () => {
  let pushMock: Mock<(finding: Finding) => void>;

  beforeEach(() => {
    pushMock = vi.fn();
  });

  const baseResult = {
    domain: 'example.com',
    content: {
      finalUrl: 'http://example.com',
      servedOverHttps: true,
      httpRedirectsToHttps: true,
      securityHeaders: { hsts: 'max-age=31536000' },
      poweredBy: null,
      server: 'nginx',
      compressed: true,
      cacheControl: 'max-age=3600',
      redirects: []
    }
  } as unknown as AuditResult;

  it('does nothing when content is missing', () => {
    const result = {
      domain: 'example.com',
      content: null
    } as unknown as AuditResult;

    buildSecurityFindings(result, pushMock);

    expect(pushMock).not.toHaveBeenCalled();
  });

  it('pushes https-ausente when servedOverHttps is false', () => {
    const result = {
      domain: 'example.com',
      content: {
        ...baseResult.content,
        servedOverHttps: false,
        finalUrl: 'http://example.com'
      }
    } as unknown as AuditResult;

    buildSecurityFindings(result, pushMock);

    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'https-ausente',
      area: 'seguranca',
      severity: 'critical'
    }));
  });

  it('pushes http-sem-redirect when httpRedirectsToHttps is false', () => {
    const result = {
      domain: 'example.com',
      content: {
        ...baseResult.content,
        servedOverHttps: true,
        httpRedirectsToHttps: false
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
      domain: 'example.com',
      content: {
        ...baseResult.content,
        servedOverHttps: true,
        httpRedirectsToHttps: true
      }
    } as unknown as AuditResult;

    buildSecurityFindings(result, pushMock);

    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'https-ok',
      area: 'seguranca',
      severity: 'good'
    }));
  });

  it('pushes sem-hsts when servedOverHttps is true and hsts is missing', () => {
    const result = {
      domain: 'example.com',
      content: {
        ...baseResult.content,
        servedOverHttps: true,
        securityHeaders: { hsts: null }
      }
    } as unknown as AuditResult;

    buildSecurityFindings(result, pushMock);

    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sem-hsts',
      area: 'seguranca',
      severity: 'info'
    }));
  });

  it('pushes x-powered-by when poweredBy is present', () => {
    const result = {
      domain: 'example.com',
      content: {
        ...baseResult.content,
        poweredBy: 'Express'
      }
    } as unknown as AuditResult;

    buildSecurityFindings(result, pushMock);

    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'x-powered-by',
      area: 'seguranca',
      severity: 'info'
    }));
  });

  it('pushes sem-compressao when compressed is false and not a CDN', () => {
    const result = {
      domain: 'example.com',
      content: {
        ...baseResult.content,
        compressed: false,
        server: 'nginx'
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
      domain: 'example.com',
      content: {
        ...baseResult.content,
        compressed: true,
        server: 'nginx'
      }
    } as unknown as AuditResult;

    buildSecurityFindings(result, pushMock);

    expect(pushMock).not.toHaveBeenCalledWith(expect.objectContaining({
      id: 'sem-compressao'
    }));
  });

  it('does not push sem-compressao when compressed is false but server is a CDN', () => {
    const result = {
      domain: 'example.com',
      content: {
        ...baseResult.content,
        compressed: false,
        server: 'cloudflare'
      }
    } as unknown as AuditResult;

    buildSecurityFindings(result, pushMock);

    expect(pushMock).not.toHaveBeenCalledWith(expect.objectContaining({
      id: 'sem-compressao'
    }));
  });

  it('pushes sem-cache when cacheControl is falsy', () => {
    const result = {
      domain: 'example.com',
      content: {
        ...baseResult.content,
        cacheControl: null
      }
    } as unknown as AuditResult;

    buildSecurityFindings(result, pushMock);

    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sem-cache',
      area: 'desempenho',
      severity: 'info'
    }));
  });

  it('pushes redirects-encadeados when redirects length > 1', () => {
    const result = {
      domain: 'example.com',
      content: {
        ...baseResult.content,
        redirects: [
          { status: 301, location: 'http://www.example.com', url: 'http://example.com' },
          { status: 301, location: 'https://www.example.com', url: 'http://www.example.com' }
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
});
