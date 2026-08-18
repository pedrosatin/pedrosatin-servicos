# Graph Report - .  (2026-08-17)

## Corpus Check
- 60 files · ~67,353 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 373 nodes · 684 edges · 34 communities (21 shown, 13 thin omitted)
- Extraction: 93% EXTRACTED · 6% INFERRED · 1% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Simulador de Auditoria (dadosconfig)|Simulador de Auditoria (dados/config)]]
- [[_COMMUNITY_Pipeline de Auditoria (stepsfindings)|Pipeline de Auditoria (steps/findings)]]
- [[_COMMUNITY_Protótipos de Design (variações AB)|Protótipos de Design (variações A/B)]]
- [[_COMMUNITY_Worker Fetch e Validação Real|Worker: Fetch e Validação Real]]
- [[_COMMUNITY_Worker Necessidade e Motivação (CORS)|Worker: Necessidade e Motivação (CORS)]]
- [[_COMMUNITY_Landing Page Tom e Copywriting|Landing Page: Tom e Copywriting]]
- [[_COMMUNITY_App Shell e Roteamento|App Shell e Roteamento]]
- [[_COMMUNITY_Narrativa do Relatório de Auditoria|Narrativa do Relatório de Auditoria]]
- [[_COMMUNITY_Protótipos Dashboards e Checklists|Protótipos: Dashboards e Checklists]]
- [[_COMMUNITY_Protótipos Layouts Editoriais|Protótipos: Layouts Editoriais]]
- [[_COMMUNITY_Sprite de Ícones Sociais|Sprite de Ícones Sociais]]
- [[_COMMUNITY_Tipos de Ambiente Vite|Tipos de Ambiente Vite]]
- [[_COMMUNITY_Componente AuditSimulator|Componente AuditSimulator]]
- [[_COMMUNITY_Componente FAQ|Componente FAQ]]
- [[_COMMUNITY_Protótipos Relatório Formal|Protótipos: Relatório Formal]]
- [[_COMMUNITY_Protótipos Comparação Visual|Protótipos: Comparação Visual]]
- [[_COMMUNITY_Plugin React do Vite|Plugin React do Vite]]
- [[_COMMUNITY_Search Console URL|Search Console URL]]
- [[_COMMUNITY_Formatação de Bytes|Formatação de Bytes]]
- [[_COMMUNITY_Pontuação de Tom|Pontuação de Tom]]
- [[_COMMUNITY_Favicon (Logomarca)|Favicon (Logomarca)]]
- [[_COMMUNITY_Foto de Perfil|Foto de Perfil]]
- [[_COMMUNITY_Ilustração do Hero|Ilustração do Hero]]
- [[_COMMUNITY_Logo React|Logo React]]
- [[_COMMUNITY_Logo Vite|Logo Vite]]

## God Nodes (most connected - your core abstractions)
1. `auditWhatsAppUrl()` - 24 edges
2. `useAudit()` - 23 edges
3. `CASE_STUDIES` - 12 edges
4. `formatMs()` - 11 edges
5. `parseHtml()` - 11 edges
6. `AuditResult` - 10 edges
7. `Navbar component` - 10 edges
8. `buildNarrative` - 10 edges
9. `LandingPage` - 10 edges
10. `Prototype12()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `AuditResult` --semantically_similar_to--> `AuditResponse`  [INFERRED] [semantically similar]
  src/lib/types.ts → worker/src/index.ts
- `Problema do analisador da rodada 1 (mode:no-cors)` --rationale_for--> `fetchDns`  [INFERRED]
  DESIGN_CONCEPTS_V2.md → src/lib/sources.ts
- `Analisador de site com verificação real` --rationale_for--> `fetchContent`  [INFERRED]
  CONTEXT.md → src/lib/sources.ts
- `Problema do analisador da rodada 1 (mode:no-cors)` --rationale_for--> `fetchPageSpeed`  [INFERRED]
  DESIGN_CONCEPTS_V2.md → src/lib/sources.ts
- `Protótipo 19 — Carta` --rationale_for--> `buildNarrative`  [INFERRED]
  DESIGN_CONCEPTS_V2.md → src/lib/narrative.ts

## Hyperedges (group relationships)
- **Hardcoded WhatsApp deep-link CTA pattern (shared phone number, wa.me URL construction)** — navbar_navbar, hero_hero, auditsimulator_getwhatsappdiagnosticmsg, quotewidget_handlesend, packages_getwhatsappurl, footer_footer [INFERRED 0.90]
- **Single-page anchor navigation linking Navbar/Footer/Hero to on-page sections** — navbar_navbar, footer_footer, hero_hero, solutions_solutions, auditsimulator_auditsimulator, casestudy_casestudy, quotewidget_quotewidget [EXTRACTED 1.00]
- **App-level path-switch routing between numbered prototypes and StyleSwitcherBar navigation controls** — app_app, app_renderactiveprototype, app_handlenavigate, styleswitcherbar_styleswitcherbar [EXTRACTED 1.00]
- **Landing Pages with Client-Simulated HTTP Audit Tool** — prototype1_prototype1, prototype2_prototype2, prototype3_prototype3, prototype4_prototype4, prototype5_prototype5, prototype6_prototype6, prototype9_prototype9, prototype10_prototype10 [INFERRED 0.85]
- **Prototypes Built on Shared Real-Audit Library (useAudit)** — prototype11_prototype11, prototype12_prototype12, prototype13_prototype13, prototype14_prototype14, prototype16_prototype16, prototype17_prototype17, prototype18_prototype18, prototype19_prototype19, prototype20_prototype20 [INFERRED 0.90]
- **Severity/Checklist-Style Audit Report Presentations** — prototype12_prototype12, prototype13_prototype13, prototype17_prototype17 [INFERRED 0.80]
- **Pipeline de auditoria com dados reais (RDAP, DoH, PageSpeed, Worker)** — audit_runaudit, sources_fetchdns, sources_fetchregistration, sources_fetchpagespeed, sources_fetchcontent, index_worker_fetch [INFERRED 0.90]
- **Achados alimentam painéis, narrativa e mensagem de WhatsApp** — findings_buildfindings, narrative_buildnarrative, message_auditwhatsappurl, landingpage_landingpage [INFERRED 0.85]
- **Worker de auditoria: fetch, redirects, robots/sitemap, parse HTML** — index_runaudit, index_followredirects, index_auditrobotsandsitemap, parse_parsehtml [EXTRACTED 1.00]

## Communities (34 total, 13 thin omitted)

### Community 0 - "Simulador de Auditoria (dados/config)"
Cohesion: 0.06
Nodes (54): buildWhatsAppUrl(), CASE_STUDIES, CaseStudy, CONTACT, DOMAIN_EXTENSIONS, DomainExtension, AREA_LABELS, countBySeverity() (+46 more)

### Community 1 - "Pipeline de Auditoria (steps/findings)"
Cohesion: 0.07
Nodes (44): AuditOptions, createSteps(), runAudit(), runStep(), buildFindings(), formatDate(), kb(), ms() (+36 more)

### Community 2 - "Protótipos de Design (variações A/B)"
Cohesion: 0.06
Nodes (31): FIRST_ROUND, Props, SECOND_ROUND, StyleEntry, StyleSwitcherBar(), LatencyTestResult, Prototype10(), TabType (+23 more)

### Community 3 - "Worker: Fetch e Validação Real"
Cohesion: 0.1
Nodes (35): fetchContent(), AuditResponse, auditRobotsAndSitemap(), checkHttpsUpgrade(), corsHeaders(), DEFAULT_ORIGINS, Env, fetch() (+27 more)

### Community 4 - "Worker: Necessidade e Motivação (CORS)"
Cohesion: 0.06
Nodes (36): runStep, AUDIT_ENDPOINT, PAGESPEED_KEY, Analisador de site com verificação real, Problema do analisador da rodada 1 (mode:no-cors), Necessidade do Worker por causa de same-origin policy, worker/dev-server.mjs, AuditResponse (+28 more)

### Community 5 - "Landing Page: Tom e Copywriting"
Cohesion: 0.08
Nodes (30): createSteps, runAudit, buildWhatsAppUrl, CASE_STUDIES, DOMAIN_EXTENSIONS, Diretriz de tom honesto e sem clichês de IA, Protótipo 11 — Terminal operante, Protótipo 19 — Carta (+22 more)

### Community 6 - "App Shell e Roteamento"
Cohesion: 0.19
Nodes (20): App component, handleNavigate (pushState navigation), renderActivePrototype (path-based switch router), AuditSimulator component, getWhatsAppDiagnosticMsg, runRealAudit (client-side HEAD fetch probe), CaseStudy component, components/index.ts re-export barrel (+12 more)

### Community 7 - "Narrativa do Relatório de Auditoria"
Cohesion: 0.33
Nodes (10): abertura(), buildNarrative(), fechamento(), listar(), NarrativeSection, sobreBusca(), sobreDominio(), sobreSeguranca() (+2 more)

### Community 8 - "Protótipos: Dashboards e Checklists"
Cohesion: 0.29
Nodes (8): Prototype 10: Tabbed Diagnostic Dashboard, Prototype 11: Terminal Log Real Audit, Prototype 13: Modular Severity Checklist, Prototype 15: Comparison Table Criteria, Prototype 17: Pass/Fail Checklist Groups, Prototype 20: Network Map Diagram, Prototype 4: Terminal/Jamstack Dev Aesthetic, Prototype 8: Dashboard Inspector Diagnostic

### Community 9 - "Protótipos: Layouts Editoriais"
Cohesion: 0.33
Nodes (7): Prototype 1: Swiss Editorial Layout, Prototype 2: Corporate Executive Layout, Prototype 3: Warm Terracotta Consultant Layout, Prototype 5: 3-Step WhatsApp Quote Widget, Prototype 6: FAQ-Driven Audit Landing Page, Prototype 7: 4-Step Diagnostic Wizard, Prototype 9: Newspaper Editorial Layout

### Community 10 - "Sprite de Ícones Sociais"
Cohesion: 0.43
Nodes (7): Bluesky Icon Symbol, Discord Icon Symbol, Documentation Icon Symbol, GitHub Icon Symbol, Social/Contacts Icon Symbol, UI Icon Sprite Sheet (icons.svg), X (Twitter) Icon Symbol

### Community 14 - "Protótipos: Relatório Formal"
Cohesion: 0.67
Nodes (3): Prototype 12: Formal Laudo/Report Document, Prototype 14: Domain Ownership Timeline, Prototype 19: Narrative Text Report

## Ambiguous Edges - Review These
- `runRealAudit (client-side HEAD fetch probe)` → `StyleSwitcherBar component`  [AMBIGUOUS]
  src/components/AuditSimulator.tsx · relation: conceptually_related_to
- `Prototype 10: Tabbed Diagnostic Dashboard` → `Prototype 20: Network Map Diagram`  [AMBIGUOUS]
  src/prototypes/Prototype10.tsx · relation: semantically_similar_to
- `Prototype 12: Formal Laudo/Report Document` → `Prototype 19: Narrative Text Report`  [AMBIGUOUS]
  src/prototypes/Prototype19.tsx · relation: semantically_similar_to
- `buildNarrative` → `LandingPage`  [AMBIGUOUS]
  src/lib/narrative.ts · relation: conceptually_related_to

## Knowledge Gaps
- **125 isolated node(s):** `ImportMetaEnv`, `ImportMeta`, `RealAuditResult`, `FAQItem`, `Props` (+120 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `runRealAudit (client-side HEAD fetch probe)` and `StyleSwitcherBar component`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Prototype 10: Tabbed Diagnostic Dashboard` and `Prototype 20: Network Map Diagram`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Prototype 12: Formal Laudo/Report Document` and `Prototype 19: Narrative Text Report`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `buildNarrative` and `LandingPage`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `fetch()` connect `Worker: Fetch e Validação Real` to `Pipeline de Auditoria (steps/findings)`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `fetchPageSpeed()` connect `Pipeline de Auditoria (steps/findings)` to `Simulador de Auditoria (dados/config)`, `Worker: Fetch e Validação Real`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `ImportMetaEnv`, `ImportMeta`, `RealAuditResult` to the rest of the system?**
  _125 weakly-connected nodes found - possible documentation gaps or missing edges._