import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_SERVICE, type IAuthService } from '../application/auth.service.interface';
import type { LoginDto, VerifyMfaDto, RefreshDto, LogoutDto } from './dto/auth.dto';
import { setRefreshCookie, clearRefreshCookie, readRefreshCookie } from './secure-cookie';

/** Auth endpoints. The refresh token is also set as an HttpOnly/Secure/SameSite cookie. */
@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: IAuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    if (result.refreshToken) setRefreshCookie(res, result.refreshToken);
    return result;
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
