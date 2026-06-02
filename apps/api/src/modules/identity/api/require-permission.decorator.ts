import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../domain/roles';
export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (p: Permission) => SetMetadata(PERMISSION_KEY, p);
