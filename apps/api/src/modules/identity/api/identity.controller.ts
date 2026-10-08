import { Body, Controller, Delete, Get, Inject, Put } from '@nestjs/common';
import { IDENTITY_SERVICE, type IIdentityService } from '../application/identity.service.interface';

interface SetAvatarDto { dataUrl: string }

/** Identity edge — the authenticated user's own profile + avatar (tenant/user-scoped). */
@Controller('identity')
export class IdentityController {
  constructor(@Inject(IDENTITY_SERVICE) private readonly identity: IIdentityService) {}

  /** Current user profile (email + avatar). */
  @Get('me')
  me() {
    return this.identity.getMe();
  }

  /** Set/replace the profile picture (validated image data URL). */
  @Put('avatar')
  setAvatar(@Body() dto: SetAvatarDto) {
    return this.identity.setAvatar(dto?.dataUrl ?? '');
  }

  /** Remove the profile picture. */
  @Delete('avatar')
  removeAvatar() {
    return this.identity.removeAvatar();
  }
}
