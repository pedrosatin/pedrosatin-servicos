import React from 'react';
import { CONTACT, PROFILE } from '../../lib/config';

export const Footer: React.FC = () => (
  <footer className="lp-footer">
    <div className="lp-wrap lp-footer-inner">
      <div className="lp-footer-main">
        <span className="lp-footer-name">Pedro Satin</span>
        <span className="lp-footer-role">engenharia de software e desenvolvimento web</span>
        <span className="lp-footer-remote">atendimento remoto</span>
      </div>
      <div className="lp-footer-sources">
        Fontes da análise: PageSpeed Insights do Google, RDAP do Registro.br, DNS público e
        leitura direta do HTML do site consultado.
      </div>
      <div className="lp-signature">
        <span className="lp-signature-label">feito por</span>
        <a
          className="lp-signature-handle"
          href={PROFILE.portfolio}
          target="_blank"
          rel="noopener noreferrer"
        >
          {CONTACT.handle}
        </a>
        <span className="lp-footer-divider" aria-hidden="true">·</span>
        <a
          className="lp-footer-link"
          href={PROFILE.linkedin}
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
        <span className="lp-footer-divider" aria-hidden="true">·</span>
        <a
          className="lp-footer-link"
          href={PROFILE.github}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <span className="lp-footer-divider" aria-hidden="true">·</span>
        <a className="lp-footer-link" href="/llms.txt" target="_blank" rel="noopener noreferrer">
          llms.txt
        </a>
      </div>
    </div>
  </footer>
);
