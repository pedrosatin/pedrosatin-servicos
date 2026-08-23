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

const SITE_NAME = 'Pedro Satin: Engenharia Web e Deploy para Projetos com IA';

const DESCRIPTION =
  'Engenharia web e deploy sob demanda para projetos criados com IA (Cursor, Lovable, v0, Bolt). Publicação com domínio próprio, correção de bugs, banco de dados, pagamentos e SEO técnico. Sem mensalidade, código 100% seu.';

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
        jobTitle: 'Engenheiro de Software e Professor Universitário',
        url: PROFILE.portfolio,
        image: `${SITE_URL}${PROFILE.photo}`,
        knowsAbout: [
          'Engenharia de software',
          'Desenvolvimento web',
          'Deploy de aplicações de IA',
          'Cursor, v0, Lovable e Bolt.new',
          'Otimização de desempenho web',
          'Core Web Vitals',
          'SEO técnico',
          'Integração de banco de dados e Supabase',
          'Integração de pagamentos (Stripe, Asaas)',
          'Configuração de DNS e domínio próprio',
          'Tecnologias Emergentes',
          'Inteligência Artificial',
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
        name: 'Publicação, Deploy e Engenharia para Projetos criados com IA | Pedro Satin',
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
