import type { AuditResult, Finding } from '../types';
import { formatDate } from './utils';

export const buildDomainFindings = (result: AuditResult, push: (finding: Finding) => void): void => {
  const { registration, email, dns } = result;


  if (registration?.found) {
    const days = registration.daysToExpire;
    if (days !== null && days < 0) {
      push({
        id: 'dominio-vencido',
        area: 'dominio',
        severity: 'critical',
        title: 'O registro do domínio está vencido',
        evidence: `Vencimento em ${formatDate(registration.expiresAt)}, há ${Math.abs(days)} dias.`,
        action: 'Domínio vencido pode ser liberado para terceiros. É o item mais urgente da lista.',
      });
    } else if (days !== null && days < 45) {
      push({
        id: 'dominio-vencendo',
        area: 'dominio',
        severity: 'critical',
        title: `O domínio vence em ${days} dias`,
        evidence: `Registro válido até ${formatDate(registration.expiresAt)}, segundo ${registration.source === 'registro.br' ? 'o Registro.br' : 'a consulta RDAP oficial'}.`,
        action: 'Site e e-mails param no dia do vencimento. A renovação é feita direto no registrador.',
      });
    } else if (days !== null && days < 120) {
      push({
        id: 'dominio-renovacao-proxima',
        area: 'dominio',
        severity: 'warning',
        title: `Renovação do domínio em ${days} dias`,
        evidence: `Registro válido até ${formatDate(registration.expiresAt)}.`,
        action: 'Vale conferir se o cartão cadastrado no registrador continua válido.',
      });
    } else if (days !== null) {
      push({
        id: 'dominio-ok',
        area: 'dominio',
        severity: 'good',
        title: 'Registro do domínio em dia',
        evidence: `Válido até ${formatDate(registration.expiresAt)} (${days} dias), registrado em ${formatDate(registration.registeredAt)}.`,
        action: 'Nada a fazer neste ponto.',
      });
    }

    if (!registration.dnssec && registration.source === 'registro.br') {
      push({
        id: 'sem-dnssec',
        area: 'seguranca',
        severity: 'info',
        title: 'DNSSEC não está ativo',
        evidence: 'O domínio não tem assinatura DNSSEC delegada.',
        action:
          'O Registro.br oferece DNSSEC sem custo adicional. Ele impede que respostas de DNS sejam falsificadas no caminho.',
      });
    }
  }

  if (email) {
    if (!email.hasMx) {
      push({
        id: 'sem-email-proprio',
        area: 'dominio',
        severity: 'info',
        title: 'O domínio não recebe e-mails',
        evidence: 'Nenhum registro MX configurado.',
        action:
          'Significa que o contato ainda usa endereço de Gmail ou Hotmail em vez de um e-mail no próprio domínio.',
      });
    } else {
      if (!email.spf) {
        push({
          id: 'sem-spf',
          area: 'seguranca',
          severity: 'warning',
          title: 'Qualquer pessoa pode enviar e-mail se passando pelo seu domínio',
          evidence: `O domínio recebe e-mails${email.mxProvider ? ` via ${email.mxProvider}` : ''}, mas não publica registro SPF.`,
          action:
            'Sem SPF nada impede um golpista de mandar mensagem como se fosse do seu endereço, e seus próprios e-mails tendem a cair no spam.',
        });
      }
      if (!email.dmarc) {
        push({
          id: 'sem-dmarc',
          area: 'seguranca',
          severity: 'warning',
          title: 'Sem política DMARC publicada',
          evidence: 'Nenhum registro TXT em _dmarc.' + result.domain + '.',
          action:
            'O DMARC diz aos provedores o que fazer com mensagens falsificadas. Gmail e Outlook passaram a exigi-lo de quem envia em volume.',
        });
      } else if (email.dmarcPolicy === 'none') {
        push({
          id: 'dmarc-permissivo',
          area: 'seguranca',
          severity: 'info',
          title: 'DMARC configurado apenas em modo de observação',
          evidence: `Política declarada: p=none.`,
          action: 'Nesse modo os relatórios chegam, mas mensagens falsificadas continuam sendo entregues.',
        });
      }
    }
  }

  if (dns && !dns.resolves) {
    push({
      id: 'dns-nao-resolve',
      area: 'dominio',
      severity: 'critical',
      title: 'O domínio não aponta para nenhum servidor',
      evidence: 'Nenhum registro A ou AAAA encontrado.',
      action:
        'O endereço existe mas não leva a lugar algum. Costuma ser domínio registrado sem hospedagem configurada.',
    });
  }

};
