-- Local DEV seed. Run as the superuser/owner (RLS bypassed for seeding).
-- Creates: demo tenant + company, chart of accounts, a VAT code, a counterparty,
-- and a real login user (email: demo@demo.bg / password: Demo1234!).
-- Idempotent: ON CONFLICT DO NOTHING / UPSERT on the credential.

-- ---- tenants & companies ----
INSERT INTO tenants(id,name) VALUES
 ('11111111-1111-1111-1111-111111111111','Demo Tenant A'),
 ('22222222-2222-2222-2222-222222222222','Isolation Tenant B') ON CONFLICT DO NOTHING;

INSERT INTO companies(id,tenant_id,name,eik,vat_status,base_currency) VALUES
 ('c1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Акме Демо ООД','203912837','registered','EUR'),
 ('c2222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','Бета ЕООД',NULL,'none','EUR') ON CONFLICT DO NOTHING;

-- ---- chart of accounts (Bulgarian national chart subset) ----
INSERT INTO accounts(id,tenant_id,company_id,code,name,type,normal_balance) VALUES
 ('a0000000-0000-0000-0000-000000000602','11111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','602','External Services','expense','debit'),
 ('a0000000-0000-0000-0000-000000004531','11111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','4531','VAT input','asset','debit'),
 ('a0000000-0000-0000-0000-000000000401','11111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','401','Suppliers','liability','credit'),
 ('a0000000-0000-0000-0000-000000000702','11111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','702','Revenue','revenue','credit'),
 ('a0000000-0000-0000-0000-000000004532','11111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','4532','VAT output','liability','credit'),
 ('a0000000-0000-0000-0000-000000000411','11111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','411','Customers','asset','debit'),
 ('a0000000-0000-0000-0000-000000000503','11111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','503','Разплащателна сметка','asset','debit') ON CONFLICT DO NOTHING;

INSERT INTO vat_codes(id,tenant_id,company_id,code,description,kind,rate,direction) VALUES
 ('11111111-aaaa-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','STD20','Standard 20%','standard',20,'both') ON CONFLICT DO NOTHING;

INSERT INTO counterparties(id,tenant_id,company_id,kind,name) VALUES
 ('cccccccc-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','customer','Бета ЕООД') ON CONFLICT DO NOTHING;

-- VAT-registered company settings so input/output VAT is recognised (registers + deductible VAT)
INSERT INTO company_settings(tenant_id,company_id,vat_registered,vat_number,default_currency) VALUES
 ('11111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111',true,'BG203912837','EUR')
ON CONFLICT (tenant_id,company_id) DO UPDATE SET vat_registered=true;

-- ---- demo login user (argon2id hash of "Demo1234!") ----
INSERT INTO users(id,tenant_id,email,status,password_hash,password_algo,mfa_enabled) VALUES
 ('eeeeeeee-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','demo@demo.bg','active',
  '$argon2id$v=19$m=65536,t=3,p=4$8u5197NG06YH1mQ+4QAc4A$+yIY7SBOaLcuvsd11BvqSax2pPcFMRNqt7YVvW/PlP4','argon2id',false)
ON CONFLICT (tenant_id,email) DO UPDATE SET password_hash=EXCLUDED.password_hash, status='active', mfa_enabled=false;

-- ---- tenant-admin membership + company owner assignment ----
INSERT INTO memberships(tenant_id,user_id,role) VALUES
 ('11111111-1111-1111-1111-111111111111','eeeeeeee-1111-1111-1111-111111111111','tenant_admin') ON CONFLICT DO NOTHING;

INSERT INTO company_assignments(tenant_id,user_id,company_id,role) VALUES
 ('11111111-1111-1111-1111-111111111111','eeeeeeee-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','owner') ON CONFLICT DO NOTHING;
