# Database Reset Guide

Guide for dropping and recreating the Lasso Proxy database.

## ⚠️ Warning

**This operation will permanently delete all data in the database!** Make sure to backup any important data before proceeding.

## 🚀 Quick Reset

### Using npm script (recommended)
```bash
npm run db:reset
```

### Using the script directly
```bash
node scripts/reset-database.js --confirm
```

## 🔧 Platform-Specific Scripts

### Windows (PowerShell)
```powershell
./scripts/reset-database.ps1
```

### Windows (Command Prompt)
```cmd
./scripts/reset-database.bat
```

### Unix/Linux/macOS
```bash
./scripts/reset-database.sh
```

## 📋 What the Reset Does

1. **Connects to PostgreSQL** as an admin user
2. **Terminates all connections** to the target database
3. **Drops the existing database** (if it exists)
4. **Creates a new database** with the same name
5. **Runs all migration files** in order
6. **Verifies the setup** by checking table structure
7. **Tests the connection** to ensure everything works

## 🛠️ Manual Reset Process

If you prefer to do it manually:

1. **Connect to PostgreSQL:**
   ```sql
   psql -h localhost -U lasso_user -d postgres
   ```

2. **Terminate connections:**
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = 'lasso_proxy' AND pid <> pg_backend_pid();
   ```

3. **Drop and recreate:**
   ```sql
   DROP DATABASE IF EXISTS lasso_proxy;
   CREATE DATABASE lasso_proxy;
   ```

4. **Run migrations:**
   ```bash
   npm run db:setup
   ```

## 🧪 Testing the Reset

Run the database reset test to verify everything works:

```bash
npm run test:db:reset
```

This test will:
1. Connect to the database
2. Insert test data
3. Run the reset script
4. Verify the database is empty after reset

## 🔍 Troubleshooting

### Permission Errors
If you get permission errors, make sure your database user has the necessary privileges:

```sql
-- Grant privileges to your user
GRANT ALL PRIVILEGES ON DATABASE lasso_proxy TO lasso_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lasso_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lasso_user;
```

### Connection Issues
If the database is in use, the script will automatically terminate connections. If this fails:

1. Stop the Lasso Proxy application
2. Stop any other applications using the database
3. Try the reset again

### Migration Errors
If migrations fail, check that:
1. All migration files are present in `src/database/migrations/`
2. Migration files are properly formatted SQL
3. The database user has CREATE privileges

## 🌐 WebSocket Reset

You can also reset the database from the real-time dashboard by sending a WebSocket message:

```javascript
// Connect to the dashboard WebSocket
const socket = io('http://localhost:3000');

// Request database reset
socket.emit('reset-database');

// Listen for response
socket.on('database-reset-response', (response) => {
  if (response.success) {
    console.log('Database reset successful:', response.message);
  } else {
    console.error('Database reset failed:', response.message);
  }
});
```

## ⚙️ Environment Variables

The reset script uses these environment variables from your `.env` file:

- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_USERNAME` - Database username (default: lasso_user)
- `DB_PASSWORD` - Database password (default: lasso_password)
- `DB_DATABASE` - Database name (default: lasso_proxy)

## 🔄 Recovery

If something goes wrong during the reset:

1. **Check the logs** for error messages
2. **Verify database connection** with `npm run db:setup`
3. **Restore from backup** if you have one
4. **Recreate manually** using the manual process above

## 🤖 Automation

For CI/CD pipelines, you can use the `--confirm` flag to skip the confirmation prompt:

```bash
node scripts/reset-database.js --confirm
```

This is useful for automated testing and deployment scripts.
