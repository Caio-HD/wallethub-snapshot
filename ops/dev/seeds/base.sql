-- Seed de desenvolvimento (dados de teste apenas).
-- Pré-requisito: migrations da API aplicadas (inclui organizations, organization_id nas tabelas).
-- Idempotente: INSERT ... WHERE NOT EXISTS / ON CONFLICT em users.

-- Hash bcrypt para senha "rickadmin" (10 rounds)
INSERT INTO users (id, email, username, name, phone_number, password_hash, role, is_active, created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'rick@wallethub.local',
  'rick',
  'Rick',
  '+5511988887777',
  '$2b$10$Q8ptUBolbMytBdOyQycgxuvKvzOgEivKChVr1/o7jvyysSY.3Zzhu',
  'super_admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  phone_number = EXCLUDED.phone_number,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Hash bcrypt para senha "nyadmin" (10 rounds)
INSERT INTO users (id, email, username, name, phone_number, password_hash, role, is_active, created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'nya@wallethub.local',
  'nya',
  'Nya',
  '+5511977776666',
  '$2b$10$1lcP1rRIM8Fh0GotjOaAsu28djcSN.K9mRGaigB1NmwDvaK853Rby',
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  phone_number = EXCLUDED.phone_number,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Uma organização por utilizador seed (multi-tenant)
INSERT INTO organizations (name, plan, created_at, updated_at)
SELECT 'Rick workspace', 'free'::organization_plan_enum, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM organization_memberships m
  INNER JOIN users u ON u.id = m.user_id AND u.username = 'rick' AND u.deleted_at IS NULL
  WHERE m.deleted_at IS NULL AND m.status = 'active'
);

INSERT INTO organizations (name, plan, created_at, updated_at)
SELECT 'Nya workspace', 'free'::organization_plan_enum, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM organization_memberships m
  INNER JOIN users u ON u.id = m.user_id AND u.username = 'nya' AND u.deleted_at IS NULL
  WHERE m.deleted_at IS NULL AND m.status = 'active'
);

INSERT INTO organization_memberships (organization_id, user_id, role, status, created_at, updated_at)
SELECT o.id, u.id, 'owner', 'active'::organization_membership_status_enum, NOW(), NOW()
FROM organizations o
INNER JOIN users u ON u.username = 'rick' AND u.deleted_at IS NULL
WHERE o.name = 'Rick workspace' AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.organization_id = o.id AND m.user_id = u.id AND m.deleted_at IS NULL
  );

INSERT INTO organization_memberships (organization_id, user_id, role, status, created_at, updated_at)
SELECT o.id, u.id, 'owner', 'active'::organization_membership_status_enum, NOW(), NOW()
FROM organizations o
INNER JOIN users u ON u.username = 'nya' AND u.deleted_at IS NULL
WHERE o.name = 'Nya workspace' AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.organization_id = o.id AND m.user_id = u.id AND m.deleted_at IS NULL
  );

-- Categorias padrão por organização seed
DO $$
DECLARE
  org RECORD;
  owner_id UUID;
BEGIN
  FOR org IN
    SELECT o.id AS org_id, o.name AS org_name
    FROM organizations o
    WHERE o.name IN ('Rick workspace', 'Nya workspace') AND o.deleted_at IS NULL
  LOOP
    SELECT m.user_id INTO owner_id
    FROM organization_memberships m
    WHERE m.organization_id = org.org_id AND m.role = 'owner' AND m.status = 'active' AND m.deleted_at IS NULL
    ORDER BY m.created_at ASC
    LIMIT 1;

    IF owner_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO categories (id, name, type, owner_user_id, organization_id, is_active, sort_order, created_by_id, created_at, updated_at)
    SELECT uuid_generate_v4(), v.name, v.type::category_type_enum, NULL, org.org_id, true, v.sort_order, owner_id, NOW(), NOW()
    FROM (VALUES
      ('Salário', 'income', 1),
      ('Freelance', 'income', 2),
      ('Investimentos', 'income', 3),
      ('Outras Receitas', 'income', 4),
      ('Alimentação', 'expense', 10),
      ('Transporte', 'expense', 20),
      ('Moradia', 'expense', 30),
      ('Saúde', 'expense', 40),
      ('Educação', 'expense', 50),
      ('Lazer', 'expense', 60),
      ('Compras', 'expense', 70),
      ('Contas', 'expense', 80),
      ('Outras Despesas', 'expense', 90)
    ) AS v(name, type, sort_order)
    WHERE NOT EXISTS (
      SELECT 1 FROM categories c WHERE c.organization_id = org.org_id AND c.name = v.name AND c.deleted_at IS NULL
    );
  END LOOP;
END $$;

INSERT INTO accounts (id, name, organization_id, owner_user_ids, is_active, created_at, updated_at)
SELECT uuid_generate_v4(), 'Carteira', o.id, NULL, true, NOW(), NOW()
FROM organizations o
WHERE o.name IN ('Rick workspace', 'Nya workspace') AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.organization_id = o.id AND a.name = 'Carteira' AND a.deleted_at IS NULL
  );

INSERT INTO settings (id, organization_id, key, value, scope_user_id, created_at, updated_at)
SELECT uuid_generate_v4(), o.id, 'currency', '{"symbol": "R$", "code": "BRL"}'::jsonb, NULL, NOW(), NOW()
FROM organizations o
WHERE o.name IN ('Rick workspace', 'Nya workspace') AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM settings s
    WHERE s.organization_id = o.id AND s.key = 'currency' AND s.scope_user_id IS NULL AND s.deleted_at IS NULL
  );

INSERT INTO settings (id, organization_id, key, value, scope_user_id, created_at, updated_at)
SELECT uuid_generate_v4(), o.id, 'date_format', '{"format": "dd/MM/yyyy"}'::jsonb, NULL, NOW(), NOW()
FROM organizations o
WHERE o.name IN ('Rick workspace', 'Nya workspace') AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM settings s
    WHERE s.organization_id = o.id AND s.key = 'date_format' AND s.scope_user_id IS NULL AND s.deleted_at IS NULL
  );
