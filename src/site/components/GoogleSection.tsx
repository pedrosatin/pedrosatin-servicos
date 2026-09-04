import React from 'react';
import { googleIndexUrl } from '../../lib/dominio';

interface GoogleSectionProps {
  domainToConsult: string;
}

export const GoogleSection: React.FC<GoogleSectionProps> = ({ domainToConsult }) => (
      <section className="lp-google" id="google">
        <div className="lp-wrap">
          <h2 className="lp-h2">Por que seu projeto de IA não aparece no Google?</h2>
          <p className="lp-h2-sub">
            Aparecer na busca não é uma chave que se liga. Aplicações geradas por IA costumam entregar um HTML vazio: o usuário vê a tela, mas o robô lê uma página em branco.
          </p>

          <ol className="lp-steps-flow">
            <li>
              <span className="lp-flow-num">1</span>
              <h3>Descoberta</h3>
              <p>
                O robô precisa encontrar seu endereço através de sitemap e links indexados.
              </p>
            </li>
            <li>
              <span className="lp-flow-num">2</span>
              <h3>Rastreamento</h3>
              <p>
                O robô precisa acessar seu servidor sem bloqueios de robots.txt ou lentidão de resposta.
              </p>
            </li>
            <li>
              <span className="lp-flow-num">3</span>
              <h3>Indexação</h3>
              <p>
                O conteúdo precisa estar no HTML inicial para ser arquivado, e não apenas no JavaScript.
              </p>
            </li>
            <li>
              <span className="lp-flow-num">4</span>
              <h3>Posicionamento</h3>
              <p>
                Velocidade no celular e estabilidade de layout definem a ordem nas buscas.
              </p>
            </li>
          </ol>

          <div className="lp-google-check">
            <div>
              <h3>Consulte o que o Google guardou do seu site</h3>
              <p>
                O comando <code>site:seusite.com.br</code> mostra exatamente as páginas arquivadas pelo Google. Veja o resultado real da busca.
              </p>
            </div>
            <a
              className="lp-btn lp-btn-ghost"
              href={googleIndexUrl(domainToConsult)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar no Google
            </a>
          </div>
        </div>
      </section>
);
