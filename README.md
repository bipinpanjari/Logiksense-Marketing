# LogikSense Marketing Automation Suite

Complete marketing automation platform with frontend (React) and backend (NestJS) with PostgreSQL database.

## 📁 Project Structure

```
LogikSense-Marketing-Suite/
├── frontend/          → React SPA for marketing automation
│   ├── src/
│   ├── public/
│   └── package.json
│
└── backend/           → NestJS API with database
    ├── src/
    │   ├── modules/    → Auth, Leads, Workspaces, Contacts
    │   ├── shared/     → Middleware, Database, Guards
    │   └── migrations/ → Database schema
    ├── package.json
    └── tsconfig.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm
- PostgreSQL 12+
- Docker (optional, for PostgreSQL)

### 1. Start PostgreSQL Database

**Option A: Using Docker (Recommended)**
```bash
docker run --name logiksense-db -e POSTGRES_PASSWORD=your_password -p 5432:5432 -d postgres:13
```

**Option B: Native PostgreSQL**
- Ensure PostgreSQL is running on localhost:5432
- Create database: `createdb logiksense_marketing`

### 2. Backend Setup

```bash
cd backend
npm install
npm run build
npm run db:migrate  # Run database migrations
npm start           # Start on port 3000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start           # Start on port 3001
```

### 4. Access the Platform

- **Website + Admin:** http://localhost:3000
- **Marketing Dashboard:** http://localhost:3001

---

## 🗄️ Database Setup

### Environment Variables (.env)

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=logiksense_marketing

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=24h

# Ollama (Optional)
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

### Database Schema

The migrations create these tables:
- `customers` - User accounts
- `workspaces` - Multi-tenant workspaces
- `leads` - Lead data
- `contacts` - Contact details
- `sessions` - JWT refresh tokens
- `activity_logs` - Audit trail
- `api_keys` - API integrations

### Run Migrations

```bash
npm run db:migrate
```

---

## 📊 Features

### Frontend (React)
- ✅ Dashboard with metrics
- ✅ Lead Management & CRM
- ✅ Email Campaign Builder
- ✅ Email Sequences & Automation
- ✅ Campaign Calendar
- ✅ Settings & Provider Config

### Backend (NestJS)
- ✅ Multi-tenant authentication
- ✅ JWT token management
- ✅ Workspace isolation
- ✅ Lead import & webhooks
- ✅ Contact management
- ✅ Email integration endpoints
- ✅ Activity logging

### Database (PostgreSQL)
- ✅ Multi-tenant support (workspace_id on all tables)
- ✅ Foreign key constraints
- ✅ Indexes for performance
- ✅ Audit trails

---

## 🔐 API Endpoints

### Authentication
```
POST   /api/auth/signup          → Register new customer
POST   /api/auth/login           → Login & get JWT tokens
POST   /api/auth/refresh         → Refresh access token
GET    /api/auth/me              → Get current user
```

### Workspaces
```
GET    /api/workspaces           → List user workspaces
GET    /api/workspaces/:id       → Get workspace
POST   /api/workspaces           → Create workspace
PUT    /api/workspaces/:id       → Update workspace
```

### Leads
```
GET    /api/leads                → List leads
POST   /api/leads/import         → Import from CSV
GET    /api/leads/:id            → Get lead details
PUT    /api/leads/:id            → Update lead
DELETE /api/leads/:id            → Delete lead
POST   /api/leads/webhook        → Webhook endpoint
```

### Health
```
GET    /api/health               → Health check
```

---

## 🚢 Production Deployment

### Backend
1. Set environment variables in production server
2. Run migrations on production database
3. Use environment-specific secrets/keys
4. Enable HTTPS/SSL
5. Set up proper CORS for frontend domain
6. Implement rate limiting

### Frontend
1. Build: `npm run build`
2. Deploy build folder to hosting (Vercel, Netlify, etc.)
3. Update API_URL to point to backend domain
4. Configure environment variables

---

## 📚 Additional Resources

- Backend Modules: `src/modules/`
- Database Migrations: `src/migrations/`
- Shared Utilities: `src/shared/`

---

## License

Proprietary
