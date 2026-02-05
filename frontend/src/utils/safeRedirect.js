/**
 * Validation des URLs avant redirection (mitigation Open Redirect / Snyk Code).
 * - URL interne : tout chemin commençant par / (sans //) est autorisé.
 * - URL externe : uniquement si l'hôte est en liste blanche (ex: Stripe).
 */

/** Domaines autorisés pour les redirections (ex: Stripe Checkout) */
const ALLOWED_REDIRECT_HOSTS = [
  'checkout.stripe.com',
  'billing.stripe.com',
  'js.stripe.com'
];

/**
 * Vérifie qu'une URL est sûre pour une redirection (pas d'open redirect).
 * - Autorise les chemins relatifs commençant par / (même origine).
 * - Autorise les URLs absolues dont l'hôte est dans ALLOWED_REDIRECT_HOSTS (HTTPS uniquement).
 * @param {string} url - URL à valider
 * @param {string} [currentOrigin] - Origine courante (optionnel, défaut: window.location.origin)
 * @returns {boolean}
 */
export function isSafeUrl(url, currentOrigin = typeof window !== 'undefined' ? window.location?.origin : '') {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Redirection interne : chemin relatif commençant par /
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;

  try {
    const parsed = new URL(trimmed, currentOrigin || 'https://example.com');
    // Exiger HTTPS pour les URLs absolues
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    // Même origine
    if (currentOrigin) {
      try {
        const originUrl = new URL(currentOrigin);
        if (host === originUrl.hostname.toLowerCase()) return true;
      } catch (_) { /* ignore */ }
    }
    // Liste blanche (ex: Stripe)
    return ALLOWED_REDIRECT_HOSTS.some(allowed => host === allowed || host.endsWith('.' + allowed));
  } catch (_) {
    return false;
  }
}

/**
 * Redirige vers l'URL uniquement si elle est considérée sûre.
 * @param {string} url - URL de destination
 * @param {'replace'|'assign'} [method='replace'] - replace ou assign
 * @returns {boolean} true si la redirection a été effectuée, false sinon
 */
export function safeRedirect(url, method = 'replace') {
  if (!isSafeUrl(url)) return false;
  if (method === 'replace' && typeof globalThis.location?.replace === 'function') {
    globalThis.location.replace(url);
    return true;
  }
  if (typeof globalThis.location?.assign === 'function') {
    globalThis.location.assign(url);
    return true;
  }
  return false;
}
