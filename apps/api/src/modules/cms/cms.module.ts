import { Module } from '@nestjs/common';
import { CmsRepository } from './infrastructure/cms.repository';
import { CmsPublicController } from './api/cms-public.controller';
import { CmsAdminController } from './api/cms-admin.controller';
import { SiteAdminGuard } from './api/site-admin.guard';

/**
 * CMS context — GLOBAL marketing content (blog, pricing plans, content blocks) and the
 * site-admin allowlist. Public read endpoints (/cms/*) + admin write endpoints
 * (/cms/admin/*) gated by SiteAdminGuard (platform login + cms_site_admins).
 * Content tables are non-tenant-scoped (no RLS) — see migration 0022 / ADR.
 */
@Module({
  controllers: [CmsPublicController, CmsAdminController],
  providers: [CmsRepository, SiteAdminGuard],
  exports: [CmsRepository],
})
export class CmsModule {}
