const RELOAD_KEY = 'site-preload-reloaded';

/** Uma aba com assets antigos pode tentar o HTML atual uma vez por sessão. */
export function recoverPreload(event: Event) {
  event.preventDefault();
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return;
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    // Sem armazenamento não há como impedir um ciclo de recargas.
    return;
  }
  window.location.reload();
}
