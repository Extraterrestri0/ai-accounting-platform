import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../../platform';

export interface CmsPost {
  id: string; slug: string; title: string; category: string | null; excerpt: string | null;
  body: string | null; imageUrl: string | null; readMinutes: number | null; published: boolean; sort: number;
}
export interface CmsPlan {
  id: string; slug: string; name: string; tagline: string | null;
  priceMonthlyEur: number; priceYearlyEur: number; featured: boolean; sort: number; features: string[]; ctaHref: string | null; active: boolean;
}

/**
 * Data access for the GLOBAL CMS tables (cms_*). These tables are NOT tenant-scoped
 * and have no RLS, so we query the pool directly (no tenant context needed). Public
 * reads are open; writes are gated by SiteAdminGuard at the controller layer.
 */
@Injectable()
export class CmsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ---- site admins ----
  async isSiteAdmin(userId: string): Promise<boolean> {
    const r = await this.pool.query('SELECT 1 FROM cms_site_admins WHERE user_id = $1 AND active = true', [userId]);
    return r.rowCount! > 0;
  }
  async listAdmins(): Promise<Array<{ userId: string; email: string; role: string; active: boolean }>> {
    const r = await this.pool.query('SELECT user_id, email, role, active FROM cms_site_admins ORDER BY created_at');
    return r.rows.map((x: any) => ({ userId: x.user_id, email: x.email, role: x.role, active: x.active }));
  }
  /** Grant admin to an existing platform user (resolved by email). Returns false if no such user. */
  async addAdminByEmail(email: string, role: string): Promise<boolean> {
    const norm = email.trim().toLowerCase();
    const u = await this.pool.query<{ id: string }>('SELECT id FROM app.authenticate_lookup($1)', [norm]);
    if (!u.rows[0]) return false;
    await this.pool.query(
      `INSERT INTO cms_site_admins (user_id, email, role) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email, active = true`,
      [u.rows[0].id, norm, role],
    );
    return true;
  }
  async removeAdmin(userId: string): Promise<void> {
    await this.pool.query('DELETE FROM cms_site_admins WHERE user_id = $1', [userId]);
  }

  // ---- posts ----
  private mapPost = (x: any): CmsPost => ({
    id: x.id, slug: x.slug, title: x.title, category: x.category, excerpt: x.excerpt, body: x.body,
    imageUrl: x.image_url, readMinutes: x.read_minutes, published: x.published, sort: x.sort,
  });
  async listPosts(includeUnpublished = false): Promise<CmsPost[]> {
    const where = includeUnpublished ? '' : 'WHERE published = true';
    const r = await this.pool.query(`SELECT * FROM cms_posts ${where} ORDER BY sort, created_at DESC`);
    return r.rows.map(this.mapPost);
  }
  async getPost(slug: string): Promise<CmsPost | null> {
    const r = await this.pool.query('SELECT * FROM cms_posts WHERE slug = $1', [slug]);
    return r.rows[0] ? this.mapPost(r.rows[0]) : null;
  }
  async upsertPost(p: Partial<CmsPost> & { slug: string; title: string }): Promise<CmsPost> {
    if (p.id) {
      const r = await this.pool.query(
        `UPDATE cms_posts SET slug=$2, title=$3, category=$4, excerpt=$5, body=$6, image_url=$7,
            read_minutes=$8, published=$9, sort=$10, updated_at=now() WHERE id=$1 RETURNING *`,
        [p.id, p.slug, p.title, p.category ?? null, p.excerpt ?? null, p.body ?? null, p.imageUrl ?? null,
         p.readMinutes ?? null, p.published ?? true, p.sort ?? 0]);
      return this.mapPost(r.rows[0]);
    }
    const r = await this.pool.query(
      `INSERT INTO cms_posts (slug, title, category, excerpt, body, image_url, read_minutes, published, sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [p.slug, p.title, p.category ?? null, p.excerpt ?? null, p.body ?? null, p.imageUrl ?? null,
       p.readMinutes ?? null, p.published ?? true, p.sort ?? 0]);
    return this.mapPost(r.rows[0]);
  }
  async deletePost(id: string): Promise<void> { await this.pool.query('DELETE FROM cms_posts WHERE id = $1', [id]); }

  // ---- plans ----
  private mapPlan = (x: any): CmsPlan => ({
    id: x.id, slug: x.slug, name: x.name, tagline: x.tagline,
    priceMonthlyEur: Number(x.price_monthly_eur), priceYearlyEur: Number(x.price_yearly_eur),
    featured: x.featured, sort: x.sort, features: x.features ?? [], ctaHref: x.cta_href, active: x.active,
  });
  async listPlans(includeInactive = false): Promise<CmsPlan[]> {
    const where = includeInactive ? '' : 'WHERE active = true';
    const r = await this.pool.query(`SELECT * FROM cms_plans ${where} ORDER BY sort`);
    return r.rows.map(this.mapPlan);
  }
  async upsertPlan(p: Partial<CmsPlan> & { slug: string; name: string }): Promise<CmsPlan> {
    const features = JSON.stringify(p.features ?? []);
    if (p.id) {
      const r = await this.pool.query(
        `UPDATE cms_plans SET slug=$2, name=$3, tagline=$4, price_monthly_eur=$5, price_yearly_eur=$6,
            featured=$7, sort=$8, features=$9::jsonb, cta_href=$10, active=$11, updated_at=now() WHERE id=$1 RETURNING *`,
        [p.id, p.slug, p.name, p.tagline ?? null, p.priceMonthlyEur ?? 0, p.priceYearlyEur ?? 0,
         p.featured ?? false, p.sort ?? 0, features, p.ctaHref ?? null, p.active ?? true]);
      return this.mapPlan(r.rows[0]);
    }
    const r = await this.pool.query(
      `INSERT INTO cms_plans (slug, name, tagline, price_monthly_eur, price_yearly_eur, featured, sort, features, cta_href, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING *`,
      [p.slug, p.name, p.tagline ?? null, p.priceMonthlyEur ?? 0, p.priceYearlyEur ?? 0,
       p.featured ?? false, p.sort ?? 0, features, p.ctaHref ?? null, p.active ?? true]);
    return this.mapPlan(r.rows[0]);
  }
  async deletePlan(id: string): Promise<void> { await this.pool.query('DELETE FROM cms_plans WHERE id = $1', [id]); }

  // ---- content blocks ----
  async listContent(): Promise<Record<string, unknown>> {
    const r = await this.pool.query('SELECT key, value FROM cms_content');
    const out: Record<string, unknown> = {};
    for (const row of r.rows) out[(row as any).key] = (row as any).value;
    return out;
  }
  async setContent(key: string, value: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO cms_content (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, JSON.stringify(value ?? {})]);
  }
}
