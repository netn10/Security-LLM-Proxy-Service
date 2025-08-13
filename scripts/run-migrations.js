const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('No DATABASE_URL found, skipping migrations');
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // Read and execute the migration file
    const migrationPath = path.join(__dirname, '..', 'src', 'database', 'migrations', '001-create-request-logs.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running database migrations...');
    await client.query(migrationSQL);
    console.log('Database migrations completed successfully');

  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations().catch(console.error);
