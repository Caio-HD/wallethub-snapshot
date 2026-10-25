-- Mock data de desenvolvimento (Ultra-Realista / Multi-usuário / 6 meses).
-- Requer base.sql aplicado (organizações Rick workspace / Nya workspace).

DO $$
DECLARE
  r_id UUID;
  n_id UUID;
  r_org_id UUID;
  n_org_id UUID;
  r_nub_id UUID; r_int_id UUID;
  n_ita_id UUID; n_xp_id UUID;

  r_cat_sal UUID; r_cat_div UUID; r_cat_ali UUID; r_cat_mor UUID;
  r_cat_laz UUID; r_cat_sau UUID; r_cat_edu UUID; r_cat_tra UUID;
  r_cat_com UUID; r_cat_via UUID; r_cat_pet UUID; r_cat_ser UUID;

  n_cat_sal UUID; n_cat_div UUID; n_cat_ali UUID; n_cat_mor UUID;
  n_cat_laz UUID; n_cat_sau UUID; n_cat_edu UUID; n_cat_tra UUID;
  n_cat_com UUID; n_cat_via UUID; n_cat_ser UUID;

  wege3_id UUID; petr4_id UUID; knri11_id UUID;
  aapl_id UUID; ivv_id UUID; hglg11_id UUID; vale3_id UUID;

  i INT; j INT;
  m_date DATE;
  m_str TEXT;
  d_at TIMESTAMP;
  v_amt DECIMAL;
BEGIN
  SELECT id INTO r_id FROM users WHERE username = 'rick';
  SELECT id INTO n_id FROM users WHERE username = 'nya';

  IF r_id IS NULL OR n_id IS NULL THEN
    RAISE EXCEPTION 'mock-dev: utilizadores rick/nya não encontrados (aplique ops/dev/seeds/base.sql primeiro)';
  END IF;

  SELECT m.organization_id INTO r_org_id
  FROM organization_memberships m
  WHERE m.user_id = r_id AND m.status = 'active' AND m.deleted_at IS NULL
  ORDER BY m.created_at ASC LIMIT 1;

  SELECT m.organization_id INTO n_org_id
  FROM organization_memberships m
  WHERE m.user_id = n_id AND m.status = 'active' AND m.deleted_at IS NULL
  ORDER BY m.created_at ASC LIMIT 1;

  IF r_org_id IS NULL OR n_org_id IS NULL THEN
    RAISE EXCEPTION 'mock-dev: memberships/org em falta (base.sql com organizations?)';
  END IF;

  INSERT INTO categories (id, name, type, sort_order, created_by_id, organization_id, is_active, created_at, updated_at)
  VALUES (uuid_generate_v4(), 'Dividendos', 'income'::category_type_enum, 25, r_id, r_org_id, true, NOW(), NOW())
  ON CONFLICT (organization_id, name) WHERE deleted_at IS NULL DO NOTHING;

  INSERT INTO categories (id, name, type, sort_order, created_by_id, organization_id, is_active, created_at, updated_at)
  VALUES (uuid_generate_v4(), 'Dividendos', 'income'::category_type_enum, 25, n_id, n_org_id, true, NOW(), NOW())
  ON CONFLICT (organization_id, name) WHERE deleted_at IS NULL DO NOTHING;

  INSERT INTO accounts (id, name, organization_id, owner_user_ids, is_active, created_at, updated_at)
  VALUES
    (uuid_generate_v4(), 'Rick Nubank (Principal)', r_org_id, ARRAY[r_id]::uuid[], true, NOW(), NOW()),
    (uuid_generate_v4(), 'Rick Inter (Invest)', r_org_id, ARRAY[r_id]::uuid[], true, NOW(), NOW()),
    (uuid_generate_v4(), 'Nya Itaú', n_org_id, ARRAY[n_id]::uuid[], true, NOW(), NOW()),
    (uuid_generate_v4(), 'Nya XP', n_org_id, ARRAY[n_id]::uuid[], true, NOW(), NOW())
  ON CONFLICT (organization_id, name) WHERE deleted_at IS NULL DO UPDATE SET
    owner_user_ids = EXCLUDED.owner_user_ids,
    is_active = true,
    updated_at = NOW();

  SELECT id INTO r_nub_id FROM accounts WHERE organization_id = r_org_id AND name = 'Rick Nubank (Principal)' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_int_id FROM accounts WHERE organization_id = r_org_id AND name = 'Rick Inter (Invest)' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_ita_id FROM accounts WHERE organization_id = n_org_id AND name = 'Nya Itaú' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_xp_id FROM accounts WHERE organization_id = n_org_id AND name = 'Nya XP' AND deleted_at IS NULL LIMIT 1;

  INSERT INTO categories (id, name, type, sort_order, created_by_id, organization_id, is_active, created_at, updated_at)
  VALUES
    (uuid_generate_v4(), 'Viagens', 'expense'::category_type_enum, 100, r_id, r_org_id, true, NOW(), NOW()),
    (uuid_generate_v4(), 'Pet', 'expense'::category_type_enum, 110, r_id, r_org_id, true, NOW(), NOW()),
    (uuid_generate_v4(), 'Serviços/Assinaturas', 'expense'::category_type_enum, 120, r_id, r_org_id, true, NOW(), NOW()),
    (uuid_generate_v4(), 'Viagens', 'expense'::category_type_enum, 100, n_id, n_org_id, true, NOW(), NOW()),
    (uuid_generate_v4(), 'Pet', 'expense'::category_type_enum, 110, n_id, n_org_id, true, NOW(), NOW()),
    (uuid_generate_v4(), 'Serviços/Assinaturas', 'expense'::category_type_enum, 120, n_id, n_org_id, true, NOW(), NOW())
  ON CONFLICT (organization_id, name) WHERE deleted_at IS NULL DO NOTHING;

  SELECT id INTO r_cat_sal FROM categories WHERE organization_id = r_org_id AND name = 'Salário' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_cat_div FROM categories WHERE organization_id = r_org_id AND name = 'Dividendos' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_cat_ali FROM categories WHERE organization_id = r_org_id AND name = 'Alimentação' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_cat_mor FROM categories WHERE organization_id = r_org_id AND name = 'Moradia' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_cat_laz FROM categories WHERE organization_id = r_org_id AND name = 'Lazer' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_cat_sau FROM categories WHERE organization_id = r_org_id AND name = 'Saúde' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_cat_edu FROM categories WHERE organization_id = r_org_id AND name = 'Educação' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_cat_tra FROM categories WHERE organization_id = r_org_id AND name = 'Transporte' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_cat_via FROM categories WHERE organization_id = r_org_id AND name = 'Viagens' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_cat_pet FROM categories WHERE organization_id = r_org_id AND name = 'Pet' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_cat_ser FROM categories WHERE organization_id = r_org_id AND name = 'Serviços/Assinaturas' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO r_cat_com FROM categories WHERE organization_id = r_org_id AND name = 'Compras' AND deleted_at IS NULL LIMIT 1;

  SELECT id INTO n_cat_sal FROM categories WHERE organization_id = n_org_id AND name = 'Salário' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_cat_div FROM categories WHERE organization_id = n_org_id AND name = 'Dividendos' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_cat_ali FROM categories WHERE organization_id = n_org_id AND name = 'Alimentação' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_cat_mor FROM categories WHERE organization_id = n_org_id AND name = 'Moradia' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_cat_laz FROM categories WHERE organization_id = n_org_id AND name = 'Lazer' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_cat_sau FROM categories WHERE organization_id = n_org_id AND name = 'Saúde' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_cat_edu FROM categories WHERE organization_id = n_org_id AND name = 'Educação' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_cat_tra FROM categories WHERE organization_id = n_org_id AND name = 'Transporte' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_cat_via FROM categories WHERE organization_id = n_org_id AND name = 'Viagens' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_cat_ser FROM categories WHERE organization_id = n_org_id AND name = 'Serviços/Assinaturas' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO n_cat_com FROM categories WHERE organization_id = n_org_id AND name = 'Compras' AND deleted_at IS NULL LIMIT 1;

  INSERT INTO investment_instruments (id, symbol, market, kind, currency, display_name, quote_symbol, created_at, updated_at)
  VALUES
    (uuid_generate_v4(), 'WEGE3', 'BR', 'stock', 'BRL', 'Weg S.A.', 'WEGE3.SA', NOW(), NOW()),
    (uuid_generate_v4(), 'PETR4', 'BR', 'stock', 'BRL', 'Petrobras PN', 'PETR4.SA', NOW(), NOW()),
    (uuid_generate_v4(), 'KNRI11', 'BR', 'fii', 'BRL', 'Kinea Renda Imob.', 'KNRI11.SA', NOW(), NOW()),
    (uuid_generate_v4(), 'VALE3', 'BR', 'stock', 'BRL', 'Vale S.A.', 'VALE3.SA', NOW(), NOW()),
    (uuid_generate_v4(), 'HGLG11', 'BR', 'fii', 'BRL', 'CGHG Logística', 'HGLG11.SA', NOW(), NOW()),
    (uuid_generate_v4(), 'AAPL', 'INTL', 'stock', 'USD', 'Apple Inc.', 'aapl.us', NOW(), NOW()),
    (uuid_generate_v4(), 'IVV', 'INTL', 'etf', 'USD', 'iShares Core S&P 500', 'ivv.us', NOW(), NOW())
  ON CONFLICT (symbol, market) WHERE deleted_at IS NULL DO NOTHING;

  SELECT id INTO wege3_id FROM investment_instruments WHERE symbol = 'WEGE3' LIMIT 1;
  SELECT id INTO petr4_id FROM investment_instruments WHERE symbol = 'PETR4' LIMIT 1;
  SELECT id INTO knri11_id FROM investment_instruments WHERE symbol = 'KNRI11' LIMIT 1;
  SELECT id INTO vale3_id FROM investment_instruments WHERE symbol = 'VALE3' LIMIT 1;
  SELECT id INTO hglg11_id FROM investment_instruments WHERE symbol = 'HGLG11' LIMIT 1;
  SELECT id INTO aapl_id FROM investment_instruments WHERE symbol = 'AAPL' LIMIT 1;
  SELECT id INTO ivv_id FROM investment_instruments WHERE symbol = 'IVV' LIMIT 1;

  DELETE FROM transactions WHERE user_id IN (r_id, n_id);
  DELETE FROM investment_movements WHERE user_id IN (r_id, n_id);

  FOR i IN -1..5 LOOP
    m_date := (CURRENT_DATE - (i || ' month')::INTERVAL);
    m_str := TO_CHAR(m_date, 'YYYY-MM');

    INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id, created_at, updated_at)
    VALUES (uuid_generate_v4(), 'Salário Rick ' || m_str, 8500.00, 'income', (m_str || '-05 09:00:00')::TIMESTAMP, r_cat_sal, r_nub_id, r_id, r_org_id, NOW(), NOW());

    FOR j IN 1..50 LOOP
      d_at := (m_date - (random()*28 || ' days')::INTERVAL)::TIMESTAMP;
      CASE (j % 8)
        WHEN 0 THEN INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
                    VALUES (uuid_generate_v4(), 'Restaurante Rick ' || j, 40+random()*120, 'expense', d_at, r_cat_ali, r_nub_id, r_id, r_org_id);
        WHEN 1 THEN INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
                    VALUES (uuid_generate_v4(), 'Uber/Combustível Rick ' || j, 15+random()*60, 'expense', d_at, r_cat_tra, r_nub_id, r_id, r_org_id);
        WHEN 2 THEN INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
                    VALUES (uuid_generate_v4(), 'Petshop/Vet Rick ' || j, 80+random()*200, 'expense', d_at, r_cat_pet, r_nub_id, r_id, r_org_id);
        WHEN 3 THEN INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
                    VALUES (uuid_generate_v4(), 'Assinatura AWS/Digital ' || j, 30+random()*150, 'expense', d_at, r_cat_ser, r_nub_id, r_id, r_org_id);
        WHEN 4 THEN INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
                    VALUES (uuid_generate_v4(), 'Supermercado Rick ' || j, 150+random()*400, 'expense', d_at, r_cat_ali, r_nub_id, r_id, r_org_id);
        WHEN 5 THEN INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
                    VALUES (uuid_generate_v4(), 'Pharmacy Rick ' || j, 20+random()*100, 'expense', d_at, r_cat_sau, r_nub_id, r_id, r_org_id);
        WHEN 6 THEN INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
                    VALUES (uuid_generate_v4(), 'Aluguel Rick ' || m_str, 2800.00, 'expense', (m_str || '-10 10:00:00')::TIMESTAMP, r_cat_mor, r_nub_id, r_id, r_org_id);
        ELSE INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
             VALUES (uuid_generate_v4(), 'Lazer/Hobby Rick ' || j, 100+random()*200, 'expense', d_at, r_cat_laz, r_nub_id, r_id, r_org_id);
      END CASE;
    END LOOP;

    v_amt := 1000 + random()*2000;
    INSERT INTO investment_movements (id, organization_id, instrument_id, user_id, kind, quantity, unit_price, occurred_at)
    VALUES (uuid_generate_v4(), r_org_id, ivv_id, r_id, 'buy', v_amt/480, 480.00, (m_str || '-15')::DATE);
    INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
    VALUES (uuid_generate_v4(), 'Aporte IVV ' || m_str, v_amt, 'expense', (m_str || '-15 11:00:00')::TIMESTAMP, r_cat_ser, r_int_id, r_id, r_org_id);

    IF (i % 2 = 0) OR (i < 0) THEN
      v_amt := 80 + random()*120;
      INSERT INTO investment_movements (id, organization_id, instrument_id, user_id, kind, quantity, unit_price, occurred_at)
      VALUES (uuid_generate_v4(), r_org_id, knri11_id, r_id, 'dividend', 100, v_amt/100, (m_str || '-18')::DATE);
      INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
      VALUES (uuid_generate_v4(), 'Dividendos KNRI11 ' || m_str, v_amt, 'income', (m_str || '-18 10:00:00')::TIMESTAMP, r_cat_div, r_int_id, r_id, r_org_id);

      v_amt := 50 + random()*70;
      INSERT INTO investment_movements (id, organization_id, instrument_id, user_id, kind, quantity, unit_price, occurred_at)
      VALUES (uuid_generate_v4(), r_org_id, hglg11_id, r_id, 'dividend', 50, v_amt/50, (m_str || '-20')::DATE);
      INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
      VALUES (uuid_generate_v4(), 'Dividendos HGLG11 ' || m_str, v_amt, 'income', (m_str || '-20 10:00:00')::TIMESTAMP, r_cat_div, r_int_id, r_id, r_org_id);
    END IF;

    INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id, created_at, updated_at)
    VALUES (uuid_generate_v4(), 'Salário Nya ' || m_str, 13000.00, 'income', (m_str || '-01 09:00:00')::TIMESTAMP, n_cat_sal, n_ita_id, n_id, n_org_id, NOW(), NOW());

    FOR j IN 1..40 LOOP
      d_at := (m_date - (random()*28 || ' days')::INTERVAL)::TIMESTAMP;
      CASE (j % 5)
        WHEN 0 THEN INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
                    VALUES (uuid_generate_v4(), 'Supermercado Nya ' || j, 200+random()*600, 'expense', d_at, n_cat_ali, n_ita_id, n_id, n_org_id);
        WHEN 1 THEN INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
                    VALUES (uuid_generate_v4(), 'Saúde/Pharmacy Nya ' || j, 50+random()*300, 'expense', d_at, n_cat_sau, n_ita_id, n_id, n_org_id);
        WHEN 2 THEN INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
                    VALUES (uuid_generate_v4(), 'Viagem/Hotel Nya ' || j, 500+random()*2000, 'expense', d_at, n_cat_via, n_xp_id, n_id, n_org_id);
        WHEN 3 THEN INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
                    VALUES (uuid_generate_v4(), 'Parceria/Educação Nya ' || j, 300+random()*800, 'expense', d_at, n_cat_edu, n_ita_id, n_id, n_org_id);
        ELSE INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
             VALUES (uuid_generate_v4(), 'Compras/Lifestyle Nya ' || j, 100+random()*500, 'expense', d_at, n_cat_com, n_ita_id, n_id, n_org_id);
      END CASE;
    END LOOP;

    v_amt := 200 + random()*300;
    INSERT INTO investment_movements (id, organization_id, instrument_id, user_id, kind, quantity, unit_price, occurred_at)
    VALUES (uuid_generate_v4(), n_org_id, aapl_id, n_id, 'buy', v_amt/185, 185.00, (m_str || '-10')::DATE);
    INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
    VALUES (uuid_generate_v4(), 'Stock Buy AAPL ' || m_str, v_amt*5.1, 'expense', (m_str || '-10 14:00:00')::TIMESTAMP, n_cat_ser, n_xp_id, n_id, n_org_id);

    INSERT INTO investment_movements (id, organization_id, instrument_id, user_id, kind, quantity, unit_price, occurred_at)
    VALUES (uuid_generate_v4(), n_org_id, vale3_id, n_id, 'buy', 20, 65+random()*10, (m_str || '-22')::DATE);

    IF i = 2 THEN
      INSERT INTO investment_movements (id, organization_id, instrument_id, user_id, kind, quantity, unit_price, occurred_at)
      VALUES (uuid_generate_v4(), n_org_id, petr4_id, n_id, 'sell', 200, 39.50, (m_str || '-25')::DATE);
      INSERT INTO transactions (id, description, amount, direction, occurred_at, category_id, account_id, user_id, organization_id)
      VALUES (uuid_generate_v4(), 'Venda Parcial PETR4 200x', 7900.00, 'income', (m_str || '-25 15:00:00')::TIMESTAMP, n_cat_div, n_xp_id, n_id, n_org_id);
    END IF;

  END LOOP;

  RAISE NOTICE 'mock-dev: histórico multi-tenant gerado.';
END $$;
