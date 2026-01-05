import api from '../services/api';

/**
 * Obtém a origem do backend a partir da configuração do axios
 */
export const getBackendOrigin = (): string => {
  const baseURL = (api as any)?.defaults?.baseURL;
  if (typeof baseURL === 'string' && baseURL.startsWith('http')) {
    try {
      return new URL(baseURL).origin;
    } catch {
      return window.location.origin;
    }
  }
  return window.location.origin;
};

/**
 * Resolve URLs relativas para URLs absolutas do backend
 */
export const resolveAssetUrl = (url: string): string => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Em produção, geralmente o backend está acessível via /api (proxy do Nginx).
  // Então /static/* deve ser resolvido como /api/static/* para funcionar no browser.
  if (url.startsWith('/api/')) return `${getBackendOrigin()}${url}`;
  if (url.startsWith('/static/')) return `${getBackendOrigin()}/api${url}`;
  if (url.startsWith('/')) return `${getBackendOrigin()}${url}`;
  if (url.startsWith('static/')) return `${getBackendOrigin()}/${url}`;
  if (url.includes('static/client-logos/') && !url.startsWith('/')) {
    return `${getBackendOrigin()}/${url}`;
  }
  return url;
};

/**
 * Adiciona cache-buster (timestamp) à URL
 */
export const withCacheBust = (url: string): string => {
  if (!url) return url;
  const hasQuery = url.includes('?');
  const sep = hasQuery ? '&' : '?';
  return `${url}${sep}t=${Date.now()}`;
};

/**
 * Remove cache-buster da URL
 */
export const stripCacheBust = (url: string): string => {
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.delete('t');
    return u.toString();
  } catch {
    return url.replace(/([?&])t=\d+(&?)/g, (_, p1, p2) => (p2 ? p1 : '')).replace(/[?&]$/g, '');
  }
};
