const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { AuthService } = require('../dist/modules/auth/auth.service');

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  
  try {
    console.log('Testing validateIdentifier...');
    const result = await authService.validateIdentifier('tester_test@test.com');
    console.log('Result:', result);
  } catch (err) {
    console.error('FAILED:', err);
  } finally {
    await app.close();
  }
}

test();
