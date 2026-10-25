import * as bcrypt from 'bcrypt';
import { DEV_SEED_LOGIN_USERS } from '../../test/support/dev-seed-credentials';

describe('Credenciais da seed dev (base.sql)', () => {
  it.each([...DEV_SEED_LOGIN_USERS])(
    'password em texto plano corresponde ao bcrypt da seed ($username)',
    async ({ password, passwordHash }) => {
      await expect(bcrypt.compare(password, passwordHash)).resolves.toBe(true);
    },
  );
});
