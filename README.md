# SwasthyaQueue

SwasthyaQueue is a digital OPD queue and visit-management system for Indian hospitals.

It includes:
- patient self-service booking
- receptionist operations
- nurse triage handoff
- doctor consultation closure
- live lobby queue display

Tech stack:
- `frontend/` Next.js
- `backend/` Node.js + Express + PostgreSQL
- `ml-service/` Flask (triage priority support)

## 5-Minute Reviewer Start

Run these steps exactly in 3 terminals.

1. Start backend
```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

2. Start frontend
```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

3. Start ML service (optional but recommended)
```powershell
cd ml-service
python -m pip install -r requirements.txt
python app.py
```

4. Load data state you want
```powershell
cd backend
npm.cmd run empty-run
```
or
```powershell
cd backend
npm.cmd run complete-run
```

5. Optional automated flow test
```powershell
cd backend
npm.cmd run test:e2e:smoke
```

Primary URLs:
- Frontend: `http://localhost:3001`
- Backend: `http://localhost:5000`
- Display TV page: `http://localhost:3001/display`
- API playground: `http://localhost:5000/playground`

## Quick Command Reference

From `backend/`:
- `npm.cmd run empty-run` -> clear operational data
- `npm.cmd run complete-run` -> load full demo+rush dataset
- `npm.cmd run test:e2e:smoke` -> run end-to-end API smoke flow

## Why This Project Exists

Traditional OPD handling in many hospitals still depends on:

- paper slips
- repeated manual form filling
- unclear queue visibility
- no structured nurse handoff
- little or no patient-side visit tracking

SwasthyaQueue aims to improve that by giving:

- patients a clear token and visit dashboard
- reception a fast queue and lookup console
- nurses a triage workspace
- doctors a consultation workspace
- hospital lobbies a live queue display

## Current Product State

### Working now

- patient OTP signup/login
- patient dashboard with active visit and history
- auto queue movement notifications on patient dashboard (called to triage, called to consultation, visit completed)
- patient booking flow with symptoms, review, and token generation
- preferred date/time capture for booking
- patient visit cancellation
- receptionist dashboard
- patient search by token, name, or mobile
- patient lookup ranking by patient ID/mobile before token-only fallback
- receptionist queue calling
- quick intake for rush cases
- staff-assisted patient accounts for walk-ins / no-phone patients
- nurse triage workspace
- urgent review flagging by reception
- nurse urgency override
- nurse `Ready For Doctor` handoff
- doctor consultation workspace
- doctor diagnosis / prescription / notes / completion
- shared patient case page
- display screen / lobby queue board
- formatted token labels (`GEN-YYYY-MM-DD-###`) for clarity across departments
- stale queue auto-closure housekeeping job
- DB-backed staff accounts and department assignments
- admin APIs for staff assignment management and password reset
- backend + PostgreSQL integration
- backend + ML integration
- local development support
- Render deployment support

### Still not production-complete

- real OTP delivery over SMS/email
- full admin UI for assignment/password operations (APIs are ready)
- doctor tests/orders workflow
- revisit / follow-up scheduling workflow
- absent / recall / transfer-department flow
- admin reporting and analytics
- production monitoring and hardening

## User Roles

### Patient

Patient can:

- create account
- login with OTP
- book a new visit
- review and confirm symptoms
- receive token
- see active appointment
- cancel active appointment
- view past appointments
- get short live queue-status notifications on dashboard

### Receptionist

Receptionist can:

- search patient by token, name, or mobile
- answer "how long will it take?" questions
- call next patient
- use quick intake for rush cases
- create staff-assisted accounts
- complete patient profile later
- open patient case
- flag urgent review for nurse

### Nurse

Nurse can:

- review urgent flags
- select one patient at a time for triage
- record vitals
- add triage notes
- approve high / critical escalation
- mark patient ready for doctor
- open full case sheet

### Doctor

Doctor can:

- open patients who are ready for consultation
- review symptoms and triage context
- add diagnosis
- add prescription / advice
- add doctor notes
- complete visit
- open full patient case

## Architecture

```text
Frontend -> Backend -> PostgreSQL
Frontend -> Backend -> ML Service
```

Rules:

- frontend talks only to backend
- backend owns workflow rules and persistence
- PostgreSQL is the source of truth
- ML assists priority internally (UI does not expose ML debug/suggestion text)

## Repository Layout

```text
SwasthyaQueue/
|-- frontend/
|-- backend/
|-- ml-service/
|-- render.yaml
|-- README.md
|-- docs/
```

Useful docs added in this repo:

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)
- [ml-service/README.md](ml-service/README.md)
- [docs/README.md](docs/README.md)
- [docs/FLOW_DIAGRAMS.md](docs/FLOW_DIAGRAMS.md)
- [docs/WORKFLOWS.md](docs/WORKFLOWS.md)
- [docs/DEMO_CASE_STUDIES.md](docs/DEMO_CASE_STUDIES.md)
- [docs/MANUAL_CASE_RUNBOOK.md](docs/MANUAL_CASE_RUNBOOK.md)

## Local Setup

Use the quick start above.  
Detailed setup and module notes:
- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)
- [ml-service/README.md](ml-service/README.md)

## Environment Variables

### Backend

Create `backend/.env` using `backend/.env.example`.

```env
DB_USER=postgres
DB_PASSWORD=your_local_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=swasthyaqueue
PORT=5000
ML_SERVICE_URL=http://127.0.0.1:5001
OTP_PREVIEW_ENABLED=true
AUTH_TOKEN_SECRET=change_this_to_a_long_random_secret
HOSPITAL_TIMEZONE=Asia/Kolkata
QUEUE_HOUSEKEEPING_ENABLED=true
QUEUE_HOUSEKEEPING_INTERVAL_MINUTES=15
PG_SSL_REJECT_UNAUTHORIZED=false
OPD_START_TIME=09:30
OPD_END_TIME=21:30
```

### Frontend

Create `frontend/.env.local` using `frontend/.env.example`.

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000
```

## Database

Main schema file:

- `backend/schema.sql`

Core tables:

- `departments`
- `patients`
- `patient_accounts`
- `appointments`
- `queue`

To initialize locally:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d postgres -f backend/schema.sql
```

## Frontend Routes

Main routes:

- `/`
- `/patient/dashboard`
- `/patient/book`
- `/patient/token`
- `/reception/dashboard`
- `/staff/dashboard` for nurse and doctor workspaces
- `/case/queue/:queueId`
- `/display`
- `/tv`

## Recommended Demo Sequence

1. `npm.cmd run empty-run` and show empty state.
2. `npm.cmd run complete-run` and refresh dashboards.
3. Show `Reception -> Nurse -> Doctor -> Patient History`.
4. Open `/display` and verify TV queue readability.

## Backend APIs

### Utility

- `GET /`
- `GET /test-db`
- `GET /playground`

### Auth

- `POST /api/auth/patient/signup`
- `POST /api/auth/patient/request-otp`
- `POST /api/auth/patient/verify-otp`
- `GET /api/auth/me`
- `POST /api/auth/staff/patient-account`
- `GET /api/auth/admin/staff`
- `PUT /api/auth/admin/staff/:staff_id/assignments`
- `PUT /api/auth/admin/staff/:staff_id/password`

### Patients

- `POST /api/patients/register`
- `PUT /api/patients/me`
- `PUT /api/patients/:id/profile`

### Appointments

- `POST /api/appointments`
- `POST /api/appointments/quick-intake`
- `GET /api/appointments/me/active`
- `GET /api/appointments/me/history`
- `GET /api/appointments/case/queue/:queue_id`
- `POST /api/appointments/:id/cancel`
- `POST /api/appointments/:id/doctor-update`

### Queue

- `POST /api/queue/add`
- `POST /api/queue/check-turn`
- `POST /api/queue/next`
- `POST /api/queue/complete`
- `POST /api/queue/:queue_id/urgent-review`
- `POST /api/queue/:queue_id/override-priority`
- `POST /api/queue/:queue_id/triage`
- `POST /api/queue/:queue_id/ready-for-doctor`
- `GET /api/queue/stats`
- `GET /api/queue/:department_id`
- `GET /api/queue/position/:patient_id/:department_id`

## How Someone Can Use It

### Self-service patient journey

1. Patient creates account or logs in by OTP.
2. Patient dashboard opens.
3. Patient books visit and fills symptoms.
4. Token is generated.
5. Patient tracks active visit and history.

### Front-desk assisted journey

1. Reception searches patient first.
2. If patient exists, reception opens case or helps continue.
3. If patient is new, reception can:
   - create assisted account, or
   - use quick intake for urgent queue entry
4. Reception can call next and answer wait-time questions.

### Clinical journey

1. Nurse opens triage workspace.
2. Nurse records vitals and notes.
3. Nurse escalates if needed.
4. Nurse marks patient ready for doctor.
5. Doctor opens consultation workspace.
6. Doctor records diagnosis and advice.
7. Doctor completes visit.

Operational validation notes:

- Same-day booking is allowed if slot is in the future (from next hour onward) and within OPD hours.
- Nurse triage and ready-for-doctor actions are allowed only when queue status is `in-progress`.
- Staff read/write visibility is scoped by assigned departments.

## Workflow Summary

See the full workflow breakdown here:

- [docs/WORKFLOWS.md](docs/WORKFLOWS.md)

## Demo Case Studies

Use these for presentation/demo storytelling:

- [docs/DEMO_CASE_STUDIES.md](docs/DEMO_CASE_STUDIES.md)

They include:

- one scenario per department
- end-to-end demo flow
- why digitization helps in that case

## Hosting

This repo includes:

- `render.yaml`

Current short-term hosting path:

- frontend on Render
- backend on Render
- ML service on Render
- PostgreSQL on Render

### Render flow

1. Push branch to GitHub.
2. Import repo as Render Blueprint.
3. Let Render read `render.yaml`.
4. Deploy services.
5. Run `backend/schema.sql` against the hosted database.

### Render environment checklist

Set these explicitly in Render service environment variables:

- `OTP_PREVIEW_ENABLED=true` (demo-only; disable for production)
- `ML_SERVICE_URL=<your hosted ML service URL>`
- `HOSPITAL_TIMEZONE=Asia/Kolkata`
- `QUEUE_HOUSEKEEPING_ENABLED=true`
- `AUTH_TOKEN_SECRET=<long random secret>`

Important:

- Do not leave `ML_SERVICE_URL` pointing to `localhost` in Render.

## Future Development

### ABHA / Digital Health Integration

Future real-life extension:

- ABHA-based patient verification
- fetch/link patient identity through verified health account flow
- reduce repeated registration for returning patients
- allow patient to view linked clinical history more safely

Suggested direction:

- use ABHA only after patient verification/consent
- keep hospital-local records separate until linked
- allow fallback for patients without ABHA

### Family Member Linking

Useful future feature:

- primary patient verifies identity
- family member can be added after consent / OTP / ID verification
- parent can manage child or dependent visits
- caretaker can book or track visits for elder family members

### Patient Data Visibility

Future patient-side improvements:

- full consultation history
- diagnosis history
- prescriptions and advice
- test orders and reports
- revisit / follow-up reminders
- family-linked records where authorized

### Better Doctor Workflow

Future doctor-side improvements:

- test / lab order entry
- medicines and dosage structure
- follow-up date
- referral to another department
- printable or shareable consultation summary
- past consultation comparison view

### Better Nurse Workflow

Future nurse-side improvements:

- structured triage templates per department
- red-flag prompts
- emergency transfer action
- absent / recall flow
- post-consultation guidance checklist

### Better Reception Workflow

Future reception-side improvements:

- transfer between departments
- revisit creation
- family linking at desk
- payment / registration counter integration
- token reprint / SMS / WhatsApp share

## Important Files

- `backend/server.js`
- `backend/schema.sql`
- `backend/bootstrap/ensureSchema.js`
- `backend/controllers/authController.js`
- `backend/controllers/patientController.js`
- `backend/controllers/appointmentController.js`
- `backend/controllers/queueController.js`
- `backend/routes/authRoutes.js`
- `backend/routes/patientRoutes.js`
- `backend/routes/appointmentRoutes.js`
- `backend/routes/queueRoutes.js`
- `frontend/src/frontend/AppRouter.jsx`
- `frontend/src/frontend/pages/LoginPage.jsx`
- `frontend/src/frontend/pages/reception/ReceptionDashboard.jsx`
- `frontend/src/frontend/pages/staff/StaffDashboard.jsx`
- `frontend/src/frontend/pages/case/PatientCasePage.jsx`
- `frontend/src/frontend/pages/patient/PatientDashboard.jsx`
- `frontend/src/frontend/pages/patient/PatientRegistration.jsx`
- `frontend/src/frontend/pages/patient/PatientTokenPage.jsx`
- `frontend/src/frontend/pages/display/LiveQueueDisplay.jsx`
- `frontend/src/frontend/lib/api.js`
- `ml-service/app.py`
- `render.yaml`

## Final Note

This project has moved beyond a simple queue demo.

It now models:

- patient account + visit lifecycle
- reception operations
- nurse triage
- doctor consultation
- shared patient case visibility

The next improvements should focus on:

- real security and permissions
- auditability
- stronger medical workflows
- patient history usefulness in real-life care
