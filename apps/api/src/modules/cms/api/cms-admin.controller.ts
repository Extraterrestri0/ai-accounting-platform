import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { TenantContextService } from '../../../platform';
import { CmsRepository } from '../infrastructure/cms.repository';
import { SiteAdminGuard } from './site-admin.guard';

/**
 * ADMIN API — all routes require a logged-in platform user who is in cms_site_admins.
 * Auth uses the SAME platform login (Authorization: Bearer access-token); the
 * SiteAdminGuard checks the allowlist. Persists to the global CMS tables → changes
 * go live for all visitors.
 */
@Controller('cms/admin')
@UseGuards(SiteAdminGuard)
export class CmsAdminController {
  constructor(
    private readonly repo: CmsRepository,
    private readonly ctx: TenantContextService,
  ) {}

  /** Probe used by the admin UI to confirm the logged-in user may manage the site. */
  @Get('me')
  me() { return { admin: true, userId: this.ctx.currentOrThrow().userId }; }

  // ---- blog posts ----
  @Get('posts') posts() { return this.repo.listPosts(true); }
  @Post('posts') createPost(@Body() b: any) {
    if (!b?.slug || !b?.title) throw new BadRequestException('slug and title are required');
    return this.repo.upsertPost(b);
  }
  @Put('posts/:id') updatePost(@Param('id') id: string, @Body() b: any) {
    if (!b?.slug || !b?.title) throw new BadRequestException('slug and title are required');
    return this.repo.upsertPost({ ...b, id });
  }
  @Delete('posts/:id') deletePost(@Param('id') id: string) { return this.repo.deletePost(id); }

  // ---- pricing plans ----
  @Get('plans') plans() { return this.repo.listPlans(true); }
  @Post('plans') createPlan(@Body() b: any) {
    if (!b?.slug || !b?.name) throw new BadRequestException('slug and name are required');
    return this.repo.upsertPlan(b);
  }
  @Put('plans/:id') updatePlan(@Param('id') id: string, @Body() b: any) {
    if (!b?.slug || !b?.name) throw new BadRequestException('slug and name are required');
    return this.repo.upsertPlan({ ...b, id });
  }
  @Delete('plans/:id') deletePlan(@Param('id') id: string) { return this.repo.deletePlan(id); }

  // ---- content blocks ----
  @Get('content') content() { return this.repo.listContent(); }
  @Put('content/:key') setContent(@Param('key') key: string, @Body() b: any) {
    return this.repo.setContent(key, b?.value ?? b);
  }

  // ---- site admins (manage who can log in to the admin) ----
  @Get('admins') admins() { return this.repo.listAdmins(); }
  @Post('admins') async addAdmin(@Body() b: any) {
    if (!b?.email) throw new BadRequestException('email is required');
    const ok = await this.repo.addAdminByEmail(b.email, b.role || 'admin');
    if (!ok) throw new BadRequestException('Няма потребител с този имейл. Първо създайте акаунт (регистрация).');
    return { ok: true };
  }
  @Delete('admins/:userId') removeAdmin(@Param('userId') userId: string) {
    if (userId === this.ctx.currentOrThrow().userId) throw new BadRequestException('Не можете да премахнете собствения си достъп.');
    return this.repo.removeAdmin(userId);
  }
}
