import React from 'react';
import { FAQ_ITEMS } from '../../lib/faq';

export const FaqSection: React.FC = () => (
      <section className="lp-faq" id="faq">
        <div className="lp-wrap">
          <h2 className="lp-h2">Perguntas frequentes</h2>
          <p className="lp-h2-sub">
            Respostas diretas para as dúvidas mais comuns.
          </p>
          <div className="lp-faq-list">
            {/* `<details>` em vez de estado do React por três razões: a resposta
                fica sempre no HTML, e não só quando aberta, o que a torna
                indexável e a mantém idêntica ao que os dados estruturados
                declaram; o teclado e o leitor de tela funcionam sem código; e a
                abertura funciona com o JavaScript desligado. */}
            {FAQ_ITEMS.map((item, index) => (
              <details
                key={item.q}
                className="lp-faq-item"
                name="faq"
                open={index === 0}
              >
                <summary className="lp-faq-button">
                  <span>{item.q}</span>
                  <span className="lp-faq-sign" aria-hidden="true" />
                </summary>
                <div className="lp-faq-answer">
                  {item.a.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
);
