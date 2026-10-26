import { MigrationInterface, QueryRunner } from 'typeorm';

const TEST_ORG_CRITERIA = `
  -- padrão 1: membro com email de teste
  id IN (
    SELECT DISTINCT om.organization_id
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
    WHERE u.email ILIKE '%@wallethub.local'
       OR u.email ILIKE 'test@%'
       OR u.email ILIKE 'qa@%'
       OR u.email ILIKE 'dev@%'
       OR u.email ILIKE 'ci@%'
  )
  -- padrão 2: membro com nome/username suspeito
  OR id IN (
    SELECT DISTINCT om.organization_id
    FROM organization_memberships om
    JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
    WHERE u.name ILIKE '%test%'
       OR u.name ILIKE '%qa%'
       OR u.name ILIKE 'ci user'
       OR u.name ILIKE 'user test'
       OR u.name ILIKE 'test user'
       OR u.username ILIKE 'qa-%'
       OR u.username ILIKE 'test%'
       OR u.username ILIKE 'ci%'
  )
  -- padrão 3: nome da organização suspeito
  OR name ILIKE '%workspace%'
  OR (
    name = 'Casa'
    AND id NOT IN (
      SELECT DISTINCT organization_id
      FROM organization_memberships
      WHERE status = 'active' AND deleted_at IS NULL
    )
  )
  -- padrão 4: contas ou categorias com nomes genéricos numerados
  OR id IN (
    SELECT DISTINCT organization_id FROM accounts
    WHERE name ~* '^(income|outcome|icome|receita|despesa|conta)\\s*\\d+$'
      AND deleted_at IS NULL
  )
  OR id IN (
    SELECT DISTINCT organization_id FROM categories
    WHERE name ~* '^(income|outcome|icome|receita|despesa|categoria)\\s*\\d+$'
      AND deleted_at IS NULL
  )
`;

export class MarkTestOrganizationsAsQa1770000000012 implements MigrationInterface {
  name = 'MarkTestOrganizationsAsQa1770000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE organizations
      SET is_qa = true
      WHERE is_qa = false
        AND deleted_at IS NULL
        AND (${TEST_ORG_CRITERIA})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE organizations
      SET is_qa = false
      WHERE is_qa = true
        AND deleted_at IS NULL
        AND (${TEST_ORG_CRITERIA})
    `);
  }
}
