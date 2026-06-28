-- =====================================================================
-- 0027 Expense Classification Engine (Task 1.2)
-- expense_categories (company-scoped reference: code, BG/EN name, default account,
-- default VAT treatment, SAF-T code) + classification columns on accounting_suggestions.
-- Seeds the 10 default Bulgarian micro-business categories for every company.
-- Builds on 0001-0026. Additive; existing suggestions are unaffected.
-- =====================================================================

CREATE TABLE expense_categories (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  company_id            uuid NOT NULL,
  code                  text NOT NULL,
  name_bg               text NOT NULL,
  name_en               text NOT NULL,
  default_account_id    uuid,
  default_vat_treatment text NOT NULL DEFAULT 'standard' CHECK (default_vat_treatment IN
                          ('standard','reduced','zero','exempt','reverse_charge','intra_community','export','import','none')),
  saft_code             text,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, code),
  UNIQUE (tenant_id, company_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id),
  FOREIGN KEY (tenant_id, company_id, default_account_id) REFERENCES accounts(tenant_id, company_id, id)
);
CREATE INDEX idx_expense_categories_active ON expense_categories (tenant_id, company_id, is_active);

GRANT SELECT, INSERT, UPDATE ON expense_categories TO app_user;  -- soft delete via is_active

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories FORCE  ROW LEVEL SECURITY;
CREATE POLICY expense_categories_isolation ON expense_categories
  USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
  WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());

-- ---- classification on the AI proposal -------------------------------------
ALTER TABLE accounting_suggestions
  ADD COLUMN IF NOT EXISTS expense_category_id       uuid REFERENCES expense_categories(id),
  ADD COLUMN IF NOT EXISTS classification_confidence numeric(4,3)
    CHECK (classification_confidence IS NULL OR (classification_confidence >= 0 AND classification_confidence <= 1)),
  ADD COLUMN IF NOT EXISTS classification_reason     text,
  ADD COLUMN IF NOT EXISTS classification_source     text
    CHECK (classification_source IS NULL OR classification_source IN ('rule','memory','ai','manual'));

-- ---- seed the 10 default Bulgarian micro-business categories per company ----
-- default_account → the company's '602 External Services' account where present (else NULL).
INSERT INTO expense_categories (tenant_id, company_id, code, name_bg, name_en, default_account_id, default_vat_treatment, saft_code)
SELECT co.tenant_id, co.id, v.code, v.name_bg, v.name_en, a.id, v.treatment, v.saft
FROM companies co
CROSS JOIN (VALUES
  ('FUEL',        'Гориво',                'Fuel',                'standard', 'EXP-FUEL'),
  ('TELECOM',     'Интернет и телеком',    'Internet / Telecom',  'standard', 'EXP-TELECOM'),
  ('OFFICE',      'Канцеларски материали', 'Office Supplies',     'standard', 'EXP-OFFICE'),
  ('ADVERTISING', 'Реклама',               'Advertising',         'standard', 'EXP-ADV'),
  ('RENT',        'Наем',                  'Rent',                'standard', 'EXP-RENT'),
  ('EXTSERV',     'Външни услуги',         'External Services',   'standard', 'EXP-EXT'),
  ('SAAS',        'Софтуер / SaaS',        'Software / SaaS',     'standard', 'EXP-SAAS'),
  ('TRAVEL',      'Пътувания',             'Travel',              'standard', 'EXP-TRAVEL'),
  ('BANKFEES',    'Банкови такси',         'Bank Fees',           'exempt',   'EXP-BANK'),
  ('OTHER',       'Други',                 'Other',               'standard', 'EXP-OTHER')
) AS v(code, name_bg, name_en, treatment, saft)
LEFT JOIN accounts a ON a.tenant_id = co.tenant_id AND a.company_id = co.id AND a.code = '602'
ON CONFLICT (tenant_id, company_id, code) DO NOTHING;
