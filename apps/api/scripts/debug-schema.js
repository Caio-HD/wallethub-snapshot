const { Client } = require('pg');

async function checkSchema() {
  const client = new Client(process.env.DATABASE_URL || 'postgresql://wallethub:wallethub@postgres:5432/wallethub');
  await client.connect();
  
  try {
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('--- USERS TABLE COLUMNS ---');
    res.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} (Nullable: ${row.is_nullable})`);
    });
    
    const migrationsRes = await client.query('SELECT name FROM migrations ORDER BY id DESC LIMIT 5');
    console.log('\n--- LATEST MIGRATIONS ---');
    migrationsRes.rows.forEach(row => console.log(row.name));
    
  } catch (err) {
    console.error('Error checking schema:', err);
  } finally {
    await client.end();
  }
}

checkSchema();
