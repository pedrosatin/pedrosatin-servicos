import React from 'react';
import { FAQ_ITEMS } from '../../lib/faq';
import { RotuloDaSecao } from './RotuloDaSecao';

export const FaqSection: React.FC = () => (
      <section className="lp-faq" id="faq">
        <div className="lp-wrap">
          <RotuloDaSecao id="faq" />
          <h2 className="lp-h2">Perguntas frequentes</h2>
          <p className="lp-h2-sub">
            Respostas diretas para as dúvidas mais comuns.
          </p>
          <div className="lp-faq-list">
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
