import React from 'react';
import { CONTACT, PROFILE, buildWhatsAppUrl } from '../../lib/config';
import { SECOES_DO_MENU } from '../secoesDoMenu';

const URL_WHATSAPP_RODAPE = buildWhatsAppUrl('Olá Pedro, vim pela sua página de serviços.');

export const Footer: React.FC = () => (
  <footer className="lp-footer">
    <div className="lp-wrap lp-footer-inner">
      <div className="lp-footer-main">
        <span className="lp-footer-name">{CONTACT.name}</span>
        <span className="lp-footer-role">engenharia de software e desenvolvimento web</span>
        <span className="lp-footer-remote">atendimento remoto</span>
      </div>

      <div className="lp-footer-grid">
        <div className="lp-footer-block">
          <h2 className="lp-footer-heading">Contato</h2>
          <div className="lp-footer-contact">
            <span className="lp-footer-contact-label">WhatsApp</span>
            <a
              className="lp-footer-whatsapp"
              href={URL_WHATSAPP_RODAPE}
              target="_blank"
              rel="noopener noreferrer"
            >
              {CONTACT.whatsappDisplay}
            </a>
          </div>
        </div>

        <div className="lp-footer-block">
          <h2 className="lp-footer-heading">Seções</h2>
          <nav aria-label="Seções do rodapé">
            <ul className="lp-footer-nav-list">
              {SECOES_DO_MENU.map((secao) => (
                <li key={secao.id}>
                  <a
                    className={
                      secao.destaque ? 'lp-footer-nav-link is-featured' : 'lp-footer-nav-link'
                    }
                    href={`#${secao.id}`}
                  >
                    {secao.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
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
        <a
          className="lp-footer-link"
          href={PROFILE.linkedin}
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
        <a
          className="lp-footer-link"
          href={PROFILE.github}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <a className="lp-footer-link" href="/llms.txt" target="_blank" rel="noopener noreferrer">
          llms.txt
        </a>
      </div>
    </div>
  </footer>
);
