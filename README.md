# SwasthyaQueue

SwasthyaQueue is a hospital queue management system with:

- a Next.js frontend
- a Node.js + Express backend
- a Python Flask ML service
- a PostgreSQL database

The repository is now in a working local state.
Frontend, backend, ML, and database all run together and the core queue flow is connected end to end.

## Current Working State

### Working right now

- patient registration flow
- patient token generation
- patient queue status view
- staff dashboard queue view
- staff call-next action
- staff complete action
- live queue display
- backend to PostgreSQL connection
- backend to ML service prediction call

### Still not fully implemented

- real authentication and authorization
- real patient login or signup
- doctor-specific workflow and notes
- admin dashboard
- manual priority override API
- audit logs
- production-grade validation and monitoring

## Project Structure

```text
SwasthyaQueue/
|-- frontend/      Next.js app
|-- backend/       Express + PostgreSQL API
|-- ml-service/    Flask ML service
|-- README.md
```

## Architecture

```text
Frontend -> Backend -> PostgreSQL
Frontend -> Backend -> ML Service
```

Important:

- the frontend should talk only to the backend
- the backend owns queue logic and persistence
- the ML service is only a helper for triage priority
- PostgreSQL is the source of truth for patients, departments, and queue state

## Local Run Commands

Start each service in a separate terminal.

### 1. PostgreSQL

Make sure PostgreSQL is running locally on:

- `localhost:5432`

### 2. Backend

From [backend](D:/Study/Learning/Projects/SwasthyaQueue/backend):

```powershell
npm.cmd install
npm.cmd start
```

Runs on:

- `http://localhost:5000`

Quick checks:

- `http://localhost:5000/`
- `http://localhost:5000/test-db`

### 3. ML Service

From [ml-service](D:/Study/Learning/Projects/SwasthyaQueue/ml-service):

```powershell
C:\Users\ichir\AppData\Local\Programs\Python\Python313\python.exe -m pip install -r requirements.txt
C:\Users\ichir\AppData\Local\Programs\Python\Python313\python.exe app.py
```

Runs on:

- `http://localhost:5001`

Quick check:

- `http://localhost:5001/`

Note:
On this machine, `python` and `py` may point to the Windows Store launcher and fail with access errors, so the direct Python path is the safest option.

### 4. Frontend

From [frontend](D:/Study/Learning/Projects/SwasthyaQueue/frontend):

```powershell
npm.cmd install
npm.cmd run dev
```

Default dev URL:

- `http://localhost:3001`

If you want `3000` instead:

```powershell
$env:PORT='3000'
npm.cmd run dev
```

Why `3001` by default:

- the standard `next dev` wrapper was hitting a Windows `spawn EPERM` issue
- the repo now uses a direct dev launcher to avoid that
- `3001` is safer when `3000` is already occupied

## Environment Setup

### Backend

Create a `.env` in [backend](D:/Study/Learning/Projects/SwasthyaQueue/backend) using [backend/.env.example](D:/Study/Learning/Projects/SwasthyaQueue/backend/.env.example).

Expected values:

```env
DB_USER=postgres
DB_PASSWORD=your_local_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=swasthyaqueue
PORT=5000
ML_SERVICE_URL=http://127.0.0.1:5001
```

### Frontend

Create a `.env.local` in [frontend](D:/Study/Learning/Projects/SwasthyaQueue/frontend) using [frontend/.env.example](D:/Study/Learning/Projects/SwasthyaQueue/frontend/.env.example).

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000
```

## Database

The local schema file is:

- [backend/schema.sql](D:/Study/Learning/Projects/SwasthyaQueue/backend/schema.sql)

It creates:

- database: `swasthyaqueue`
- tables:
  - `departments`
  - `patients`
  - `queue`

It also seeds departments so the system can run immediately.

To initialize locally:

```powershell
psql -U postgres -d postgres -f backend/schema.sql
```

## Frontend Routes

Main app routes:

- `/`
- `/patient/register`
- `/patient/token`
- `/patient/dashboard`
- `/staff/dashboard`
- `/display`
- `/tv`

## Backend API

### Utility

- `GET /`
- `GET /test-db`

### Patients

- `POST /api/patients/register`

### Queue

- `POST /api/queue/add`
- `POST /api/queue/check-turn`
- `POST /api/queue/next`
- `POST /api/queue/complete`
- `GET /api/queue/stats`
- `GET /api/queue/:department_id`
- `GET /api/queue/position/:patient_id/:department_id`

## ML API

The backend calls:

```text
POST http://127.0.0.1:5001/predict
```

Expected response:

```json
{
  "priority": 1
}
```

## How To Test

### Basic health check

Verify these first:

- frontend loads
- backend `/` works
- backend `/test-db` returns department data
- ML `/` returns `ML API Running...`

### End-to-end queue test

1. Open frontend home page.
2. Enter patient flow and register a patient.
3. Confirm token page appears.
4. Open patient dashboard and confirm live queue details load.
5. Open staff dashboard in another tab.
6. Open display page in another tab.
7. In staff dashboard, click `Call Next`.
8. Confirm display and patient status update.
9. In staff dashboard, click `Complete`.
10. Confirm queue advances correctly.

### Best realistic manual scenario

1. Register Patient A in a department.
2. Register Patient B in the same department.
3. Confirm both appear in the department queue.
4. Call next from staff dashboard.
5. Confirm Patient A becomes current.
6. Complete Patient A.
7. Confirm Patient B moves forward.

## What Is Real vs Mock

### Real today

- patient registration writes to backend
- queue entry writes to database
- backend asks ML service for priority
- patient dashboard uses real queue data
- staff dashboard uses real queue data
- display page uses real queue data

### Mock or demo today

- login page behavior
- role authentication
- override controls beyond basic queue actions
- deeper doctor/admin workflows

## Recommended Next Work

This is the best next sequence if you want to make the project stronger quickly.

### Priority 1: Make it safer and more production-ready

- add request validation on backend routes
- add proper error responses for bad input and service failures
- add fallback logic when ML service is down
- remove hardcoded backend password fallback in production usage
- add consistent logging

### Priority 2: Add real auth

- patient signup/login
- staff login
- role-based access control
- protected frontend routes

### Priority 3: Improve real hospital workflow

- manual priority override with reason
- audit trail for call-next, complete, and overrides
- department transfer
- returning patient lookup by mobile number
- patient history
- family member / dependent registration

### Priority 4: Improve ML realism

- replace placeholder symptom coding with a real mapping flow
- add confidence score
- collect feedback on incorrect triage
- version and retrain the model

### Priority 5: Improve deployment readiness

- use managed Postgres
- add production env files and deployment configs
- set CORS explicitly per environment
- add health endpoints
- add monitoring and uptime checks

## Hosting Recommendation

### Recommended simple deployment

- Frontend: Vercel
- Backend: Render or Railway
- ML service: Render or Railway
- Database: Neon, Supabase Postgres, Railway Postgres, or a managed PostgreSQL instance

### Why this split works

- frontend is static/app-host friendly
- backend and ML service can scale independently
- managed Postgres is easier than self-hosting

### Simpler future architecture

If you want easier deployment later, move the ML logic inside the backend and host:

- one frontend
- one backend
- one database

That reduces operational complexity a lot.

## Production Hosting Notes

Before deploying, make sure you set:

- frontend API base URL
- backend database credentials
- backend ML service URL
- backend CORS policy
- production secrets only through environment variables

You should also add:

- HTTPS everywhere
- rate limiting
- request validation
- structured logs
- health checks
- backups for database

## Suggested Future Enhancements

### Patient side

- signup/login
- multilingual support
- SMS / WhatsApp alerts
- appointment reschedule/cancel
- previous visit history
- medical history summary

### Staff side

- queue filters
- priority override
- printable slips
- transfer between departments
- emergency fast-track tagging

### Doctor side

- consultation notes
- prescription flow
- follow-up scheduling
- referral flow

### Admin side

- analytics dashboard
- user management
- doctor roster
- department settings

## Important Files

- [README.md](D:/Study/Learning/Projects/SwasthyaQueue/README.md)
- [backend/server.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/server.js)
- [backend/db.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/db.js)
- [backend/schema.sql](D:/Study/Learning/Projects/SwasthyaQueue/backend/schema.sql)
- [frontend/package.json](D:/Study/Learning/Projects/SwasthyaQueue/frontend/package.json)
- [frontend/postcss.config.mjs](D:/Study/Learning/Projects/SwasthyaQueue/frontend/postcss.config.mjs)
- [frontend/next.config.ts](D:/Study/Learning/Projects/SwasthyaQueue/frontend/next.config.ts)
- [frontend/scripts/dev-direct.mjs](D:/Study/Learning/Projects/SwasthyaQueue/frontend/scripts/dev-direct.mjs)
- [frontend/src/frontend/AppRouter.jsx](D:/Study/Learning/Projects/SwasthyaQueue/frontend/src/frontend/AppRouter.jsx)
- [ml-service/app.py](D:/Study/Learning/Projects/SwasthyaQueue/ml-service/app.py)
- [ml-service/requirements.txt](D:/Study/Learning/Projects/SwasthyaQueue/ml-service/requirements.txt)

## Final Note

This README now reflects the actual working state of the repository:

- all major local services run
- the core queue flow works
- the current limitations are documented honestly
- the most practical next steps and hosting direction are listed clearly
