'use client';
/**
 * Frontend data layer. Screens call fetch('/api/...') unchanged. Installs ONE of:
 *  - REAL: rewrite '/api/*' → `${NEXT_PUBLIC_API_URL}/*` with credentials (secure cookies),
 *  - MOCK: canned data for the standalone static preview.
 */
import { installMockApi } from './mock-api';

let installed = false;

/** Pure selection rule (unit-tested): real when an API URL is set and mock isn't forced. */
export function selectApiMode(apiUrl: string | undefined, useMock: string | undefined): 'real' | 'mock' {
  return apiUrl && useMock !== 'true' ? 'real' : 'mock';
}

function installRealApi(baseUrl: string): void {
  const original = window.fetch.bind(window);
  const base = baseUrl.replace(/\/$/, '');
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith('/api/')) {
      url = base + url.slice(4);
      const headers = new Headers(init?.headers);
      if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');
      return original(url, { ...init, headers, credentials: 'include', mode: 'cors' });
    }
    return original(input as RequestInfo, init);
  };
}

export function installApiLayer(): { mode: 'real' | 'mock'; apiUrl?: string } {
  if (installed || typeof window === 'undefined') return { mode: 'mock' };
  installed = true;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const mode = selectApiMode(apiUrl, process.env.NEXT_PUBLIC_USE_MOCK);
  if (mode === 'real' && apiUrl) { installRealApi(apiUrl); return { mode: 'real', apiUrl }; }
  installMockApi();
  return { mode: 'mock' };
}
