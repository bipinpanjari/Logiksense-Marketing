# Database Setup Guide

## 🗄️ PostgreSQL Database for LogikSense Marketing

This guide covers setting up the PostgreSQL database for the marketing automation platform.

---

## 📋 Option 1: Docker Setup (Recommended)

### Install Docker
- Windows: https://www.docker.com/products/docker-desktop
- Mac: https://www.docker.com/products/docker-desktop
- Linux: `sudo apt-get install docker.io`

### Start PostgreSQL Container

```bash
docker run --name logiksense-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=logiksense_marketing \
  -p 5432:5432 \
  -v logiksense-db:/var/lib/postgresql/data \
  -d postgres:13
```

### Verify Container is Running

```bash
docker ps
# Should show logiksense-postgres running
```

### Connect to Database

```bash
docker exec -it logiksense-postgres psql -U postgres -d logiksense_marketing
```

### Stop/Start Container

```bash
# Stop
docker stop logiksense-postgres

# Start
docker start logiksense-postgres

# Remove (delete database)
docker rm logiksense-postgres
```

---

## 🖥️ Option 2: Native PostgreSQL Installation

### Windows

1. Download PostgreSQL: https://www.postgresql.org/download/windows/
2. Run installer
3. Note the password you set for `postgres` user
4. PostgreSQL runs on port 5432 by default

### Mac

```bash
# Using Homebrew
brew install postgresql@13
brew services start postgresql@13
```

### Linux

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE logiksense_marketing;

# List databases
\l

# Exit
\q
```

---

## 🔧 Environment Configuration

Create `.env` file in backend directory:

```env
# Database Connection
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=logiksense_marketing
DB_POOL_MIN=2
DB_POOL_MAX=10

# JWT
JWT_SECRET=your_super_secret_key_replace_this_with_something_long_and_random
JWT_EXPIRATION=24h
JWT_REFRESH_SECRET=your_refresh_secret_key_also_replace_this
JWT_REFRESH_EXPIRATION=7d

# Server
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=debug
```

---

## 🗃️ Database Schema

The migrations create this schema:

### customers
```sql
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### workspaces
```sql
CREATE TABLE workspaces (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### leads
```sql
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id),
  email VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  status VARCHAR(50),
  source VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### contacts
```sql
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id),
  lead_id INTEGER REFERENCES leads(id),
  email VARCHAR(255),
  phone VARCHAR(20),
  activity_log JSONB,
  custom_fields JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### sessions
```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### activity_logs
```sql
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id),
  entity_type VARCHAR(100),
  entity_id INTEGER,
  action VARCHAR(50),
  user_id INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### api_keys
```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id),
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),
  permissions TEXT[],
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 Run Migrations

After database is set up:

```bash
cd backend
npm install
npm run db:migrate
```

This executes all migration files in `src/migrations/` order.

---

## ✅ Verify Setup

### Check Connection

```bash
# Connect to database
psql -U postgres -d logiksense_marketing -h localhost

# List tables
\dt

# Exit
\q
```

### Check Backend Connection

```bash
cd backend
npm run start:dev
```

Look for:
```
[NestFactory] Starting Nest application...
[InstanceLoader] FeaturesModule dependencies initialized
Connected to PostgreSQL database
Listening on http://localhost:3000
```

### Test Health Endpoint

```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## 🔄 Backup & Restore

### Backup Database

```bash
# Using pg_dump
pg_dump -U postgres -d logiksense_marketing > backup.sql

# Or from Docker
docker exec logiksense-postgres pg_dump -U postgres logiksense_marketing > backup.sql
```

### Restore Database

```bash
# Create new database
createdb -U postgres logiksense_marketing_restored

# Restore from backup
psql -U postgres -d logiksense_marketing_restored < backup.sql
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `psql: error: could not connect to server` | Ensure PostgreSQL is running on port 5432 |
| `ERROR: database already exists` | Connect and drop: `DROP DATABASE logiksense_marketing;` |
| `permission denied` | Check DB_USERNAME and DB_PASSWORD in .env |
| `relation "table_name" does not exist` | Run migrations: `npm run db:migrate` |
| `MigrationFailedError` | Check database permissions and ensure PostgreSQL version 12+ |

---

## 📚 Useful Commands

```bash
# Connect to PostgreSQL
psql -U postgres -h localhost

# List all databases
\l

# Connect to database
\c logiksense_marketing

# List tables
\dt

# Describe table
\d leads

# Exit
\q

# Reset database
dropdb -U postgres logiksense_marketing
createdb -U postgres logiksense_marketing
npm run db:migrate
```

---

## 🔐 Security Tips

- [ ] Change default `postgres` password
- [ ] Use strong passwords in production
- [ ] Restrict database access by IP
- [ ] Enable SSL for connections
- [ ] Regular backups
- [ ] Monitor database logs
- [ ] Use managed PostgreSQL in production (AWS RDS, etc.)

---

## Next Steps

1. Set up database (Docker or Native)
2. Create `.env` file in backend
3. Run migrations: `npm run db:migrate`
4. Start backend: `npm run start:dev`
5. Start frontend: `cd frontend && npm start`
6. Access dashboard: `http://localhost:3001`

Enjoy! 🚀
