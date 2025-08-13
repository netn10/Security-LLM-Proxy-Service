const { Client } = require('pg');
require('dotenv').config({ path: 'config.env' });

async function checkSchema() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'lasso_user',
    password: process.env.DB_PASSWORD || 'lasso_password',
    database: process.env.DB_DATABASE || 'lasso_proxy',
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    console.log(`📊 Database: ${process.env.DB_DATABASE || 'lasso_proxy'}`);
    console.log('=' .repeat(80));

    // Check what tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Tables in database:');
    tables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    console.log('');

    // Check request_logs table structure
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'request_logs' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('📝 request_logs table structure:');
    console.log('=' .repeat(50));
    columns.rows.forEach(row => {
      console.log(`   ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('');

    // Get sample data
    const sampleData = await client.query(`
      SELECT * FROM request_logs LIMIT 3
    `);
    
    if (sampleData.rows.length > 0) {
      console.log('📄 Sample data (first 3 records):');
      console.log('=' .repeat(50));
      sampleData.rows.forEach((row, index) => {
        console.log(`\n🔍 Record #${index + 1}:`);
        Object.keys(row).forEach(key => {
          const value = row[key];
          const displayValue = typeof value === 'string' && value.length > 100 
            ? value.substring(0, 100) + '...' 
            : value;
          console.log(`   ${key}: ${displayValue}`);
        });
      });
    } else {
      console.log('📭 No data found in request_logs table');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

checkSchema();
