import React from 'react';
import { PROFILE } from '../../lib/config';
import { FactList } from './FactList';

export const AboutSection: React.FC = () => (
  <section className="lp-about" id="sobre">
    <div className="lp-wrap">
      <h2 className="lp-h2">Quem faz o trabalho</h2>
      <p className="lp-h2-sub">
        Você fala diretamente com quem programa e resolve, sem intermediários ou agências.
      </p>

      <div className="lp-about-grid">
        <div className="lp-about-text">
          <p>
            Sou Pedro Satin, engenheiro de software na Saúde Bliss e professor universitário. Entendo a fundo como Cursor, Lovable, v0 e Bolt geram código, e sei onde a engenharia sênior precisa intervir para garantir banco de dados, segurança, estabilidade e performance.
          </p>
        </div>

        <FactList
          className="lp-about-facts"
          items={[
            {
              label: 'Engenharia',
              value: 'Software Engineer na Saúde Bliss (IA e integrações)',
            },
            {
              label: 'Docência',
              value: 'Professor de Tecnologias Emergentes na UniCesumar',
            },
            {
              label: 'Experiência',
              value: 'Frontend no Inter (Intershop), Claranet e UniCesumar',
            },
            {
              label: 'Formação',
              value: 'Bacharel em Engenharia de Software com pós em Frontend',
            },
          ]}
        />
      </div>

      <div className="lp-about-links">
        <a href={PROFILE.linkedin} target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>
        <a href={PROFILE.github} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <a href={PROFILE.portfolio} target="_blank" rel="noopener noreferrer">
          pedrosatin.com
        </a>
      </div>
    </div>
  </section>
);
