'use client';

/**
 * Real API client for the NestJS backend.
 * - access token: kept in memory + localStorage, sent as `Authorization: Bearer`.
 * - active company: sent as `X-Company-Id` (backend authorizes it per request).
 * - errors surface the backend envelope ({ statusCode, message }).
 */

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TOKEN_KEY = 'mgi.access';
const COMPANY_KEY = 'mgi.company';

let accessToken: string | null = null;

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

function readLS(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeLS(key: string, val: string | null): void {
  if (typeof window === 'undefined') return;
  try { val === null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, val); } catch { /* ignore */ }
}

export function getToken(): string | null {
  if (accessToken) return accessToken;
  accessToken = readLS(TOKEN_KEY);
  return accessToken;
}
export function setToken(token: string | null): void {
  accessToken = token;
  writeLS(TOKEN_KEY, token);
}
export function getActiveCompany(): string | null { return readLS(COMPANY_KEY); }
export function setActiveCompany(companyId: string | null): void { writeLS(COMPANY_KEY, companyId); }

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the active-company header (default true for company-scoped calls). */
  company?: boolean;
  /** Skip auth header (login). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, company = true, anonymous = false, signal } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!anonymous) {
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  if (company) {
    const c = getActiveCompany();
    if (c) headers['X-Company-Id'] = c;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    throw new ApiError(0, 'Не може да се установи връзка със сървъра.', e);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;

  if (!res.ok) {
    if (res.status === 401 && !anonymous) {
      setToken(null);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    const message = (data as { message?: string | string[] })?.message;
    const msg = Array.isArray(message) ? message.join(', ') : message ?? `Грешка ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

export const API_BASE = BASE;
