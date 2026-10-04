import React from 'react';

/** Barra de status do aparelho: hora à esquerda, ilha ao centro, ícones à direita. */
export const DeviceStatusBar: React.FC<{ time: string }> = ({ time }) => (
  <div className="lp-device-statusbar" aria-hidden="true">
    <span className="lp-device-time">{time}</span>
    <span className="lp-device-island" />
    <span className="lp-device-icons">
      <svg viewBox="0 0 13 9" width="12" height="8" fill="currentColor">
        <rect x="0" y="6.2" width="2" height="2.8" rx="0.6" />
        <rect x="3.4" y="4.2" width="2" height="4.8" rx="0.6" />
        <rect x="6.8" y="2.1" width="2" height="6.9" rx="0.6" />
        <rect x="10.2" y="0" width="2" height="9" rx="0.6" />
      </svg>
      <svg viewBox="0 0 12 9" width="11" height="8" fill="none" stroke="currentColor">
        <path d="M0.9 2.6a7.6 7.6 0 0 1 10.2 0" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M2.9 4.9a4.7 4.7 0 0 1 6.2 0" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M4.9 7.2a1.8 1.8 0 0 1 2.2 0" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 17 9" width="16" height="8" fill="currentColor">
        <rect x="0.5" y="0.5" width="13" height="8" rx="2.4" fill="none" stroke="currentColor" />
        <rect x="2" y="2" width="9.5" height="5" rx="1.2" />
        <path d="M15.2 3.1a1.7 1.7 0 0 1 0 2.8V3.1Z" />
      </svg>
    </span>
  </div>
);
