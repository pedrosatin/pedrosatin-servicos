import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const container = document.getElementById('root')!
const tree = (
  <StrictMode>
    <App />
  </StrictMode>
)

// No build o HTML já sai escrito (ver `entry-server.tsx`) e o React apenas
// assume o que está na tela. No servidor de desenvolvimento o root chega
// vazio, e aí a renderização é a comum.
if (container.hasChildNodes()) {
  hydrateRoot(container, tree)
} else {
  createRoot(container).render(tree)
}
