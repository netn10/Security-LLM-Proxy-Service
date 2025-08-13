# Lasso Proxy Deployment Guide

This guide covers deployment of the Lasso Proxy service in both development and production environments.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Production Deployment](#production-deployment)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [Monitoring & Health Checks](#monitoring--health-checks)
6. [Troubleshooting](#troubleshooting)

## Development Setup

### Prerequisites

- Node.js 18+ 
- Docker & Docker Compose
- PostgreSQL (via Docker)

### Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd lasso-proxy
   npm install
   ```

2. **Start PostgreSQL database:**
   ```bash
   npm run docker:up
   ```

3. **Setup database and run migrations:**
   ```bash
   npm run db:setup
   ```

4. **Configure environment:**
   ```bash
   cp config.env .env
   # Edit .env with your API keys
   ```

5. **Start development server:**
   ```bash
   npm run start:dev
   ```

   **Or use the combined command:**
   ```bash
   npm run start:with-db
   ```

### Development Commands

```bash
# Start database
npm run docker:up

# Stop database
npm run docker:down

# Setup database
npm run db:setup

# Run migrations
npm run db:migrate

# Run tests
npm test

# Run database tests
npm run test:db

# Run complete test suite
npm run test:complete

# Build for production
npm run build

# Start production server
npm run start:prod
```

## Production Deployment

### Prerequisites

- Node.js 18+ on production server
- PostgreSQL database (managed or self-hosted)
- Reverse proxy (nginx, Apache, etc.)
- SSL certificates
- Process manager (PM2, systemd, etc.)

### Step-by-Step Deployment

1. **Prepare the server:**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PostgreSQL client
   sudo apt-get install -y postgresql-client
   ```

2. **Clone the application:**
   ```bash
   git clone <repository-url>
   cd lasso-proxy
   npm install --production
   npm run build
   ```

3. **Configure production environment:**
   ```bash
   cp config.production.env .env
   # Edit .env with production values
   ```

4. **Setup production database:**
   ```bash
   # Connect to your production PostgreSQL instance
   npm run db:setup
   ```

5. **Setup process manager (PM2):**
   ```bash
   # Install PM2 globally
   sudo npm install -g pm2
   
   # Create PM2 ecosystem file
   cat > ecosystem.config.js << EOF
   module.exports = {
     apps: [{
       name: 'lasso-proxy',
       script: 'dist/main.js',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       },
       env_file: '.env',
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_file: './logs/combined.log',
       time: true,
       max_memory_restart: '1G',
       restart_delay: 4000,
       max_restarts: 10
     }]
   };
   EOF
   
   # Create logs directory
   mkdir -p logs
   
   # Start the application
   pm2 start ecosystem.config.js
   
   # Save PM2 configuration
   pm2 save
   
   # Setup PM2 to start on boot
   pm2 startup
   ```

6. **Setup reverse proxy (nginx):**
   ```bash
   # Install nginx
   sudo apt-get install -y nginx
   
   # Create nginx configuration
   sudo tee /etc/nginx/sites-available/lasso-proxy << EOF
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade \$http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host \$host;
           proxy_set_header X-Real-IP \$remote_addr;
           proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto \$scheme;
           proxy_cache_bypass \$http_upgrade;
       }
   }
   EOF
   
   # Enable the site
   sudo ln -s /etc/nginx/sites-available/lasso-proxy /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **Setup SSL with Let's Encrypt:**
   ```bash
   # Install Certbot
   sudo apt-get install -y certbot python3-certbot-nginx
   
   # Obtain SSL certificate
   sudo certbot --nginx -d your-domain.com
   
   # Setup auto-renewal
   sudo crontab -e
   # Add: 0 12 * * * /usr/bin/certbot renew --quiet
   ```

## Database Setup

### Development Database

The development setup uses Docker Compose for PostgreSQL:

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: lasso-proxy-postgres
    environment:
      POSTGRES_DB: lasso_proxy
      POSTGRES_USER: lasso_user
      POSTGRES_PASSWORD: lasso_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lasso_user -d lasso_proxy"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Production Database

For production, use a managed PostgreSQL service or self-hosted instance:

**Managed Options:**
- AWS RDS
- Google Cloud SQL
- Azure Database for PostgreSQL
- DigitalOcean Managed Databases
- Heroku Postgres

**Self-hosted Setup:**
```bash
# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE lasso_proxy_prod;
CREATE USER lasso_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE lasso_proxy_prod TO lasso_user;
\q
EOF

# Configure PostgreSQL for production
sudo nano /etc/postgresql/*/main/postgresql.conf
# Set: max_connections = 100
# Set: shared_buffers = 256MB
# Set: effective_cache_size = 1GB

sudo nano /etc/postgresql/*/main/pg_hba.conf
# Add: host lasso_proxy_prod lasso_user 127.0.0.1/32 md5

sudo systemctl restart postgresql
```

## Environment Configuration

### Development Environment

```bash
# config.env
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=lasso_user
DB_PASSWORD=lasso_password
DB_DATABASE=lasso_proxy

# API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### Production Environment

```bash
# .env (production)
PORT=3000
NODE_ENV=production

# Database (production)
DB_HOST=your_production_db_host
DB_PORT=5432
DB_USERNAME=your_production_user
DB_PASSWORD=your_secure_password
DB_DATABASE=lasso_proxy_prod
DB_CONNECTION_LIMIT=20
DB_ACQUIRE_TIMEOUT=60000
DB_TIMEOUT=60000
DB_RETRY_ATTEMPTS=5
DB_RETRY_DELAY=5000

# API Keys (production)
OPENAI_API_KEY=your_production_openai_key
ANTHROPIC_API_KEY=your_production_anthropic_key

# Security
ENABLE_DATA_SANITIZATION=true
ENABLE_POLICY_ENFORCEMENT=true
FINANCIAL_DETECTION_STRICT=true
```

## Monitoring & Health Checks

### Health Check Endpoint

```bash
# Check application health
curl http://your-domain.com/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected",
  "version": "1.0.0"
}
```

### Monitoring Commands

```bash
# Check application status
pm2 status

# View logs
pm2 logs lasso-proxy

# Monitor resources
pm2 monit

# Check database connection
npm run test:db

# View statistics
curl http://your-domain.com/stats

# View recent logs
curl http://your-domain.com/logs?limit=10
```

### Log Management

```bash
# Setup log rotation
sudo tee /etc/logrotate.d/lasso-proxy << EOF
/path/to/lasso-proxy/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   sudo systemctl status postgresql
   
   # Test connection
   psql -h localhost -U lasso_user -d lasso_proxy
   
   # Check environment variables
   cat .env | grep DB_
   ```

2. **Application Won't Start**
   ```bash
   # Check logs
   pm2 logs lasso-proxy
   
   # Check if port is in use
   sudo netstat -tlnp | grep :3000
   
   # Restart application
   pm2 restart lasso-proxy
   ```

3. **Migration Issues**
   ```bash
   # Check migration files
   ls src/database/migrations/
   
   # Run setup with verbose output
   DEBUG=* npm run db:setup
   
   # Check database schema
   psql -h localhost -U lasso_user -d lasso_proxy -c "\d request_logs"
   ```

4. **Performance Issues**
   ```bash
   # Check database performance
   npm run test:db
   
   # Monitor application resources
   pm2 monit
   
   # Check nginx logs
   sudo tail -f /var/log/nginx/access.log
   sudo tail -f /var/log/nginx/error.log
   ```

### Emergency Procedures

1. **Rollback to Previous Version**
   ```bash
   # Stop application
   pm2 stop lasso-proxy
   
   # Checkout previous version
   git checkout <previous-commit>
   
   # Rebuild and restart
   npm run build
   pm2 start lasso-proxy
   ```

2. **Database Recovery**
   ```bash
   # Create backup
   pg_dump -h localhost -U lasso_user lasso_proxy > backup.sql
   
   # Restore from backup
   psql -h localhost -U lasso_user lasso_proxy < backup.sql
   ```

3. **Complete Reset**
   ```bash
   # Stop all services
   pm2 stop all
   sudo systemctl stop nginx
   
   # Reset database
   npm run docker:down
   npm run docker:up
   npm run db:setup
   
   # Restart services
   pm2 start all
   sudo systemctl start nginx
   ```

## Security Considerations

1. **Environment Variables**
   - Never commit `.env` files to version control
   - Use strong, unique passwords for production
   - Rotate API keys regularly

2. **Database Security**
   - Use SSL connections in production
   - Limit database access to application server
   - Regular security updates

3. **Application Security**
   - Keep Node.js and dependencies updated
   - Use HTTPS in production
   - Implement rate limiting
   - Monitor for suspicious activity

4. **Server Security**
   - Regular system updates
   - Firewall configuration
   - SSH key-based authentication
   - Disable root login

## Performance Optimization

1. **Database Optimization**
   - Proper indexing
   - Connection pooling
   - Query optimization
   - Regular maintenance

2. **Application Optimization**
   - Caching strategies
   - Load balancing
   - CDN for static assets
   - Monitoring and alerting

3. **Infrastructure Optimization**
   - Auto-scaling
   - Load balancers
   - CDN
   - Monitoring tools
