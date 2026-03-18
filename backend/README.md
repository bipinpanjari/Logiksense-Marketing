# LogikSense Marketing Backend

NestJS-based backend API with PostgreSQL database for multi-tenant marketing automation.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- npm

### Installation

```bash
npm install
```

### Environment Setup

Create `.env` file:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=logiksense_marketing

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRATION=24h
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_REFRESH_EXPIRATION=7d

# Server
PORT=3000
NODE_ENV=development

# Ollama (Optional - for RAG chatbot)
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=mistral
DOC_STORAGE_DIR=./documents
```

### Database Setup

#### Option 1: Using Docker (Recommended)

```bash
docker run --name logiksense-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=logiksense_marketing \
  -p 5432:5432 \
  -d postgres:13
```

#### Option 2: Native PostgreSQL

```bash
createdb -U postgres logiksense_marketing
```

### Run Migrations

```bash
npm run db:migrate
```

This creates all required tables:
- `customers`
- `workspaces`
- `leads`
- `contacts`
- `sessions`
- `activity_logs`
- `api_keys`

### Start Server

**Development Mode (with auto-reload):**
```bash
npm run start:dev
```

**Production Mode:**
```bash
npm run build
npm start
```

Server runs on: `http://localhost:3000`

Health check: `GET http://localhost:3000/api/health`

---

## 📁 Project Structure

```
src/
├── app.module.ts              → Root NestJS module
├── main.ts                    → Application entry point
│
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── email-validation.service.ts
│   │
│   ├── workspaces/
│   │   ├── workspace.controller.ts
│   │   └── workspace.service.ts
│   │
│   ├── leads/
│   │   ├── lead.controller.ts
│   │   ├── lead.service.ts
│   │   ├── lead-import.service.ts
│   │   └── webhook.controller.ts
│   │
│   ├── contacts/
│   │   ├── contact.controller.ts
│   │   └── contact.service.ts
│   │
│   └── customers/
│       └── (Customer management)
│
├── shared/
│   ├── auth.middleware.ts     → JWT validation
│   ├── database.ts            → PostgreSQL connection pool
│   ├── jwt-auth.guard.ts      → Auth guards
│   └── types.ts               → TypeScript interfaces
│
└── migrations/
    ├── 001_create_core_tables.sql
    ├── 002_add_registration_and_email_config.sql
    ├── phase3-email-sequences-migration.ts
    └── run.ts                  → Migration runner
```

---

## 🔑 API Endpoints

### Auth Module
```
POST   /api/auth/signup         → Create account + workspace
POST   /api/auth/login          → Get JWT tokens
POST   /api/auth/refresh        → Refresh access token
GET    /api/auth/me             → Current user info
```

### Workspace Module
```
GET    /api/workspaces          → List user's workspaces
GET    /api/workspaces/:id      → Get specific workspace
POST   /api/workspaces          → Create new workspace
PUT    /api/workspaces/:id      → Update workspace
GET    /api/workspaces/:id/stats → Get workspace stats
```

### Leads Module
```
GET    /api/leads               → List leads (workspace filtered)
POST   /api/leads/import        → Import leads from CSV
GET    /api/leads/:id           → Get lead details
PUT    /api/leads/:id           → Update lead
DELETE /api/leads/:id           → Delete lead
POST   /api/webhooks/lead       → Webhook for lead capture
```

### Health
```
GET    /api/health              → Health check
```

---

## 🗄️ Database

### Multi-Tenant Architecture

All tables include `workspace_id` for isolation:

```sql
-- Example: Only see leads in your workspace
SELECT * FROM leads WHERE workspace_id = $1
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `customers` | User accounts, passwords, subscription |
| `workspaces` | Isolated workspaces per customer |
| `leads` | All lead data, filtered by workspace |
| `contacts` | Extended contact info, activity |
| `sessions` | JWT refresh token tracking |
| `activity_logs` | Audit trail for all changes |
| `api_keys` | API credentials for integrations |

---

## 🔐 Authentication

### JWT Flow

1. **Signup/Login**: Returns `accessToken` & `refreshToken`
2. **Access Token**: Used for API requests (24 hours)
3. **Refresh Token**: Used to get new access token (7 days)
4. **Workspace Context**: JWT includes `workspaceId` for filtering

### Example Request

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/leads
```

---

## 🚢 Production Checklist

- [ ] Set strong `JWT_SECRET` (use random string)
- [ ] Use HTTPS/SSL
- [ ] Configure proper CORS for frontend domain
- [ ] Set `NODE_ENV=production`
- [ ] Use managed PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
- [ ] Enable database backups
- [ ] Implement rate limiting
- [ ] Set up monitoring & logging
- [ ] Configure email service (sendgrid, AWS SES)
- [ ] Use environment variables from secure vault

---

## 📝 Scripts

```bash
npm start             # Run production server
npm run start:dev     # Run with auto-reload
npm run build         # Compile TypeScript
npm run db:migrate    # Run database migrations
npm run test          # Run tests
npm run test:watch    # Run tests in watch mode
```

---

## 🐛 Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Check DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD in .env
- Run: `psql -U postgres -d logiksense_marketing` to verify access

### Migration Failed
- Check database has required permissions
- Run: `npm run db:migrate` with verbose logging
- Check migration files in `src/migrations/`

### JWT Errors
- Ensure JWT_SECRET is set in .env
- Check token hasn't expired (24 hours)
- Request new token using refresh endpoint

---

## 📚 Resources

- NestJS Docs: https://docs.nestjs.com
- PostgreSQL Docs: https://www.postgresql.org/docs
- JWT Guide: https://jwt.io

---

## License

Proprietary
