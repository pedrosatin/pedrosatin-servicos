const RELOAD_KEY = 'site-preload-reloaded';

export function recoverPreload(event: Event) {
  event.preventDefault();
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return;
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    return;
  }
  window.location.reload();
}
