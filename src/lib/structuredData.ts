/**
 * Dados estruturados no formato JSON-LD.
 *
 * Um `@graph` único, com os nós ligados por `@id`, em vez de vários blocos
 * soltos: assim o Google entende que a página, o serviço e a pessoa são as
 * mesmas entidades citadas em cada lugar, e não três coisas independentes.
 *
 * O texto das perguntas e dos serviços vem dos mesmos módulos que a página
 * renderiza (`faq.ts`, `services.ts`). O `FAQPage` só é elegível a resultado
 * enriquecido se a resposta declarada aparecer na tela, e é por isso que a
 * resposta não pode ser um segundo texto escrito à mão aqui.
 *
 * O bloco é servido no corpo da página, o que é válido para o schema.org, e sai
 * junto com o HTML pré-renderizado. Ele não conta como script executável para a
 * CSP: `application/ld+json` é dado, não código.
 */
import { CASE_STUDIES, CONTACT, PROFILE, SITE_URL } from './config';
import { FAQ_ITEMS } from './faq';
import { SERVICES } from './services';

const SITE_ID = `${SITE_URL}/#site`;
const PAGE_ID = `${SITE_URL}/#pagina`;
const PERSON_ID = `${PROFILE.portfolio}/#pedro-satin`;
const BUSINESS_ID = `${SITE_URL}/#servico`;

const SITE_NAME = 'Pedro Satin — Desenvolvimento Web';

const DESCRIPTION =
  'Desenvolvimento web sob demanda: publicação de sites, registro e apontamento de domínio, correção de desempenho no celular e de problemas de indexação no Google. Sem mensalidade, com o código e as contas no nome do cliente.';

export const buildStructuredData = (): string =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        inLanguage: 'pt-BR',
        publisher: { '@id': PERSON_ID },
      },
      {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: CONTACT.name,
        jobTitle: 'Engenheiro de Software',
        url: PROFILE.portfolio,
        image: `${SITE_URL}${PROFILE.photo}`,
        knowsAbout: [
          'Desenvolvimento web',
          'Otimização de desempenho web',
          'SEO técnico',
          'Registro de domínio .br',
          'Configuração de DNS',
        ],
        sameAs: [PROFILE.linkedin, PROFILE.github, PROFILE.portfolio],
      },
      {
        '@type': 'ProfessionalService',
        '@id': BUSINESS_ID,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        image: `${SITE_URL}/imagens/compartilhamento.png`,
        description: DESCRIPTION,
        inLanguage: 'pt-BR',
        availableLanguage: 'pt-BR',
        telephone: `+${CONTACT.whatsapp}`,
        // Atendimento remoto: o alcance é o país, e não há endereço a declarar.
        areaServed: { '@type': 'Country', name: 'Brasil' },
        provider: { '@id': PERSON_ID },
        founder: { '@id': PERSON_ID },
        // Sem `aggregateRating` nem `review`: não existem avaliações públicas, e
        // inventar uma é motivo de penalidade manual, além de ser mentira.
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'O que eu resolvo',
          itemListElement: SERVICES.map((service) => ({
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: service.title,
              description: service.short,
              provider: { '@id': PERSON_ID },
              areaServed: { '@type': 'Country', name: 'Brasil' },
            },
          })),
        },
      },
      {
        '@type': 'WebPage',
        '@id': PAGE_ID,
        url: `${SITE_URL}/`,
        name: 'Análise gratuita de site | Velocidade, Google e domínio',
        description: DESCRIPTION,
        inLanguage: 'pt-BR',
        isPartOf: { '@id': SITE_ID },
        about: { '@id': BUSINESS_ID },
        primaryImageOfPage: `${SITE_URL}/imagens/compartilhamento.png`,
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#perguntas`,
        isPartOf: { '@id': PAGE_ID },
        mainEntity: FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a.join(' ') },
        })),
      },
      {
        '@type': 'ItemList',
        '@id': `${SITE_URL}/#trabalhos`,
        name: 'Sites que eu fiz',
        itemListElement: CASE_STUDIES.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          url: `https://${item.domain}`,
        })),
      },
    ],
  });
