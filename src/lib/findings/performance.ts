import type { AuditResult, Finding } from '../types';
import { ms, kb } from './utils';

export const buildPerformanceFindings = (result: AuditResult, push: (finding: Finding) => void): void => {
  const { pagespeed } = result;


  if (pagespeed) {
    const { field, lab, scores } = pagespeed;

    if (field.available && field.lcp.p75 !== null) {
      const seconds = (field.lcp.p75 / 1000).toFixed(1);
      const severity = field.lcp.p75 > 4000 ? 'critical' : field.lcp.p75 > 2500 ? 'warning' : 'good';
      push({
        id: 'lcp-campo',
        area: 'desempenho',
        severity,
        title:
          severity === 'good'
            ? 'Tempo de carregamento aprovado pelo Google'
            : 'Visitantes reais esperam demais pelo conteúdo principal',
        evidence: `${seconds}s no percentil 75 de usuários reais do Chrome${field.origin ? ' (dados de todo o domínio)' : ''}. O limite do Google é 2,5s.`,
        action:
          severity === 'good'
            ? 'Nada a fazer neste ponto.'
            : 'Esta é a métrica que o Google usa como critério de classificação, medida em quem realmente acessa o site — não em simulação.',
      });
    } else if (!field.available) {
      push({
        id: 'sem-dados-campo',
        area: 'desempenho',
        severity: 'info',
        title: 'Sem histórico de usuários reais no Google',
        evidence: 'O relatório CrUX não tem amostra suficiente para este domínio.',
        action:
          'Acontece com sites de baixo tráfego. Indica também que o site recebe poucas visitas vindas da busca.',
      });
    }

    if (field.available && field.cls.p75 !== null && field.cls.p75 > 0.1) {
      push({
        id: 'cls-campo',
        area: 'desempenho',
        severity: field.cls.p75 > 0.25 ? 'critical' : 'warning',
        title: 'O layout se desloca durante o carregamento',
        evidence: `Índice de instabilidade visual de ${field.cls.p75.toFixed(2)} em usuários reais; o aceitável é até 0,10.`,
        action: 'É o efeito de a página "pular" e o visitante clicar sem querer no lugar errado.',
      });
    }

    if (field.available && field.inp.p75 !== null && field.inp.p75 > 200) {
      push({
        id: 'inp-campo',
        area: 'desempenho',
        severity: field.inp.p75 > 500 ? 'critical' : 'warning',
        title: 'O site demora a responder aos toques',
        evidence: `${Math.round(field.inp.p75)}ms entre o toque e a resposta visual; o limite do Google é 200ms.`,
        action: 'A sensação é de travamento, principalmente em celulares mais simples.',
      });
    }

    if (scores.performance !== null) {
      push({
        id: 'score-performance',
        area: 'desempenho',
        severity: scores.performance < 50 ? 'critical' : scores.performance < 90 ? 'warning' : 'good',
        title: `Nota ${scores.performance}/100 em desempenho (${pagespeed.strategy === 'mobile' ? 'celular' : 'computador'})`,
        evidence: `Medição do Lighthouse: maior elemento em ${ms(lab.lcpMs)}, resposta do servidor em ${ms(lab.serverResponseMs)}.`,
        action:
          scores.performance < 90
            ? 'Esta é a mesma nota que qualquer pessoa vê ao consultar o PageSpeed Insights do Google para o seu endereço.'
            : 'Nada a fazer neste ponto.',
      });
    }

    if (scores.seo !== null && scores.seo < 90) {
      push({
        id: 'score-seo',
        area: 'indexacao',
        severity: scores.seo < 70 ? 'warning' : 'info',
        title: `Nota ${scores.seo}/100 nas verificações de SEO do Google`,
        evidence: 'Avaliação automática do Lighthouse sobre a estrutura da página.',
        action: 'Cobre itens básicos de rastreamento que costumam ser rápidos de corrigir.',
      });
    }

    if (scores.accessibility !== null && scores.accessibility < 90) {
      push({
        id: 'score-acessibilidade',
        area: 'conteudo',
        severity: scores.accessibility < 70 ? 'warning' : 'info',
        title: `Nota ${scores.accessibility}/100 em acessibilidade`,
        evidence: 'Contraste de cores, rótulos de formulário e navegação por teclado avaliados pelo Lighthouse.',
        action:
          'Além da questão de inclusão, esses itens afetam a leitura do site por qualquer pessoa em tela pequena e sob sol forte.',
      });
    }

    if (lab.totalBytes !== null && lab.totalBytes > 2_000_000) {
      push({
        id: 'peso-total',
        area: 'desempenho',
        severity: 'warning',
        title: 'A página pesa mais que o razoável para dados móveis',
        evidence: `${kb(lab.totalBytes)} baixados em um único acesso.`,
        action: 'Em 4G instável isso significa vários segundos de tela em branco.',
      });
    }
  }

};
