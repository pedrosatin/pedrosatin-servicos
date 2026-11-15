// Import `?raw` do Vite, usado pelos testes para ler o wrangler.toml como texto.
declare module '*?raw' {
  const content: string;
  export default content;
}
