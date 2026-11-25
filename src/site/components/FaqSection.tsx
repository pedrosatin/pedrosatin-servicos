import React from 'react';
import { FAQ_ITEMS } from '../../lib/faq';
import { RotuloDaSecao } from './RotuloDaSecao';

const URL_RE = /(https?:\/\/[^\s]+)/g;

function paragraphWithLinks(text: string): React.ReactNode[] {
  return text.split(URL_RE).map((part, index) => {
    if (!/^https?:\/\//.test(part)) {
      return <React.Fragment key={index}>{part}</React.Fragment>;
    }
    const trailing = part.match(/[.,;:!?)]+$/)?.[0] ?? '';
    const href = trailing ? part.slice(0, -trailing.length) : part;
    return (
      <React.Fragment key={index}>
        <a href={href} rel="noopener noreferrer">
          {href}
        </a>
        {trailing}
      </React.Fragment>
    );
  });
}

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
                    <p key={paragraph}>{paragraphWithLinks(paragraph)}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
);
