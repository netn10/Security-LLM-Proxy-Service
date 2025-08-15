#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config({ path: 'config.env' });

function quoteIdentifier(identifier) {
  return '"' + String(identifier).replace(/"/g, '""') + '"';
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: null, schemaOnly: false, tables: null, batchSize: 1000 };
  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      const n = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(n) && n >= 0) opts.limit = n;
    } else if (arg === '--schema-only') {
      opts.schemaOnly = true;
    } else if (arg.startsWith('--tables=')) {
      const list = arg.split('=')[1];
      if (list) opts.tables = list.split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--batch-size=')) {
      const n = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(n) && n > 0) opts.batchSize = n;
    }
  }
  return opts;
}

async function dumpDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USERNAME || 'lasso_user',
    password: process.env.DB_PASSWORD || 'lasso_password',
    database: process.env.DB_DATABASE || 'lasso_proxy',
  });

  const { limit, schemaOnly, tables: tablesFilter, batchSize } = parseArgs();

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    console.log(`📊 Database: ${process.env.DB_DATABASE || 'lasso_proxy'}`);
    console.log('='.repeat(80));

    // List tables in public schema
    const tablesRes = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );

    let tableNames = tablesRes.rows.map(r => r.table_name);
    if (tablesFilter && tablesFilter.length > 0) {
      const filterSet = new Set(tablesFilter.map(t => t.toLowerCase()));
      tableNames = tableNames.filter(t => filterSet.has(t.toLowerCase()));
    }

    if (tableNames.length === 0) {
      console.log('📭 No tables found in public schema');
      return;
    }

    for (const tableName of tableNames) {
      console.log(`\n🧱 Table: ${tableName}`);
      console.log('-'.repeat(80));

      // Columns
      const colsRes = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tableName]
      );

      if (colsRes.rows.length === 0) {
        console.log('   (no columns)');
      } else {
        console.log('   Columns:');
        for (const col of colsRes.rows) {
          const nullability = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const def = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          console.log(`   - ${col.column_name} (${col.data_type}) ${nullability}${def}`);
        }
      }

      // Row count
      const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(tableName)}`);
      const totalRows = countRes.rows[0].count;
      console.log(`\n   Rows: ${totalRows}`);

      if (schemaOnly || totalRows === 0) {
        continue;
      }

      // Choose ordering: prefer time-ish columns, then PK, then first column
      const availableColumnNames = colsRes.rows.map(c => c.column_name);
      const preferredOrderCandidates = ['timestamp', 'created_at', 'createdAt', 'updated_at', 'updatedAt', 'ts', 'time', 'id'];
      let orderColumns = preferredOrderCandidates.filter(c => availableColumnNames.includes(c));

      if (orderColumns.length === 0) {
        const pkRes = await client.query(
          `SELECT a.attname AS column_name
           FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
           WHERE i.indrelid = $1::regclass AND i.indisprimary`,
          [`public.${tableName}`]
        );
        orderColumns = pkRes.rows.map(r => r.column_name);
      }

      if (orderColumns.length === 0 && availableColumnNames.length > 0) {
        orderColumns = [availableColumnNames[0]];
      }

      const orderByClause = orderColumns.length > 0
        ? ' ORDER BY ' + orderColumns.map(c => `${quoteIdentifier(c)} DESC`).join(', ')
        : '';

      // Dump rows in batches
      console.log('   Data:');
      const maxToFetch = limit === null ? totalRows : Math.min(limit, totalRows);
      let fetched = 0;
      let offset = 0;
      const effectiveBatch = Math.max(1, Math.min(batchSize, maxToFetch || batchSize));

      while (fetched < (maxToFetch || Infinity)) {
        const remaining = (maxToFetch || Infinity) - fetched;
        const take = Math.min(effectiveBatch, remaining);
        if (!Number.isFinite(take) || take <= 0) break;

        const rowsRes = await client.query(
          `SELECT * FROM ${quoteIdentifier(tableName)}${orderByClause} OFFSET $1 LIMIT $2`,
          [offset, take]
        );

        if (rowsRes.rows.length === 0) break;

        for (const row of rowsRes.rows) {
          console.log('   - ' + JSON.stringify(row));
        }

        fetched += rowsRes.rows.length;
        offset += rowsRes.rows.length;

        if (rowsRes.rows.length < take) break; // No more rows
      }
    }

    console.log('\n✅ Dump complete');
  } catch (err) {
    console.error('❌ Error dumping database:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

dumpDatabase();


