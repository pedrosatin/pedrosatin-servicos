import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    /**
     * Alvo declarado em vez do padrão do Vite, que muda de versão para versão.
     * A lista cobre navegadores de 2021 em diante, o que inclui o iOS 15 ainda
     * comum em aparelhos que não recebem mais atualização — e que é exatamente
     * o público lento que esta página se propõe a medir. Nada no código exige
     * mais que isso: o JavaScript para em encadeamento opcional e coalescência
     * nula, e o CSS em `gap`, `clamp` e `aspect-ratio`.
     */
    target: ['es2020', 'chrome96', 'edge96', 'firefox94', 'safari15'],
    cssTarget: ['chrome96', 'edge96', 'firefox94', 'safari15'],
  },
})
