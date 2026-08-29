import React from 'react';
import { auditWhatsAppUrl } from '../../lib/message';
import type { AuditResult } from '../../lib/types';

interface HeaderProps {
  result: AuditResult | null;
  domain: string;
}

export const Header: React.FC<HeaderProps> = ({ result, domain }) => (
  <header className="lp-header">
    <div className="lp-wrap lp-header-inner">
      <a href="#topo" className="lp-brand">
        <span className="lp-brand-mark">ps</span>
        <span className="lp-brand-text">
          <span className="lp-brand-name">Pedro Satin</span>
          <span className="lp-brand-role">engenharia web</span>
        </span>
      </a>
      <nav className="lp-nav">
        <a href="#analise">Análise</a>
        <a href="#resolvo">O que eu resolvo</a>
        <a href="#google">Google</a>
        <a href="#dominio">Domínio</a>
        <a href="#sobre">Sobre mim</a>
        <a href="#trabalhos">Trabalhos</a>
        <a href="#faq">Perguntas</a>
      </nav>
      <a
        className="lp-btn lp-btn-solid"
        href={auditWhatsAppUrl(result, domain)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Falar no WhatsApp
      </a>
    </div>
  </header>
);
