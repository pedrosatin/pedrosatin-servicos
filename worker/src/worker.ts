// Entrada do Worker. O runtime trata cada export nomeado do módulo principal
// como handler e recusa constantes, então index.ts (que exporta helpers e
// limites para os testes) fica fora da entrada e só o handler é reexportado.
export { default } from './index';
