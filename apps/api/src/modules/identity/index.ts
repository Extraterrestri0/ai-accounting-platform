export { IdentityModule } from './identity.module';
export * from './application'; // IIdentityService + IDENTITY_SERVICE + IAuthService + AUTH_SERVICE
export * from './events';
export { RequirePermission } from './api/require-permission.decorator';
export { PERMISSIONS, resolveEffectivePermissions } from './domain/roles';
export type { Permission, TenantRole, CompanyRole } from './domain/roles';
