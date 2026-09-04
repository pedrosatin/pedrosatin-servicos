import React from 'react';
import { SERVICES } from '../../lib/services';

export const ServicesSection: React.FC = () => (
      <section className="lp-services" id="resolvo">
        <div className="lp-wrap">
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
              </article>
            ))}
          </div>
        </div>
      </section>
);
