import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDomainFindings } from './domain';
import type { AuditResult } from '../types';

describe('buildDomainFindings', () => {
  let pushMock: any;

  beforeEach(() => {
    pushMock = vi.fn();
  });

  describe('registration', () => {
    it('pushes dominio-vencido when daysToExpire < 0', () => {
      const result = {
        registration: {
          found: true,
          daysToExpire: -5,
          expiresAt: '2023-01-01T00:00:00.000Z',
          source: 'registro.br'
        }
      } as unknown as AuditResult;

      buildDomainFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'dominio-vencido',
        area: 'dominio',
        severity: 'critical'
      }));
    });

    it('pushes dominio-vencendo when 0 <= daysToExpire < 45', () => {
      const resultRegistroBr = {
        registration: {
          found: true,
          daysToExpire: 30,
          expiresAt: '2023-01-30T00:00:00.000Z',
          source: 'registro.br'
        }
      } as unknown as AuditResult;

      buildDomainFindings(resultRegistroBr, pushMock);
      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'dominio-vencendo',
        area: 'dominio',
        severity: 'critical',
        evidence: expect.stringContaining('segundo o Registro.br')
      }));

      pushMock.mockClear();

      const resultRdap = {
        registration: {
          found: true,
          daysToExpire: 30,
          expiresAt: '2023-01-30T00:00:00.000Z',
          source: 'rdap.org'
        }
      } as unknown as AuditResult;

      buildDomainFindings(resultRdap, pushMock);
      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'dominio-vencendo',
        area: 'dominio',
        severity: 'critical',
        evidence: expect.stringContaining('segundo a consulta RDAP oficial')
      }));
    });

    it('pushes dominio-renovacao-proxima when 45 <= daysToExpire < 120', () => {
      const result = {
        registration: {
          found: true,
          daysToExpire: 60,
          expiresAt: '2023-03-01T00:00:00.000Z',
          source: 'registro.br'
        }
      } as unknown as AuditResult;

      buildDomainFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'dominio-renovacao-proxima',
        area: 'dominio',
        severity: 'warning'
      }));
    });

    it('pushes dominio-ok when daysToExpire >= 120', () => {
      const result = {
        registration: {
          found: true,
          daysToExpire: 150,
          expiresAt: '2023-06-01T00:00:00.000Z',
          registeredAt: '2022-06-01T00:00:00.000Z',
          source: 'registro.br'
        }
      } as unknown as AuditResult;

      buildDomainFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'dominio-ok',
        area: 'dominio',
        severity: 'good'
      }));
    });

    it('pushes sem-dnssec when no dnssec and source is registro.br', () => {
      const result = {
        registration: {
          found: true,
          daysToExpire: 150,
          dnssec: false,
          source: 'registro.br'
        }
      } as unknown as AuditResult;

      buildDomainFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'sem-dnssec',
        area: 'seguranca',
        severity: 'info'
      }));
    });

    it('does not push sem-dnssec when source is not registro.br', () => {
      const result = {
        registration: {
          found: true,
          daysToExpire: 150,
          dnssec: false,
          source: 'rdap.org'
        }
      } as unknown as AuditResult;

      buildDomainFindings(result, pushMock);

      expect(pushMock).not.toHaveBeenCalledWith(expect.objectContaining({
        id: 'sem-dnssec'
      }));
    });
  });

  describe('email', () => {
    it('pushes sem-email-proprio when hasMx is false', () => {
      const result = {
        email: {
          hasMx: false
        }
      } as unknown as AuditResult;

      buildDomainFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'sem-email-proprio',
        area: 'dominio',
        severity: 'info'
      }));
    });

    it('pushes sem-spf when hasMx is true but spf is null', () => {
      const result = {
        email: {
          hasMx: true,
          spf: null,
          mxProvider: 'Google Workspace'
        }
      } as unknown as AuditResult;

      buildDomainFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'sem-spf',
        area: 'seguranca',
        severity: 'warning'
      }));
    });

    it('pushes sem-dmarc when hasMx is true and spf exists but dmarc is null', () => {
      const result = {
        domain: 'example.com',
        email: {
          hasMx: true,
          spf: 'v=spf1 include:_spf.google.com ~all',
          dmarc: null
        }
      } as unknown as AuditResult;

      buildDomainFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'sem-dmarc',
        area: 'seguranca',
        severity: 'warning',
        evidence: expect.stringContaining('_dmarc.example.com.')
      }));
    });

    it('pushes dmarc-permissivo when dmarcPolicy is none', () => {
      const result = {
        email: {
          hasMx: true,
          spf: 'v=spf1 include:_spf.google.com ~all',
          dmarc: 'v=DMARC1; p=none; rua=mailto:admin@example.com',
          dmarcPolicy: 'none'
        }
      } as unknown as AuditResult;

      buildDomainFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'dmarc-permissivo',
        area: 'seguranca',
        severity: 'info'
      }));
    });
  });

  describe('dns', () => {
    it('pushes dns-nao-resolve when dns resolves is false', () => {
      const result = {
        dns: {
          resolves: false
        }
      } as unknown as AuditResult;

      buildDomainFindings(result, pushMock);

      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'dns-nao-resolve',
        area: 'dominio',
        severity: 'critical'
      }));
    });

    it('does not push dns-nao-resolve when dns resolves is true', () => {
      const result = {
        dns: {
          resolves: true
        }
      } as unknown as AuditResult;

      buildDomainFindings(result, pushMock);

      expect(pushMock).not.toHaveBeenCalledWith(expect.objectContaining({
        id: 'dns-nao-resolve'
      }));
    });
  });
});
