// Importar reflect-metadata antes de qualquer outra coisa (necessário para TypeORM)
require('reflect-metadata');

const path = require('path');
const fs = require('fs');

// Função para encontrar e carregar typeorm em workspaces npm
// Em workspaces npm, os módulos podem estar no node_modules da raiz (hoisting)
// ou no node_modules local. O require.resolve() deve encontrar automaticamente.
function loadTypeorm() {
  // Primeira tentativa: usar require.resolve que segue a resolução padrão do Node.js
  // Isso funciona quando o script é executado via npm run, pois o npm configura
  // o module.paths corretamente para incluir node_modules da raiz do workspace
  try {
    const typeormPath = require.resolve('typeorm');
    const typeorm = require(typeormPath);
    return typeorm;
  } catch (resolveError) {
    // Se require.resolve falhar, tentar caminhos manuais
    const apiDir = path.join(__dirname, '..');
    const rootDir = path.join(__dirname, '..', '..', '..');
    
    // Lista de possíveis locais onde typeorm pode estar
    const possiblePaths = [
      path.join(apiDir, 'node_modules', 'typeorm'),
      path.join(rootDir, 'node_modules', 'typeorm'),
    ];
    
    // Tentar carregar de cada caminho possível
    for (const typeormPath of possiblePaths) {
      const packageJsonPath = path.join(typeormPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          return require(typeormPath);
        } catch (error) {
          // Continuar para o próximo caminho
          continue;
        }
      }
    }
    
    // Se tudo falhar, lançar erro informativo
    throw new Error(
      `typeorm não encontrado. Verifique se:\n` +
      `  1. typeorm está listado em dependencies no package.json da API\n` +
      `  2. As dependências foram instaladas: npm ci (na raiz do workspace)\n` +
      `  3. O workspace npm está configurado corretamente\n` +
      `\nCaminhos verificados:\n` +
      `  - ${possiblePaths[0]}\n` +
      `  - ${possiblePaths[1]}\n` +
      `\nErro do require.resolve: ${resolveError.message}`
    );
  }
}

// Carregar typeorm
let DataSource;
try {
  const typeormModule = loadTypeorm();
  DataSource = typeormModule.DataSource;
  if (!DataSource) {
    throw new Error('DataSource não encontrado no módulo typeorm');
  }
} catch (error) {
  console.error('❌ Erro ao carregar typeorm:', error.message);
  process.exit(1);
}

// Criar DataSource diretamente no script para evitar problemas de resolução de módulos
// em workspaces npm onde o typeorm pode estar no node_modules da raiz
const getDatabaseConfig = () => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    return {
      url: databaseUrl,
      type: 'postgres',
    };
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
  const username = process.env.DB_USER || 'wallethub';
  const password = process.env.DB_PASSWORD || 'wallethub';
  const database = process.env.DB_NAME || 'wallethub';
  const ssl = process.env.DB_SSL === 'true';

  return {
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    ssl: ssl
      ? {
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : false,
  };
};

// Caminho para dist (Nest/SWC: dist/database/..., não dist/src/...)
const distPath = path.join(__dirname, '..', 'dist');

const dataSource = new DataSource({
  ...getDatabaseConfig(),
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
  // Sem entidades: evita ciclos de import entre *.entity.js no dist; migrations são SQL-only.
  entities: [],
  migrations: [path.join(distPath, 'database', 'migrations', '*.js')],
  migrationsTableName: 'migrations',
});

async function runMigrations() {
  try {
    console.log('📦 Conectando ao banco de dados...');
    await dataSource.initialize();
    console.log('✅ Conectado ao banco de dados');

    console.log('🔄 Executando migrations...');
    // transaction: 'each' — cada migration roda na sua própria transação, em vez
    // de envolver todas numa só ('all', default). Necessário para migrations que
    // setam `transaction = false` (ex.: CREATE INDEX CONCURRENTLY), que o TypeORM
    // proíbe sob o modo global 'all' (ForbiddenTransactionModeOverrideError).
    const executed = await dataSource.runMigrations({ transaction: 'each' });

    if (executed.length === 0) {
      console.log('✅ Nenhuma migration pendente');
    } else {
      console.log(`✅ ${executed.length} migration(s) executada(s) com sucesso:`);
      executed.forEach((migration) => {
        console.log(`   - ${migration.name}`);
      });
    }

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migrations:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    
    // Tentar fechar a conexão mesmo em caso de erro
    if (dataSource.isInitialized) {
      try {
        await dataSource.destroy();
      } catch (destroyError) {
        // Ignora erro ao fechar conexão
      }
    }
    
    process.exit(1);
  }
}

runMigrations();

