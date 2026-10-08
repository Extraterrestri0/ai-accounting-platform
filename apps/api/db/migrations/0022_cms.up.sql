-- =====================================================================
-- 0022 CMS — GLOBAL marketing content + site-admin allowlist.
-- DELIBERATE exception to "every table is tenant-scoped": marketing content is
-- site-wide (one blog, one pricing table, one set of pages), edited by site admins,
-- read publicly. So these tables are NOT tenant-scoped and have NO RLS. app_user
-- gets direct CRUD grants. Admin authorization is enforced in the app layer via the
-- cms_site_admins allowlist (which platform user may manage the site). See ADR.
-- =====================================================================

-- Free-form content blocks (hero text, etc.) keyed by name.
CREATE TABLE IF NOT EXISTS cms_content (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pricing plans.
CREATE TABLE IF NOT EXISTS cms_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  name              text NOT NULL,
  tagline           text,
  price_monthly_eur numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly_eur  numeric(10,2) NOT NULL DEFAULT 0,
  featured          boolean NOT NULL DEFAULT false,
  sort              int NOT NULL DEFAULT 0,
  features          jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_href          text,
  active            boolean NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Blog posts.
CREATE TABLE IF NOT EXISTS cms_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  title         text NOT NULL,
  category      text,
  excerpt       text,
  body          text,
  image_url     text,
  read_minutes  int,
  published     boolean NOT NULL DEFAULT true,
  sort          int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Which platform users may administer the site (by user_id; email kept for display).
CREATE TABLE IF NOT EXISTS cms_site_admins (
  user_id    uuid PRIMARY KEY,
  email      text NOT NULL,
  role       text NOT NULL DEFAULT 'admin',   -- 'owner' | 'admin' | 'editor'
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON cms_content, cms_plans, cms_posts, cms_site_admins TO app_user;

-- First site admin = demo@demo.bg (the agreed default). Seed runs as the owner role.
INSERT INTO cms_site_admins (user_id, email, role)
  SELECT id, email, 'owner' FROM users WHERE lower(email) = 'demo@demo.bg'
  ON CONFLICT (user_id) DO NOTHING;

-- Seed plans from the current static pricing.
INSERT INTO cms_plans (slug, name, tagline, price_monthly_eur, price_yearly_eur, featured, sort, features, cta_href) VALUES
  ('starter','Starter','За самонаети и малки фирми.',9,7,false,1,'["1 фирма","До 50 документа/мес.","AI извличане от документи","Издаване на фактури","ДДС дневници","Поддръжка по имейл"]'::jsonb,'/register?plan=starter'),
  ('business','Business','За растящи фирми с повече документи.',19,15,true,2,'["До 3 фирми","До 300 документа/мес.","AI извличане от документи","Издаване на фактури","Отчети (ОВ, ОПР, баланс)","Опашка за преглед и одобрение","Приоритетна поддръжка"]'::jsonb,'/register?plan=business'),
  ('premium','Premium','За екипи с няколко дружества.',39,31,false,3,'["До 10 фирми","До 1000 документа/мес.","Всичко от Business","Защитен архив (WORM)","Няколко потребители","Помощ при стартиране"]'::jsonb,'/register?plan=premium'),
  ('firm','Счетоводна къща','За кантори с много клиенти.',79,63,false,4,'["Неограничено клиенти","Индивидуален обем","Всичко от Premium","Работни пространства за клиенти","Отделен мениджър","API достъп (скоро)"]'::jsonb,'/contact')
  ON CONFLICT (slug) DO NOTHING;

-- Seed blog posts from the current blog section.
INSERT INTO cms_posts (slug, title, category, excerpt, image_url, read_minutes, sort) VALUES
  ('dds-za-nachinaeshti','ДДС за начинаещи: как да подадете първата си справка-декларация без грешки','ДДС','Какво влиза в дневниците покупки и продажби, как се пълни декларацията и кои са най-честите грешки при подаване.','/landing/assets/img/blog-1.jpg',8,1),
  ('neizmenyaema-glavna-kniga','Неизменяема главна книга: защо сторното е по-добро от изтриването','Счетоводство','','/landing/assets/img/blog-2.jpg',5,2),
  ('5-priznaka-avtomatizaciya','5 признака, че е време да автоматизирате счетоводството си','Бизнес растеж','','/landing/assets/img/blog-3.jpg',6,3),
  ('danachen-kalendar-2026','Данъчен календар 2026: ключовите срокове за всеки собственик','Данъци','','/landing/assets/img/blog-4.jpg',7,4),
  ('prehod-kam-evro','Преходът към евро: какво да очаквате след 8 август 2026','Съответствие','','/landing/assets/img/blog-5.jpg',4,5)
  ON CONFLICT (slug) DO NOTHING;

INSERT INTO cms_content (key, value) VALUES
  ('hero', '{"title":"Счетоводство, опростено. Без счетоводител.","subtitle":"MGI-Delta автоматизира фактурите, ДДС, разходите и отчетите. AI разчита документите, а вие само одобрявате.","cta":"Започнете безплатно"}'::jsonb)
  ON CONFLICT (key) DO NOTHING;
