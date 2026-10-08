import { Injectable } from '@nestjs/common';

/**
 * Google OAuth 2.0 (Authorization Code flow).
 * Config from env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.
 * When unconfigured, `isConfigured` is false and the controller returns a clear 503.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  private readonly redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/auth/google/callback';

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** Build the consent-screen URL to redirect the browser to. */
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      include_granted_scopes: 'true',
      prompt: 'select_account',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** Exchange the authorization code for tokens, then fetch the verified profile. */
  async exchangeCode(code: string): Promise<{ email: string; name: string; emailVerified: boolean }> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error(`Google token exchange failed (${tokenRes.status})`);
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error('Google did not return an access token');

    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoRes.ok) throw new Error(`Google userinfo failed (${infoRes.status})`);
    const info = (await infoRes.json()) as { email?: string; name?: string; email_verified?: boolean };
    if (!info.email) throw new Error('Google profile has no email');
    return { email: info.email, name: info.name ?? info.email.split('@')[0], emailVerified: info.email_verified ?? false };
  }
}
