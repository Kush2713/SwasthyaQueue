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
- day-wise and department-wise token generation with formatted labels
- fixed hospital-timezone operational day logic
- stale queue cleanup for previous-day pending entries

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
- token label formatting (`DEPT-YYYY-MM-DD-###`)
- stale queue auto-closure housekeeping

## Important Files

- [server.js](server.js)
  Express entry point and route mounting
- [db.js](db.js)
  PostgreSQL connection config
- [schema.sql](schema.sql)
  main schema and seed setup
- [bootstrap/ensureSchema.js](bootstrap/ensureSchema.js)
  schema bootstrap for local and hosted runs

Controllers:

- [controllers/authController.js](controllers/authController.js)
- [controllers/patientController.js](controllers/patientController.js)
- [controllers/appointmentController.js](controllers/appointmentController.js)
- [controllers/queueController.js](controllers/queueController.js)

Routes:

- [routes/authRoutes.js](routes/authRoutes.js)
- [routes/patientRoutes.js](routes/patientRoutes.js)
- [routes/appointmentRoutes.js](routes/appointmentRoutes.js)
- [routes/queueRoutes.js](routes/queueRoutes.js)

Supporting logic:

- [services/queueService.js](services/queueService.js)
- [middleware/authMiddleware.js](middleware/authMiddleware.js)
- [utils/auth.js](utils/auth.js)
- [public/api-playground.html](public/api-playground.html)

## Database Model

Core tables used by the backend:

- `departments`
- `patients`
- `patient_accounts`
- `staff_accounts`
- `staff_department_assignments`
- `appointments`
- `queue`
- `workflow_events`

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
npm.cmd run dev
```

Data state commands:

```powershell
npm.cmd run empty-run
npm.cmd run complete-run
npm.cmd run test:e2e:smoke
npm.cmd run test:e2e:full
```

Default local URL:

- `http://localhost:5000`

Useful checks:

- `http://localhost:5000/`
- `http://localhost:5000/test-db`
- `http://localhost:5000/playground`

## Environment Variables

Create [`.env`](.env) using [.env.example](.env.example).

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
AUTH_TOKEN_SECRET=change_this_to_a_long_random_secret
HOSPITAL_TIMEZONE=Asia/Kolkata
QUEUE_HOUSEKEEPING_ENABLED=true
QUEUE_HOUSEKEEPING_INTERVAL_MINUTES=15
OPD_START_TIME=09:30
OPD_END_TIME=21:30
```

Hosted setups can use:

- `DATABASE_URL`
- `ML_SERVICE_URL`
- `OTP_PREVIEW_ENABLED=false`

## Demo Staff Credentials (Seeded By ensureSchema)

These users are auto-seeded in current `final` branch bootstrap.

Shared passwords:
- Receptionist: `sqrecp123`
- All nurses: `sqnurse123`
- All doctors: `sqdoc123`

Reception:
- `receptionist01` -> Anita Reddy

Nurses:
- `nurse01` -> Sujatha Rao (All Departments)

Doctors:
- `doctor01` -> Dr. S. Mehta (General Medicine)
- `doctor_cardio01` -> Dr. Priya Menon (Cardiology)
- `doctor_ortho01` -> Dr. Vikram Singh (Orthopedics)
- `doctor_pedia01` -> Dr. Ananya Rao (Pediatrics)
- `doctor_emg01` -> Dr. Farhan Ali (Emergency)

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
- token numbers are unique per department per operational day (not globally unique forever)
- patient lookup prioritizes patient ID/mobile before token-only fallback
- patient-facing queue status updates are consumed by frontend polling
- frontend validation exists for better UX, but backend validates again for safety
- `OTP_PREVIEW_ENABLED` is only for demo/local testing and should be disabled in production-like use
- staff passwords support hashed storage (`pbkdf2`) with legacy plain-text auto-upgrade on successful login
- OTP expiry validation is DB-time based (`CURRENT_TIMESTAMP`) to avoid timezone drift bugs
- preferred slot is optional (no slot selected by default)
- if preferred date+time is provided, advance booking is allowed only when pain scale is 5 or below
- nurse triage and ready-for-doctor actions are allowed only when queue status is `in-progress`

## Future Backend Improvements

- audit logs for every queue state change
- absent / recall / transfer-department endpoints
- doctor test orders and follow-up endpoints
- ABHA-linked identity and consent flows
- family member linking and dependent management
- better analytics and reporting APIs

## Related Docs

- [Root README](../README.md)
- [Workflows](../docs/WORKFLOWS.md)
- [Demo Case Studies](../docs/DEMO_CASE_STUDIES.md)
