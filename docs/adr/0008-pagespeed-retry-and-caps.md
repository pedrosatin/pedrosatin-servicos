# Retry do PageSpeed e tetos do Worker

O Lighthouse no Google falha com frequência transitória; repetir 400/403/404 ou 429 do Worker só piora a espera. A cota da API é compartilhada entre isolates.

**Decisão (front, `sources.ts` / `audit.ts`):** retry com backoff e jitter só para 500/502/503 e rede; 429 do Google espera mais; `rate_limited` do Worker não repete na mesma janela; 400/403/404 não repetem. Timeout próprio por ida. Prefere `fullPageScreenshot` a `final-screenshot`. PageSpeed pode ser desligado sem invalidar o resto; falha de fonte não vira “nada encontrado”.

**Decisão (Worker, `index.ts`):** teto de subrequests por auditoria; cache de medição por isolate; tetos por bloco (/48 ou /24), por minuto e por hora no isolate; limitador por cliente (IPv6=/64, IPv4=endereço) com tabela de tamanho fixo que descarta a janela mais antiga; respostas de erro com `no-store`; 429 de teto indistinguível do 429 do Google para o visitante; logs sem `message` livre do provedor.

**Consequências:** dimensionar tetos pela cota efetiva (ver STATUS / README do Worker). Cache por isolate não é coerência global.
