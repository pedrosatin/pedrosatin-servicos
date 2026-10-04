import React from 'react';
import { CONTACT, buildWhatsAppUrl } from '../../lib/config';
import { briefingWhatsAppUrl, type Briefing } from '../../lib/message';
import type { AuditResult } from '../../lib/types';
import { FactList } from './FactList';

const NEEDS = [
  'Fiz um projeto com IA e não sei como publicar',
  'Meu projeto feito com IA está com bugs ou travou',
  'Preciso integrar banco de dados, login ou pagamentos',
  'Meu site feito com IA está lento ou quebrado no celular',
  'Quero transformar meu protótipo de IA em um produto real',
  'Ainda não sei, quero uma avaliação técnica',
];

interface RequestSectionProps {
  briefing: Briefing;
  onChange: (next: Briefing) => void;
  result: AuditResult | null;
}

export const RequestSection: React.FC<RequestSectionProps> = ({
  briefing,
  onChange,
  result,
}) => {
  const briefingReady = briefing.name.trim().length > 0 && briefing.need.trim().length > 0;

  return (
    <section className="lp-request" id="atendimento">
      <div className="lp-wrap">
        <h2 className="lp-h2">Solicitar orçamento em 3 passos</h2>
        <p className="lp-h2-sub">
          Preencha o essencial abaixo. O botão gera a mensagem pronta no WhatsApp com o diagnóstico da análise se você tiver rodado.
        </p>

        <div className="lp-request-grid">
          <div className="lp-request-form">
            <div className="lp-field-step">
              <span className="lp-step-badge">1</span>
              <div className="lp-step-body">
                <h3>Quem é você</h3>
                <div className="lp-field-row">
                  <label className="lp-field">
                    <span>Nome</span>
                    <input
                      value={briefing.name}
                      onChange={(event) => onChange({ ...briefing, name: event.target.value })}
                      placeholder="como devo te chamar"
                      autoComplete="name"
                    />
                  </label>
                  <label className="lp-field">
                    <span>Atividade ou projeto</span>
                    <input
                      value={briefing.activity}
                      onChange={(event) =>
                        onChange({ ...briefing, activity: event.target.value })
                      }
                      placeholder="aplicação web, MVP, SaaS, clínica, e-commerce"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="lp-field-step">
              <span className="lp-step-badge">2</span>
              <div className="lp-step-body">
                <h3>Do que você precisa</h3>
                <div className="lp-needs">
                  {NEEDS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`lp-need ${briefing.need === item ? 'active' : ''}`}
                      onClick={() => onChange({ ...briefing, need: item })}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lp-field-step">
              <span className="lp-step-badge">3</span>
              <div className="lp-step-body">
                <h3>Situação atual</h3>
                <label className="lp-field">
                  <span>Link do projeto ou site atual (opcional)</span>
                  <input
                    value={briefing.currentSite}
                    onChange={(event) =>
                      onChange({ ...briefing, currentSite: event.target.value })
                    }
                    placeholder="seusite.com.br, link do Lovable/v0/Bolt ou deixe em branco"
                    spellCheck={false}
                  />
                </label>
                <label className="lp-field">
                  <span>Algo que eu deva saber antes</span>
                  <textarea
                    value={briefing.notes}
                    onChange={(event) => onChange({ ...briefing, notes: event.target.value })}
                    placeholder="ferramenta usada (Cursor, Lovable, v0, Bolt), erros encontrados, integrações necessárias"
                    rows={3}
                  />
                </label>
              </div>
            </div>

            <div className="lp-request-submit">
              <p className="lp-request-note">
                Resposta rápida em horário comercial. O levantamento não tem custo.
              </p>
              {briefingReady ? (
                <a
                  className="lp-btn lp-btn-solid lp-btn-lg"
                  href={briefingWhatsAppUrl(briefing, result)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir WhatsApp com esta mensagem
                </a>
              ) : (
                <button
                  type="button"
                  className="lp-btn lp-btn-solid lp-btn-lg disabled"
                  disabled
                >
                  Preencha nome e necessidade
                </button>
              )}
            </div>
          </div>

          <aside className="lp-request-side">
            <h3>O que acontece depois</h3>
            <FactList
              as="ol"
              items={[
                {
                  label: 'Levantamento',
                  value:
                    'conversamos sobre o projeto e necessidades. Se houver link, eu analiso a saúde técnica.',
                },
                {
                  label: 'Orçamento',
                  value: 'valor fechado do trabalho com escopo escrito e prazo claro.',
                },
                {
                  label: 'Execução e entrega',
                  value:
                    'desenvolvimento com acompanhamento, publicação nas suas contas e auditoria final.',
                },
              ]}
            />
            <div className="lp-request-contact">
              <span>WhatsApp</span>
              <a
                href={buildWhatsAppUrl('Olá Pedro, vim pela sua página de serviços.')}
                target="_blank"
                rel="noopener noreferrer"
              >
                {CONTACT.whatsappDisplay}
              </a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};
