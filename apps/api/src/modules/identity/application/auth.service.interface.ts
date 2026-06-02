import type { ApplicationService } from '../../../shared-kernel';

export interface LoginResult {
  status: 'authenticated' | 'mfa_required';
  accessToken?: string;
  refreshToken?: string;
  mfaToken?: string;     // short-lived token identifying the half-authenticated session
}

export interface IAuthService extends ApplicationService {
  login(email: string, password: string): Promise<LoginResult>;
  verifyMfa(mfaToken: string, code: string): Promise<LoginResult>;
  refresh(refreshToken: string): Promise<LoginResult>;
  logout(refreshToken: string): Promise<void>;
}
export const AUTH_SERVICE = Symbol('Auth.Service');
