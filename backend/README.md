# SwasthyaQueue Backend

This folder contains the Node.js + Express backend for SwasthyaQueue.

It is the operational core of the project. The backend:

- stores and reads data from PostgreSQL
- owns patient, appointment, and queue workflow rules
- exposes APIs for patient, receptionist, nurse, and doctor flows
- coordinates with the ML triage service
- serves the backend API playground

## What This Backend Does

The backend is responsible for turning frontend actions into hospital workflow state.

Examples:

- patient account signup and OTP login
- patient visit booking
- quick intake by reception
- staff-assisted patient accounts
- urgent review flagging
- nurse triage recording
- ready-for-doctor handoff
- doctor consultation updates
- visit completion

Frontend should not directly manage queue logic. The backend is the source of workflow truth.

## Main Responsibilities

### Authentication

- patient OTP flow
- current patient session lookup
- staff-assisted account creation

### Patient Profile

- create patient records
- update patient profile
- complete profile later after quick intake

### Appointments

- create full appointment
- create quick intake appointment
- fetch active appointment
- fetch history
- open patient case by queue id
- cancel visit
- save doctor updates

### Queue

- add to queue
- compute or normalize queue priority
- call next patient
- complete patient
- urgent review flag
- priority override
- record triage
- mark ready for doctor
- queue stats and per-department queue

## Important Files

- [server.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/server.js)
  Express entry point and route mounting
- [db.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/db.js)
  PostgreSQL connection config
- [schema.sql](D:/Study/Learning/Projects/SwasthyaQueue/backend/schema.sql)
  main schema and seed setup
- [bootstrap/ensureSchema.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/bootstrap/ensureSchema.js)
  schema bootstrap for local and hosted runs

Controllers:

- [controllers/authController.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/controllers/authController.js)
- [controllers/patientController.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/controllers/patientController.js)
- [controllers/appointmentController.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/controllers/appointmentController.js)
- [controllers/queueController.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/controllers/queueController.js)

Routes:

- [routes/authRoutes.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/routes/authRoutes.js)
- [routes/patientRoutes.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/routes/patientRoutes.js)
- [routes/appointmentRoutes.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/routes/appointmentRoutes.js)
- [routes/queueRoutes.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/routes/queueRoutes.js)

Supporting logic:

- [services/queueService.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/services/queueService.js)
- [middleware/authMiddleware.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/middleware/authMiddleware.js)
- [utils/auth.js](D:/Study/Learning/Projects/SwasthyaQueue/backend/utils/auth.js)
- [public/api-playground.html](D:/Study/Learning/Projects/SwasthyaQueue/backend/public/api-playground.html)

## Database Model

Core tables used by the backend:

- `departments`
- `patients`
- `patient_accounts`
- `appointments`
- `queue`

High-level relationship:

```text
patient_accounts -> patients -> appointments -> queue
```

Meaning:

- `patient_accounts` handles identity/login
- `patients` stores reusable patient profile + medical basics
- `appointments` stores one OPD visit
- `queue` stores live operational queue state for the appointment

## Local Run

From this folder:

```powershell
npm.cmd install
npm.cmd start
```

Default local URL:

- `http://localhost:5000`

Useful checks:

- `http://localhost:5000/`
- `http://localhost:5000/test-db`
- `http://localhost:5000/playground`

## Environment Variables

Create [`.env`](D:/Study/Learning/Projects/SwasthyaQueue/backend/.env) using [.env.example](D:/Study/Learning/Projects/SwasthyaQueue/backend/.env.example).

Typical local setup:

```env
DB_USER=postgres
DB_PASSWORD=your_local_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=swasthyaqueue
PORT=5000
ML_SERVICE_URL=http://127.0.0.1:5001
OTP_PREVIEW_ENABLED=true
```

Hosted setups can use:

- `DATABASE_URL`
- `ML_SERVICE_URL`
- `OTP_PREVIEW_ENABLED=false`

## API Groups

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

## Role Logic In Backend

### Patient

- account creation
- OTP login
- book visit
- cancel visit
- view active/history

### Receptionist

- assisted account creation
- quick intake
- queue lookup
- call next
- open case
- flag urgent review
- complete missing patient details later

### Nurse

- triage vitals and notes
- urgent review approval
- priority override
- ready-for-doctor handoff

### Doctor

- consultation updates
- diagnosis
- prescription / advice
- doctor notes
- complete visit

## Practical Notes

- quick intake is intentionally fast and minimal
- queue priority is still controlled by backend rules, not free-form frontend ordering
- frontend validation exists for better UX, but backend validates again for safety
- `OTP_PREVIEW_ENABLED` is only for demo/local testing and should be disabled in production-like use

## Future Backend Improvements

- strict role-based authorization for staff roles
- audit logs for every queue state change
- absent / recall / transfer-department endpoints
- doctor test orders and follow-up endpoints
- ABHA-linked identity and consent flows
- family member linking and dependent management
- better analytics and reporting APIs

## Related Docs

- [Root README](D:/Study/Learning/Projects/SwasthyaQueue/README.md)
- [Workflows](D:/Study/Learning/Projects/SwasthyaQueue/docs/WORKFLOWS.md)
- [Demo Case Studies](D:/Study/Learning/Projects/SwasthyaQueue/docs/DEMO_CASE_STUDIES.md)
