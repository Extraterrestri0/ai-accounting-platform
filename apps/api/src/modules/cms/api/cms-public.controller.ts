import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CmsRepository } from '../infrastructure/cms.repository';

/**
 * PUBLIC read API for the marketing site (no auth). These routes are excluded from
 * the tenant-context middleware in AppModule (like /auth/config), since the marketing
 * pages fetch content anonymously.
 */
@Controller('cms')
export class CmsPublicController {
  constructor(private readonly repo: CmsRepository) {}

  @Get('posts')
  posts() { return this.repo.listPosts(false); }

  @Get('posts/:slug')
  async post(@Param('slug') slug: string) {
    const p = await this.repo.getPost(slug);
    if (!p || !p.published) throw new NotFoundException('Post not found');
    return p;
  }

  @Get('plans')
  plans() { return this.repo.listPlans(false); }

  @Get('content')
  content() { return this.repo.listContent(); }
}
