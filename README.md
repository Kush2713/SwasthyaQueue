# SwasthyaQueue

SwasthyaQueue is a digital OPD queue and visit-management system designed for Indian hospitals and clinics. It combines:

- patient self-service
- front-desk assisted registration
- nurse triage
- doctor consultation workflow
- live queue visibility

The current repository includes:

- a Next.js frontend
- a Node.js + Express backend
- a Python Flask ML service for triage support
- a PostgreSQL database
- Render deployment support

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
- department + day scoped tokening with formatted labels (`GEN-YYYY-MM-DD-###`)
- fixed hospital-timezone operational day logic (`Asia/Kolkata` by default)
- stale queue auto-closure housekeeping job
- backend + PostgreSQL integration
- backend + ML integration
- local development support
- Render deployment support

### Still not production-complete

- strict backend authorization per role
- real OTP delivery over SMS/email
- audit trail for each operational change
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
- ML only assists with triage priority, not core storage

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

Start each service in a separate terminal.

### PostgreSQL

Make sure PostgreSQL is running locally on:

- `localhost:5432`

### Backend

From `backend/`:

```powershell
npm.cmd install
npm.cmd start
```

Runs on:

- `http://localhost:5000`

Quick checks:

- `http://localhost:5000/`
- `http://localhost:5000/test-db`
- `http://localhost:5000/playground`

### ML Service

From `ml-service/`:

```powershell
python -m pip install -r requirements.txt
python app.py
```

Runs on:

- `http://localhost:5001`

### Frontend

From `frontend/`:

```powershell
npm.cmd install
npm.cmd run dev
```

Default dev URL:

- `http://localhost:3001`

Optional:

```powershell
$env:PORT='3000'
npm.cmd run dev
```

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
