#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

async function resetDatabase() {
  // First, connect to postgres database to drop/recreate the target database
  const adminClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'lasso_user',
    password: process.env.DB_PASSWORD || 'lasso_password',
    database: 'postgres', // Connect to default postgres database
  });

  const targetDatabase = process.env.DB_DATABASE || 'lasso_proxy';

  try {
    console.log('🔌 Connecting to PostgreSQL as admin...');
    await adminClient.connect();
    console.log('✅ Connected to postgres database successfully');

    // Terminate all connections to the target database
    console.log(`🔒 Terminating all connections to database: ${targetDatabase}`);
    await adminClient.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [targetDatabase]);

    // Drop the database if it exists
    console.log(`🗑️  Dropping database: ${targetDatabase}`);
    await adminClient.query(`DROP DATABASE IF EXISTS ${targetDatabase}`);
    console.log(`✅ Database ${targetDatabase} dropped successfully`);

    // Create the database
    console.log(`🏗️  Creating database: ${targetDatabase}`);
    await adminClient.query(`CREATE DATABASE ${targetDatabase}`);
    console.log(`✅ Database ${targetDatabase} created successfully`);

  } catch (error) {
    console.error('❌ Database reset failed:', error.message);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // Now connect to the newly created database and run migrations
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'lasso_user',
    password: process.env.DB_PASSWORD || 'lasso_password',
    database: targetDatabase,
  });

  try {
    console.log(`🔌 Connecting to newly created database: ${targetDatabase}`);
    await client.connect();
    console.log('✅ Connected to target database successfully');

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

    // Verify the table was created
    console.log('🔍 Verifying table structure...');
    const tableResult = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'request_logs' 
      ORDER BY ordinal_position
    `);
    
    if (tableResult.rows.length > 0) {
      console.log('✅ request_logs table structure verified:');
      tableResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('⚠️  request_logs table not found');
    }

    console.log('🎉 Database reset completed successfully!');
    console.log(`📊 Database ${targetDatabase} is ready for use`);

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Add command line argument support
const args = process.argv.slice(2);
const command = args[0];

if (command === '--help' || command === '-h') {
  console.log(`
Database Reset Script

Usage: node scripts/reset-database.js [options]

Options:
  --help, -h     Show this help message
  --confirm      Skip confirmation prompt (useful for automation)

This script will:
1. Drop the existing database (if it exists)
2. Create a new database with the same name
3. Run all migration files in order
4. Verify the setup

⚠️  WARNING: This will permanently delete all data in the database!
`);
  process.exit(0);
}

if (command !== '--confirm') {
  console.log('⚠️  WARNING: This will permanently delete all data in the database!');
  console.log('Press Ctrl+C to cancel or run with --confirm to skip this prompt');
  
  // Wait for user confirmation (5 seconds timeout)
  const timeout = setTimeout(() => {
    console.log('⏰ Timeout reached, proceeding with database reset...');
    resetDatabase();
  }, 5000);

  // Listen for Ctrl+C
  process.on('SIGINT', () => {
    clearTimeout(timeout);
    console.log('\n❌ Database reset cancelled');
    process.exit(0);
  });
} else {
  resetDatabase();
}
