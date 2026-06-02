export interface LoginDto { email: string; password: string; }
export interface VerifyMfaDto { mfaToken: string; code: string; }
export interface RefreshDto { refreshToken: string; }
export interface LogoutDto { refreshToken: string; }
