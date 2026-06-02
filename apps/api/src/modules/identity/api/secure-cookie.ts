import type { Response, Request } from 'express';

/** Refresh token is delivered as an HttpOnly, Secure, SameSite cookie (defense-in-depth). */
const NAME = 'refresh_token';
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS ?? 30);

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',   // Secure in prod (HTTPS)
    sameSite: 'strict',                               // CSRF defense
    path: '/auth',                                    // only sent to auth endpoints
    maxAge: REFRESH_DAYS * 86_400_000,
  });
}
export function clearRefreshCookie(res: Response): void {
  res.clearCookie(NAME, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/auth' });
}
export function readRefreshCookie(req: Request, fallback?: string): string | undefined {
  return (req.cookies?.[NAME] as string | undefined) ?? fallback;
}
