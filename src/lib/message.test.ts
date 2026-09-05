import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditWhatsAppUrl, findingWhatsAppUrl, briefingWhatsAppUrl } from './message';
import { buildWhatsAppUrl } from './config';
import { normalizeDomain } from './dominio';
import type { AuditResult, Finding } from './types';

vi.mock('./config', () => ({
  buildWhatsAppUrl: vi.fn((msg: string) => `mock_url:${msg}`),
}));

vi.mock('./dominio', () => ({
  normalizeDomain: vi.fn((domain: string) => domain.toLowerCase()),
}));

describe('message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('auditWhatsAppUrl', () => {
    it('should build URL for null result without domain', () => {
      const url = auditWhatsAppUrl(null);
      expect(buildWhatsAppUrl).toHaveBeenCalledWith(
        'Olá Pedro, vim pela sua página de serviços e gostaria de conversar sobre meu projeto.'
      );
      expect(url).toBe('mock_url:Olá Pedro, vim pela sua página de serviços e gostaria de conversar sobre meu projeto.');
    });

    it('should build URL for null result with domain', () => {
      auditWhatsAppUrl(null, 'exemplo.com');
      expect(buildWhatsAppUrl).toHaveBeenCalledWith(
        'Olá Pedro, vim pela sua página de serviços e gostaria de conversar sobre meu projeto sobre o projeto exemplo.com.'
      );
    });

    it('should build URL for result with score and findings', () => {
      const mockFindings = [
        { title: 'Critical issue', severity: 'critical' },
        { title: 'Warning issue', severity: 'warning' },
        { title: 'Good point', severity: 'good' },
        { title: 'Info point', severity: 'info' },
        { title: 'Another critical', severity: 'critical' },
        { title: 'Another warning', severity: 'warning' },
      ] as Finding[];

      const mockResult = {
        domain: 'meusite.com',
        score: { value: 85, label: 'Bom' },
        findings: mockFindings,
      } as unknown as AuditResult;

      auditWhatsAppUrl(mockResult);

      expect(buildWhatsAppUrl).toHaveBeenCalledWith(
        'Olá Pedro, analisei o projeto meusite.com na sua página.\n' +
        'Resultado da análise: 85/100 (Bom).\n' +
        'Principais pontos encontrados:\n' +
        '1. Critical issue\n' +
        '2. Warning issue\n' +
        '3. Another critical\n' +
        'Gostaria de entender como podemos resolver e colocar em produção.'
      );
    });

    it('should build URL for result without score and findings', () => {
      const mockResult = {
        domain: 'semscore.com',
        score: null,
        findings: [],
      } as unknown as AuditResult;

      auditWhatsAppUrl(mockResult);

      expect(buildWhatsAppUrl).toHaveBeenCalledWith(
        'Olá Pedro, analisei o projeto semscore.com na sua página.\n' +
        'Gostaria de entender como podemos resolver e colocar em produção.'
      );
    });
  });

  describe('findingWhatsAppUrl', () => {
    it('should build URL for a specific finding', () => {
      const mockFinding = { title: 'Imagens sem alt' } as Finding;
      findingWhatsAppUrl('site.com', mockFinding);

      expect(buildWhatsAppUrl).toHaveBeenCalledWith(
        'Olá Pedro, na análise de site.com apareceu este ponto: "Imagens sem alt". Como funciona a correção?'
      );
    });
  });

  describe('briefingWhatsAppUrl', () => {
    it('should build URL for minimal briefing', () => {
      const briefing = {
        name: '',
        activity: '',
        need: '',
        currentSite: '',
        notes: '',
      };

      briefingWhatsAppUrl(briefing, null);

      expect(buildWhatsAppUrl).toHaveBeenCalledWith(
        'Olá Pedro, vim pela sua página de engenharia para projetos com IA.\n\n' +
        'Podemos conversar sobre o levantamento técnico e o orçamento?'
      );
    });

    it('should build URL for full briefing without audit result', () => {
      const briefing = {
        name: 'João',
        activity: ' E-commerce ',
        need: ' Refazer o site ',
        currentSite: ' https://joao.com ',
        notes: ' Uso WordPress ',
      };

      briefingWhatsAppUrl(briefing, null);

      expect(buildWhatsAppUrl).toHaveBeenCalledWith(
        'Olá Pedro, vim pela sua página de engenharia para projetos com IA.\n' +
        'Meu nome é João.\n' +
        'Projeto / Atividade: E-commerce.\n' +
        'Necessidade: Refazer o site.\n' +
        'Link / Site atual: https://joao.com\n' +
        'Detalhes (ferramenta, erros, integrações): Uso WordPress\n\n' +
        'Podemos conversar sobre o levantamento técnico e o orçamento?'
      );
    });

    it('should include audit result when domains match', () => {
      const briefing = {
        name: 'Maria',
        activity: 'Blog',
        need: 'SEO',
        currentSite: 'maria.com',
        notes: '',
      };

      const mockResult = {
        domain: 'maria.com',
        score: { value: 90, label: 'Ótimo' },
        findings: [
          { title: 'Problema crítico', severity: 'critical' },
        ] as Finding[],
      } as unknown as AuditResult;

      vi.mocked(normalizeDomain).mockReturnValue('maria.com');

      briefingWhatsAppUrl(briefing, mockResult);

      expect(buildWhatsAppUrl).toHaveBeenCalledWith(
        'Olá Pedro, vim pela sua página de engenharia para projetos com IA.\n' +
        'Meu nome é Maria.\n' +
        'Projeto / Atividade: Blog.\n' +
        'Necessidade: SEO.\n' +
        'Link / Site atual: maria.com\n' +
        'Resultado do diagnóstico: 90/100.\n' +
        'Pontos encontrados na análise:\n' +
        '1. Problema crítico\n\n' +
        'Podemos conversar sobre o levantamento técnico e o orçamento?'
      );
    });

    it('should ignore audit result when domains do not match', () => {
      const briefing = {
        name: 'Carlos',
        activity: '',
        need: '',
        currentSite: 'carlos.com',
        notes: '',
      };

      const mockResult = {
        domain: 'outro.com',
        score: { value: 50, label: 'Ruim' },
        findings: [] as Finding[],
      } as unknown as AuditResult;

      vi.mocked(normalizeDomain).mockReturnValue('carlos.com');

      briefingWhatsAppUrl(briefing, mockResult);

      expect(buildWhatsAppUrl).toHaveBeenCalledWith(
        'Olá Pedro, vim pela sua página de engenharia para projetos com IA.\n' +
        'Meu nome é Carlos.\n' +
        'Link / Site atual: carlos.com\n\n' +
        'Podemos conversar sobre o levantamento técnico e o orçamento?'
      );
    });
  });
});
