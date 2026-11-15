import React from 'react';
import { CONTACT, PROFILE } from '../../lib/config';
import { auditWhatsAppUrl } from '../../lib/message';
import type { AuditResult } from '../../lib/types';
import { SECOES_DO_MENU } from '../secoesDoMenu';
import { useAlturaDoCabecalho } from '../useAlturaDoCabecalho';
import { useMenuMovel } from '../useMenuMovel';

export const ID_MENU_MOVEL = 'menu-movel';

interface SiteHeaderProps {
  result: AuditResult | null;
  domain: string;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({ result, domain }) => {
  const headerRef = useAlturaDoCabecalho<HTMLElement>();
  const { aberto, botaoRef, alternar, fechar } = useMenuMovel(headerRef);
  const whatsappUrl = auditWhatsAppUrl(result, domain);

  return (
    <>
      <div className="lp-statusbar">
        <div className="lp-wrap lp-statusbar-inner">
          <span className="lp-statusbar-item">
            <span className="lp-pulse" aria-hidden="true" />
            analisador operante
          </span>
          <span className="lp-statusbar-sep">/</span>
          <span className="lp-statusbar-item">atendimento remoto, sob demanda</span>
          <span className="lp-statusbar-sep">/</span>
          <span className="lp-statusbar-item">projetos com IA e aplicações web</span>
        </div>
      </div>

      {aberto && (
        <div className="lp-menu-backdrop" aria-hidden="true" onClick={fechar} />
      )}

      <header className="lp-header" ref={headerRef}>
        <div className="lp-wrap lp-header-inner">
          <a href="#topo" className="lp-brand" onClick={aberto ? fechar : undefined}>
            <span className="lp-brand-mark">ps</span>
            <span className="lp-brand-text">
              <span className="lp-brand-name">Pedro Satin</span>
              <span className="lp-brand-role">engenharia web</span>
            </span>
          </a>

          <nav className="lp-nav" aria-label="Navegação principal">
            {SECOES_DO_MENU.map((secao) => (
              <a
                key={secao.id}
                href={`#${secao.id}`}
                className={secao.destaque ? 'lp-nav-highlight' : undefined}
              >
                {secao.label}
              </a>
            ))}
          </nav>

          <div className="lp-header-actions">
            <a
              className="lp-btn lp-btn-solid lp-header-cta"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={aberto ? fechar : undefined}
            >
              Falar no WhatsApp
            </a>
            <button
              ref={botaoRef}
              type="button"
              className="lp-btn lp-btn-ghost lp-menu-toggle"
              aria-expanded={aberto}
              aria-controls={ID_MENU_MOVEL}
              onClick={alternar}
            >
              <span className="lp-menu-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span>Menu</span>
            </button>
          </div>
        </div>

        <div id={ID_MENU_MOVEL} className="lp-mobile-panel" hidden={!aberto}>
          <div className="lp-wrap lp-mobile-panel-inner">
            <nav aria-label="Seções da página">
              <ul className="lp-mobile-nav-list">
                {SECOES_DO_MENU.map((secao, indice) => (
                  <li key={secao.id}>
                    <a
                      href={`#${secao.id}`}
                      className={`lp-mobile-nav-link ${secao.destaque ? 'is-featured' : ''}`}
                      onClick={fechar}
                    >
                      <span className="lp-mobile-nav-index" aria-hidden="true">
                        {String(indice + 1).padStart(2, '0')}
                      </span>
                      <span className="lp-mobile-nav-label">{secao.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="lp-mobile-panel-footer">
              <a
                className="lp-btn lp-btn-solid lp-mobile-panel-cta"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={fechar}
              >
                Falar no WhatsApp
              </a>
              <div className="lp-mobile-panel-contacts">
                <span>{CONTACT.whatsappDisplay}</span>
                <div className="lp-mobile-panel-contacts-links">
                  <a
                    href={PROFILE.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={fechar}
                  >
                    LinkedIn
                  </a>
                  <a
                    href={PROFILE.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={fechar}
                  >
                    GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};
