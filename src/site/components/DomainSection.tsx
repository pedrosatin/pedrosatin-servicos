import React from 'react';
import { DOMAIN_EXTENSIONS, REGISTRO_BR_URL } from '../../lib/config';
import { formatDate } from '../../lib/format';
import type { DomainRegistration } from '../../lib/types';
import { FactList } from './FactList';

interface DomainSectionProps {
  domain?: string;
  registration?: DomainRegistration | null;
}

export const DomainSection: React.FC<DomainSectionProps> = ({
  domain,
  registration = null,
}) => (
  <section className="lp-domain" id="dominio">
    <div className="lp-wrap">
      <h2 className="lp-h2">Domínio e infraestrutura no seu nome</h2>
      <p className="lp-h2-sub">
        Domínios .com.br custam a partir de R$ 40 por ano direto no Registro.br. Você paga aos provedores oficiais, sem taxa intermediária ou dependência técnica.
      </p>

      <div className="lp-domain-facts">
        <FactList
          items={[
            {
              label: 'Titularidade',
              value: 'seu CPF ou CNPJ desde o primeiro dia, sem intermediário',
            },
            {
              label: 'Custo do domínio',
              value: 'a partir de R$ 40 ao ano pago direto ao Registro.br',
            },
            {
              label: 'Hospedagem',
              value: 'configurada em contas suas (Vercel, Cloudflare, AWS)',
            },
            {
              label: 'Meu trabalho',
              value: 'arquitetura, apontamento de DNS, SSL e publicação',
            },
          ]}
        />
      </div>

      {registration?.found && domain && (
        <div className="lp-domain-live">
          <span className="lp-domain-live-label">
            Consulta feita agora em {domain}
          </span>
          <dl>
            <div>
              <dt>Registrador</dt>
              <dd>{registration.registrar ?? 'não informado'}</dd>
            </div>
            <div>
              <dt>Registrado em</dt>
              <dd>{formatDate(registration.registeredAt)}</dd>
            </div>
            <div>
              <dt>Válido até</dt>
              <dd>
                {formatDate(registration.expiresAt)}
                {registration.daysToExpire !== null && (
                  <span> ({registration.daysToExpire} dias)</span>
                )}
              </dd>
            </div>
            <div>
              <dt>DNSSEC</dt>
              <dd>{registration.dnssec ? 'ativo' : 'não configurado'}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="lp-domain-ext">
        <h3>Extensões mais comuns</h3>
        <p className="lp-domain-ext-lede">
          O .com.br atende a maioria dos projetos. Para apps e MVPs, extensões como .app.br e .dev.br destacam seu produto.
        </p>
        <ul className="lp-ext-list">
          {DOMAIN_EXTENSIONS.map((item) => (
            <li key={item.suffix}>
              <code>{item.suffix}</code>
              <span className="lp-ext-audience">{item.audience}</span>
            </li>
          ))}
        </ul>
        <a
          className="lp-inline-link"
          href={REGISTRO_BR_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver a lista completa no Registro.br
        </a>
      </div>
    </div>
  </section>
);
