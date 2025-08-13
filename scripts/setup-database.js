#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

async function setupDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'lasso_user',
    password: process.env.DB_PASSWORD || 'lasso_password',
    database: process.env.DB_DATABASE || 'lasso_proxy',
  });

  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Read and execute migration files
    const migrationsDir = path.join(__dirname, '../src/database/migrations');
    
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      console.log(`📁 Found ${migrationFiles.length} migration files`);

      for (const file of migrationFiles) {
        console.log(`🔄 Running migration: ${file}`);
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await client.query(migrationSQL);
        console.log(`✅ Migration ${file} completed successfully`);
      }
    } else {
      console.log('⚠️  No migrations directory found, skipping migrations');
    }

    // Test the connection and basic queries
    console.log('🧪 Testing database connection...');
    const result = await client.query('SELECT NOW() as current_time');
    console.log(`✅ Database test successful: ${result.rows[0].current_time}`);

    console.log('🎉 Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the setup
setupDatabase();
