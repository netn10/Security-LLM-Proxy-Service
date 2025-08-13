const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

describe('Database Tests', () => {
  let client;

  beforeAll(async () => {
    client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USERNAME || 'lasso_user',
      password: process.env.DB_PASSWORD || 'lasso_password',
      database: process.env.DB_DATABASE || 'lasso_proxy',
    });
    await client.connect();
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  describe('Connection Tests', () => {
    test('should connect to PostgreSQL database', async () => {
      const result = await client.query('SELECT NOW() as current_time');
      expect(result.rows[0].current_time).toBeDefined();
      expect(result.rows[0].current_time).toBeInstanceOf(Date);
    });

    test('should have correct database name', async () => {
      const result = await client.query('SELECT current_database() as db_name');
      expect(result.rows[0].db_name).toBe(process.env.DB_DATABASE || 'lasso_proxy');
    });

    test('should have correct user permissions', async () => {
      const result = await client.query('SELECT current_user as user_name');
      expect(result.rows[0].user_name).toBe(process.env.DB_USERNAME || 'lasso_user');
    });
  });

  describe('Table Structure Tests', () => {
    test('should have request_logs table', async () => {
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'request_logs'
      `);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].table_name).toBe('request_logs');
    });

    test('should have correct columns in request_logs table', async () => {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'request_logs' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      const expectedColumns = [
        { name: 'id', type: 'integer' },
        { name: 'timestamp', type: 'timestamp without time zone' },
        { name: 'method', type: 'character varying' },
        { name: 'url', type: 'text' },
        { name: 'status_code', type: 'integer' },
        { name: 'response_time', type: 'integer' },
        { name: 'ip_address', type: 'character varying' },
        { name: 'user_agent', type: 'text' },
        { name: 'request_body', type: 'text' },
        { name: 'response_body', type: 'text' },
        { name: 'sanitized', type: 'boolean' },
        { name: 'blocked', type: 'boolean' },
        { name: 'block_reason', type: 'character varying' },
        { name: 'created_at', type: 'timestamp without time zone' },
        { name: 'updated_at', type: 'timestamp without time zone' }
      ];

      expect(result.rows.length).toBe(expectedColumns.length);
      
      result.rows.forEach((row, index) => {
        expect(row.column_name).toBe(expectedColumns[index].name);
        expect(row.data_type).toBe(expectedColumns[index].type);
      });
    });

    test('should have required indexes', async () => {
      const result = await client.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'request_logs'
      `);
      
      const indexNames = result.rows.map(row => row.indexname);
      expect(indexNames).toContain('idx_request_logs_timestamp');
      expect(indexNames).toContain('idx_request_logs_ip_address');
      expect(indexNames).toContain('idx_request_logs_status_code');
      expect(indexNames).toContain('idx_request_logs_blocked');
    });
  });

  describe('Data Insertion Tests', () => {
    beforeEach(async () => {
      await client.query('DELETE FROM request_logs');
    });

    test('should insert request log data', async () => {
      const testData = {
        method: 'POST',
        url: '/openai/chat/completions',
        status_code: 200,
        response_time: 1500,
        ip_address: '192.168.1.1',
        user_agent: 'Test Agent',
        request_body: '{"test": "data"}',
        response_body: '{"response": "success"}',
        sanitized: true,
        blocked: false,
        block_reason: null
      };

      const result = await client.query(`
        INSERT INTO request_logs 
        (method, url, status_code, response_time, ip_address, user_agent, request_body, response_body, sanitized, blocked, block_reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, timestamp, created_at, updated_at
      `, [
        testData.method, testData.url, testData.status_code, testData.response_time,
        testData.ip_address, testData.user_agent, testData.request_body, testData.response_body,
        testData.sanitized, testData.blocked, testData.block_reason
      ]);

      expect(result.rows[0].id).toBeDefined();
      expect(result.rows[0].timestamp).toBeDefined();
      expect(result.rows[0].created_at).toBeDefined();
      expect(result.rows[0].updated_at).toBeDefined();
    });

    test('should auto-update updated_at on record update', async () => {
      // Insert a record
      const insertResult = await client.query(`
        INSERT INTO request_logs 
        (method, url, status_code, response_time, ip_address, user_agent, request_body, response_body, sanitized, blocked)
        VALUES ('GET', '/test', 200, 100, '127.0.0.1', 'Test', '{}', '{}', false, false)
        RETURNING id, created_at, updated_at
      `);

      const originalUpdatedAt = insertResult.rows[0].updated_at;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update the record
      await client.query(`
        UPDATE request_logs 
        SET status_code = 404 
        WHERE id = $1
      `, [insertResult.rows[0].id]);

      // Check that updated_at was changed
      const updatedResult = await client.query(`
        SELECT updated_at FROM request_logs WHERE id = $1
      `, [insertResult.rows[0].id]);

      expect(updatedResult.rows[0].updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Query Performance Tests', () => {
    beforeEach(async () => {
      // Insert test data
      const testData = [];
      for (let i = 0; i < 100; i++) {
        testData.push([
          'POST',
          `/openai/chat/completions`,
          200,
          Math.floor(Math.random() * 5000),
          `192.168.1.${i % 255}`,
          'Test Agent',
          JSON.stringify({ test: i }),
          JSON.stringify({ response: i }),
          i % 2 === 0,
          i % 3 === 0,
          i % 3 === 0 ? 'test_reason' : null
        ]);
      }

      for (const data of testData) {
        await client.query(`
          INSERT INTO request_logs 
          (method, url, status_code, response_time, ip_address, user_agent, request_body, response_body, sanitized, blocked, block_reason)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, data);
      }
    });

    test('should query by timestamp efficiently', async () => {
      const startTime = Date.now();
      const result = await client.query(`
        SELECT * FROM request_logs 
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        ORDER BY timestamp DESC
        LIMIT 10
      `);
      const endTime = Date.now();
      
      expect(result.rows.length).toBeLessThanOrEqual(10);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast with index
    });

    test('should query by IP address efficiently', async () => {
      const startTime = Date.now();
      const result = await client.query(`
        SELECT * FROM request_logs 
        WHERE ip_address = '192.168.1.1'
        ORDER BY timestamp DESC
      `);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should be fast with index
    });

    test('should query blocked requests efficiently', async () => {
      const startTime = Date.now();
      const result = await client.query(`
        SELECT COUNT(*) as blocked_count 
        FROM request_logs 
        WHERE blocked = true
      `);
      const endTime = Date.now();
      
      expect(result.rows[0].blocked_count).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast with index
    });
  });

  describe('Migration Tests', () => {
    test('should have migration files', () => {
      const migrationsDir = path.join(__dirname, '../src/database/migrations');
      expect(fs.existsSync(migrationsDir)).toBe(true);
      
      const migrationFiles = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql'));
      expect(migrationFiles.length).toBeGreaterThan(0);
    });

    test('should have valid SQL in migration files', () => {
      const migrationsDir = path.join(__dirname, '../src/database/migrations');
      const migrationFiles = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql'));
      
      for (const file of migrationFiles) {
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Basic SQL validation
        expect(migrationSQL).toContain('CREATE TABLE');
        expect(migrationSQL).toContain('request_logs');
        expect(migrationSQL).toContain('PRIMARY KEY');
      }
    });
  });
});
