const { Client } = require('pg');
require('dotenv').config({ path: 'config.env' });

async function showDatabaseContent() {
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
    console.log(`👤 User: ${process.env.DB_USERNAME || 'lasso_user'}`);
    console.log('=' .repeat(80));

    // Get table information
    const tableInfo = await client.query(`
      SELECT COUNT(*) as total_records 
      FROM request_logs
    `);
    
    console.log(`📋 Total records in request_logs: ${tableInfo.rows[0].total_records}`);
    console.log('');

    if (tableInfo.rows[0].total_records > 0) {
      // Get all records with the actual schema
      const result = await client.query(`
        SELECT 
          id,
          timestamp,
          action,
          "anonymizedPayload",
          "responseTime",
          "errorMessage",
          provider,
          endpoint
        FROM request_logs 
        ORDER BY timestamp DESC
        LIMIT 50
      `);

      console.log('📝 Recent Request Logs (showing up to 50 most recent):');
      console.log('=' .repeat(80));

      result.rows.forEach((row, index) => {
        console.log(`\n🔍 Record #${index + 1} (ID: ${row.id})`);
        console.log(`   📅 Timestamp: ${row.timestamp}`);
        console.log(`   🚀 Action: ${row.action}`);
        console.log(`   🤖 Provider: ${row.provider}`);
        console.log(`   🌐 Endpoint: ${row.endpoint || 'N/A'}`);
        console.log(`   ⏱️  Response Time: ${row.responseTime || 'N/A'}ms`);
        if (row.errorMessage) {
          console.log(`   ❌ Error: ${row.errorMessage}`);
        }
        console.log(`   📝 Anonymized Payload: ${row.anonymizedPayload ? row.anonymizedPayload.substring(0, 150) + '...' : 'N/A'}`);
        console.log('─'.repeat(60));
      });

      // Show summary statistics
      const stats = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN "errorMessage" IS NOT NULL THEN 1 END) as error_count,
          COUNT(DISTINCT provider) as unique_providers,
          COUNT(DISTINCT action) as unique_actions,
          AVG("responseTime") as avg_response_time,
          MIN("responseTime") as min_response_time,
          MAX("responseTime") as max_response_time
        FROM request_logs
      `);

      const stat = stats.rows[0];
      console.log('\n📈 Database Statistics:');
      console.log('=' .repeat(40));
      console.log(`📊 Total Requests: ${stat.total}`);
      console.log(`❌ Error Responses: ${stat.error_count} (${((stat.error_count / stat.total) * 100).toFixed(1)}%)`);
      console.log(`🤖 Unique Providers: ${stat.unique_providers}`);
      console.log(`🚀 Unique Actions: ${stat.unique_actions}`);
      
      console.log(`⏱️  Avg Response Time: ${stat.avg_response_time !== null ? parseFloat(stat.avg_response_time).toFixed(2) : 'N/A'}ms`);
      console.log(`⚡ Min Response Time: ${stat.min_response_time !== null ? parseFloat(stat.min_response_time) : 'N/A'}ms`);
      console.log(`🐌 Max Response Time: ${stat.max_response_time !== null ? parseFloat(stat.max_response_time) : 'N/A'}ms`);

      // Show provider breakdown
      const providerStats = await client.query(`
        SELECT 
          provider,
          COUNT(*) as count,
          AVG("responseTime") as avg_time,
          COUNT(CASE WHEN "errorMessage" IS NOT NULL THEN 1 END) as errors
        FROM request_logs 
        GROUP BY provider 
        ORDER BY count DESC
      `);

      console.log('\n🤖 Provider Breakdown:');
      console.log('=' .repeat(40));
      providerStats.rows.forEach(row => {
        const errorRate = ((row.errors / row.count) * 100).toFixed(1);
        console.log(`   ${row.provider}: ${row.count} requests, ${row.avg_time !== null ? parseFloat(row.avg_time).toFixed(0) : 'N/A'}ms avg, ${errorRate}% errors`);
      });

      // Show action breakdown
      const actionStats = await client.query(`
        SELECT 
          action,
          COUNT(*) as count
        FROM request_logs 
        GROUP BY action 
        ORDER BY count DESC
      `);

      console.log('\n🚀 Action Breakdown:');
      console.log('=' .repeat(40));
      actionStats.rows.forEach(row => {
        console.log(`   ${row.action}: ${row.count} requests`);
      });

    } else {
      console.log('📭 No records found in the request_logs table.');
      console.log('💡 Try making some requests through the proxy to see data here!');
    }

  } catch (error) {
    console.error('❌ Error connecting to database:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure PostgreSQL is running');
    console.log('2. Check your database credentials in config.env');
    console.log('3. Ensure the database and user exist');
    console.log('4. Run the setup script: node scripts/setup-database.js');
  } finally {
    if (client) {
      await client.end();
    }
  }
}

showDatabaseContent();
