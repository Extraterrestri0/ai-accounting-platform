import { BadRequestException, Body, ConflictException, Controller, Get, Inject, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_SERVICE, type IAuthService } from '../application/auth.service.interface';
import type { LoginDto, RegisterDto, VerifyMfaDto, RefreshDto, LogoutDto } from './dto/auth.dto';
import { setRefreshCookie, clearRefreshCookie, readRefreshCookie } from './secure-cookie';
import { GoogleOAuthService } from '../infrastructure/google-oauth.service';
import { EmailTakenError } from '../domain/errors';

const WEB_APP_URL = process.env.WEB_APP_URL ?? 'http://localhost:3001';

/** Auth endpoints. The refresh token is also set as an HttpOnly/Secure/SameSite cookie. */
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly auth: IAuthService,
    private readonly google: GoogleOAuthService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    if (result.refreshToken) setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    if (!dto?.email || !dto?.password || dto.password.length < 8) {
      throw new BadRequestException('Email and a password of at least 8 characters are required.');
    }
    try {
      const result = await this.auth.register(dto.email, dto.password, dto.companyName ?? 'My Company');
      if (result.refreshToken) setRefreshCookie(res, result.refreshToken);
      return result;
    } catch (e) {
      if (e instanceof EmailTakenError) throw new ConflictException(e.message);
      throw e;
    }
  }

  /** Public auth capabilities — lets the SPA show/disable the Google button gracefully. */
  @Get('config')
  config() {
    return { googleEnabled: this.google.isConfigured };
  }

  /** Begin Google OAuth — redirects the browser to Google's consent screen (or back to the SPA with a friendly error). */
  @Get('google')
  googleStart(@Res() res: Response) {
    if (!this.google.isConfigured) {
      // Never show raw JSON to a browser — bounce back to the login page with a friendly flag.
      return res.redirect(`${WEB_APP_URL}/login?error=google_not_configured`);
    }
    const state = Math.random().toString(36).slice(2); // CSRF state (dev); production persists/validates it
    return res.redirect(this.google.buildAuthUrl(state));
  }

  /** Google OAuth callback — exchanges the code, provisions/links the user, hands a token to the SPA. */
  @Get('google/callback')
  async googleCallback(@Query('code') code: string | undefined, @Query('error') error: string | undefined, @Res() res: Response) {
    if (error) return res.redirect(`${WEB_APP_URL}/login?error=${encodeURIComponent(error)}`);
    if (!code) return res.redirect(`${WEB_APP_URL}/login?error=missing_code`);
    try {
      const profile = await this.google.exchangeCode(code);
      const result = await this.auth.loginWithGoogle(profile.email, profile.name);
      if (result.refreshToken) setRefreshCookie(res, result.refreshToken);
      // Hand the access token to the SPA via the URL fragment (not sent to servers/logs).
      return res.redirect(`${WEB_APP_URL}/auth/callback#access=${encodeURIComponent(result.accessToken ?? '')}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'google_failed';
      return res.redirect(`${WEB_APP_URL}/login?error=${encodeURIComponent(msg)}`);
    }
  }

  @Post('mfa/verify')
  async verifyMfa(@Body() dto: VerifyMfaDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyMfa(dto.mfaToken, dto.code);
    if (result.refreshToken) setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = readRefreshCookie(req, dto.refreshToken); // cookie preferred, body fallback for API clients
    const result = await this.auth.refresh(token ?? '');
    if (result.refreshToken) setRefreshCookie(res, result.refreshToken); // rotation → new cookie
    return result;
  }

  @Post('logout')
  async logout(@Body() dto: LogoutDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readRefreshCookie(req, dto.refreshToken) ?? '');
    clearRefreshCookie(res);
  }
}
