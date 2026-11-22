import type { AuditResult, DnsReport, DomainRegistration, EmailAuthReport, Finding } from '../types';
import { formatDate } from '../format';

const checkRegistrationExpiry = (registration: DomainRegistration): Finding | undefined => {
  const days = registration.daysToExpire;
  if (days !== null && days < 0) {
    return {
      id: 'dominio-vencido',
      area: 'dominio',
      severity: 'critical',
      title: 'O registro do domínio está vencido',
      evidence: `Vencimento em ${formatDate(registration.expiresAt)}, há ${Math.abs(days)} dias.`,
      action: 'Domínio vencido pode ser liberado para terceiros. É o item mais urgente da lista.',
    };
  }
  if (days !== null && days < 45) {
    return {
      id: 'dominio-vencendo',
      area: 'dominio',
      severity: 'critical',
      title: `O domínio vence em ${days} dias`,
      evidence: `Registro válido até ${formatDate(registration.expiresAt)}, segundo ${registration.source === 'registro.br' ? 'o Registro.br' : 'a consulta RDAP oficial'}.`,
      action: 'Site e e-mails param no dia do vencimento. A renovação é feita direto no registrador.',
    };
  }
  if (days !== null && days < 120) {
    return {
      id: 'dominio-renovacao-proxima',
      area: 'dominio',
      severity: 'warning',
      title: `Renovação do domínio em ${days} dias`,
      evidence: `Registro válido até ${formatDate(registration.expiresAt)}.`,
      action: 'Vale conferir se o cartão cadastrado no registrador continua válido.',
    };
  }
  if (days !== null) {
    return {
      id: 'dominio-ok',
      area: 'dominio',
      severity: 'good',
      title: 'Registro do domínio em dia',
      evidence: `Válido até ${formatDate(registration.expiresAt)} (${days} dias), registrado em ${formatDate(registration.registeredAt)}.`,
      action: 'Nada a fazer neste ponto.',
    };
  }
  return undefined;
};

const checkDnssec = (registration: DomainRegistration): Finding | undefined => {
  if (!registration.dnssec && registration.source === 'registro.br') {
    return {
      id: 'sem-dnssec',
      area: 'seguranca',
      severity: 'info',
      title: 'DNSSEC não está ativo',
      evidence: 'O domínio não tem assinatura DNSSEC delegada.',
      action:
        'O Registro.br oferece DNSSEC sem custo adicional. Ele impede que respostas de DNS sejam falsificadas no caminho.',
    };
  }
  return undefined;
};

const checkMissingMx = (): Finding => ({
  id: 'sem-email-proprio',
  area: 'dominio',
  severity: 'info',
  title: 'O domínio não recebe e-mails',
  evidence: 'Nenhum registro MX configurado.',
  action:
    'Significa que o contato ainda usa endereço de Gmail ou Hotmail em vez de um e-mail no próprio domínio.',
});

const checkSpf = (email: EmailAuthReport): Finding | undefined => {
  if (!email.spf) {
    return {
      id: 'sem-spf',
      area: 'seguranca',
      severity: 'warning',
      title: 'Qualquer pessoa pode enviar e-mail se passando pelo seu domínio',
      evidence: `O domínio recebe e-mails${email.mxProvider ? ` via ${email.mxProvider}` : ''}, mas não publica registro SPF.`,
      action:
        'Sem SPF nada impede um golpista de mandar mensagem como se fosse do seu endereço, e seus próprios e-mails tendem a cair no spam.',
    };
  }
  return undefined;
};

const checkDmarc = (email: EmailAuthReport, domain: string): Finding | undefined => {
  if (!email.dmarc) {
    return {
      id: 'sem-dmarc',
      area: 'seguranca',
      severity: 'warning',
      title: 'Sem política DMARC publicada',
      evidence: 'Nenhum registro TXT em _dmarc.' + domain + '.',
      action:
        'O DMARC diz aos provedores o que fazer com mensagens falsificadas. Gmail e Outlook passaram a exigi-lo de quem envia em volume.',
    };
  }
  if (email.dmarcPolicy === 'none') {
    return {
      id: 'dmarc-permissivo',
      area: 'seguranca',
      severity: 'info',
      title: 'DMARC configurado apenas em modo de observação',
      evidence: `Política declarada: p=none.`,
      action: 'Nesse modo os relatórios chegam, mas mensagens falsificadas continuam sendo entregues.',
    };
  }
  return undefined;
};

const checkDnsResolution = (dns: DnsReport): Finding | undefined => {
  if (!dns.resolves) {
    return {
      id: 'dns-nao-resolve',
      area: 'dominio',
      severity: 'critical',
      title: 'O domínio não aponta para nenhum servidor',
      evidence: 'Nenhum registro A ou AAAA encontrado.',
      action:
        'O endereço existe mas não leva a lugar algum. Costuma ser domínio registrado sem hospedagem configurada.',
    };
  }
  return undefined;
};

export const buildDomainFindings = (result: AuditResult): Finding[] => {
  const out: Finding[] = [];
  const { registration, email, dns } = result;

  if (registration?.found) {
    const expiry = checkRegistrationExpiry(registration);
    if (expiry) out.push(expiry);
    const dnssec = checkDnssec(registration);
    if (dnssec) out.push(dnssec);
  }

  if (email) {
    if (!email.hasMx) {
      out.push(checkMissingMx());
    } else {
      const spf = checkSpf(email);
      if (spf) out.push(spf);
      const dmarc = checkDmarc(email, result.domain);
      if (dmarc) out.push(dmarc);
    }
  }

  if (dns) {
    const resolution = checkDnsResolution(dns);
    if (resolution) out.push(resolution);
  }

  return out;
};
