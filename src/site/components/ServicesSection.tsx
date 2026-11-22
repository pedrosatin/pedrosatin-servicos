import React from 'react';
import { SERVICES } from '../../lib/services';
import { RotuloDaSecao } from './RotuloDaSecao';

interface ServicesSectionProps {
  onQueroResolver: (need: string) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onQueroResolver }) => (
  <section className="lp-services" id="resolvo">
    <div className="lp-wrap">
      <RotuloDaSecao id="resolvo" />
      <h2 className="lp-h2">O que eu resolvo</h2>
      <p className="lp-h2-sub">
        Problemas reais que destravam o lançamento do seu projeto. A auditoria no topo mede o impacto de cada um.
      </p>
      <div className="lp-service-grid">
        {SERVICES.map((service, index) => (
          <article key={service.title} className="lp-service">
            <span className="lp-service-index">{String(index + 1).padStart(2, '0')}</span>
            <h3>{service.title}</h3>
            <p>{service.body}</p>
            <a
              className="lp-service-cta"
              href="#atendimento"
              aria-label={`Quero resolver isso: ${service.title}`}
              onClick={(event) => {
                event.preventDefault();
                onQueroResolver(service.need);
              }}
            >
              Quero resolver isso
            </a>
          </article>
        ))}
      </div>
    </div>
  </section>
);
