# 🚀 Quick Start Guide

## 📁 Your New Structure

```
G:\LogikSense-Marketing-Suite\
├── backend/           ← NestJS API + Database
├── frontend/          ← React Dashboard
├── README.md          ← Project overview
└── DATABASE_SETUP.md  ← Database configuration guide
```

---

## 🎯 5-Minute Setup

### Step 1: Start PostgreSQL Database

**Using Docker:**
```powershell
docker run --name logiksense-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=logiksense_marketing `
  -p 5432:5432 `
  -v logiksense-db:/var/lib/postgresql/data `
  -d postgres:13
```

---

### Step 2: Setup Backend (.env file)

Create `g:\LogikSense-Marketing-Suite\backend\.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=logiksense_marketing

JWT_SECRET=your_super_secret_key_here_change_this
JWT_EXPIRATION=24h

PORT=3000
NODE_ENV=development
```

---

### Step 3: Install & Migrate Database

**Terminal 1:**
```powershell
cd g:\LogikSense-Marketing-Suite\backend
npm install
npm run db:migrate
npm run start:dev
```

✅ Should show: `Listening on http://localhost:3000`

---

### Step 4: Start Frontend

**Terminal 2:**
```powershell
cd g:\LogikSense-Marketing-Suite\frontend
npm install
npm start
```

✅ Should open: `http://localhost:3001`

---

## 🎮 Test the Platform

### 1. Sign Up (on Frontend)
- Go to: `http://localhost:3001`
- Click "Sign Up"
- Email: `test@example.com`
- Password: `Test1234!`
- Confirm password
- Click "Register"

### 2. Login
- Use the same credentials

### 3. Explore Dashboard
- View leads
- Create email campaigns
- Check campaign calendar
- Configure email settings

---

## 🗄️ Database Features

The system tracks:
- ✅ **Leads** - All lead data per workspace
- ✅ **Contacts** - Extended contact info
- ✅ **Workspaces** - Isolated spaces per customer
- ✅ **Sessions** - JWT token tracking
- ✅ **Activity Logs** - Audit trail
- ✅ **API Keys** - Integration credentials

---

## 🔗 API Endpoints (Backend on 3000)

```
POST   /api/auth/signup          → Register
POST   /api/auth/login           → Login
GET    /api/auth/me              → Current user
GET    /api/leads                → List leads
POST   /api/leads/import         → Import CSV
GET    /api/health               → Health check
```

---

## 📝 Next Steps

1. ✅ Database running (Docker)
2. ✅ Backend started (Port 3000)
3. ✅ Frontend started (Port 3001)
4. ✅ Sign up & explore

For detailed setup: See `DATABASE_SETUP.md`

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 5432 already in use | Stop other PostgreSQL: `docker stop logiksense-postgres` |
| Backend won't start | Check `.env` file, ensure PostgreSQL is running |
| Frontend blank page | Check browser console for errors, ensure backend is running |
| Database migration failed | Verify database exists: `psql -U postgres -l` |

---

## 🎯 You Now Have:

✅ **Frontend** - React dashboard for users to manage campaigns and leads
✅ **Backend** - NestJS API for data and business logic
✅ **Database** - PostgreSQL for storing leads, customers, workspaces
✅ **Authentication** - JWT-based multi-tenant system
✅ **Documentation** - Complete setup and API guides

### Ready to Test? 🚀

All files are in: `G:\LogikSense-Marketing-Suite`

Get started with the 5-minute setup above!
