import React from 'react';

export const TermsSection: React.FC = () => (
  <section className="lp-terms">
    <div className="lp-wrap">
      <h2 className="lp-h2">Como o trabalho funciona</h2>
      <div className="lp-terms-grid">
        <article>
          <h3>Sob demanda, sem mensalidade</h3>
          <p>
            Levantamento técnico, orçamento com valor fechado e prazo definido. Sem contratos recorrentes obrigatórios.
          </p>
        </article>
        <article>
          <h3>Código 100% seu</h3>
          <p>
            Repositório no GitHub transferido para a sua conta. Sem amarras nem plataformas proprietárias.
          </p>
        </article>
        <article>
          <h3>Contas na sua titularidade</h3>
          <p>
            Domínio, hospedagem e banco pertencem a você desde o primeiro dia.
          </p>
        </article>
        <article>
          <h3>Atendimento direto</h3>
          <p>
            Contato direto comigo pelo WhatsApp durante todo o projeto.
          </p>
        </article>
      </div>
    </div>
  </section>
);
