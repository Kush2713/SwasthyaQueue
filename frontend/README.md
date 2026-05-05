# SwasthyaQueue Frontend

This is the Next.js frontend for SwasthyaQueue.

It is the user-facing layer of the project and is designed around role-based hospital workflows.

It includes UI flows for:

- patient login and booking
- patient dashboard and token view
- receptionist dashboard
- nurse triage workspace
- doctor consultation workspace
- shared patient case page
- live display board

## What This Frontend Is Responsible For

The frontend provides the working surfaces for different hospital users.

It does not own the business rules. Instead, it:

- captures user input
- presents live queue and visit state
- shows role-specific dashboards
- helps hospital teams work faster with fewer repeated steps
- calls backend APIs for all real workflow changes

## Role Surfaces

### Patient

Main screens:

- login/signup with OTP
- dashboard
- book visit
- review and confirm
- token page

Patient can:

- create account
- login using OTP
- book a visit
- see active appointment
- cancel active appointment
- view history
- see short live queue updates (called to triage, called to consultation, visit completed)

### Receptionist

Main screen:

- receptionist dashboard

Reception can:

- search by token, patient name, or mobile
- answer wait-time questions
- quick intake rush cases
- create staff-assisted accounts
- call next
- open case page
- flag urgent review
- view only assigned departments (from staff assignment)

### Nurse

Main screens:

- clinical dashboard in nurse mode
- patient case page

Nurse can:

- triage waiting patients
- enter vitals
- add triage notes
- approve urgency escalation
- mark ready for doctor
- triage fields adapt to department-required clinical inputs

### Doctor

Main screens:

- clinical dashboard in doctor mode
- patient case page

Doctor can:

- open patients ready for consultation
- review symptoms and triage context
- add diagnosis
- add prescription/advice
- add doctor notes
- complete visit
- sees only assigned-department consultation queue

### Display / Lobby

Main screen:

- live queue display

Purpose:

- public queue visibility
- department-wise queue awareness
- lobby communication support

## Main Frontend Routes

- `/`
- `/patient/dashboard`
- `/patient/book`
- `/patient/token`
- `/reception/dashboard`
- `/staff/dashboard` for nurse and doctor workspaces
- `/case/queue/:queueId`
- `/display`
- `/tv`

## Install

```powershell
npm.cmd install
```

## Run

```powershell
npm.cmd run dev
```

Default dev URL:

- `http://localhost:3001`

Optional:

```powershell
$env:PORT='3000'
npm.cmd run dev
```

## Quick Integration Check

Before opening frontend pages, make sure backend is running at:

- `http://127.0.0.1:5000`

Then use backend data helpers for easy demos:

```powershell
cd ../backend
npm.cmd run empty-run
# or
npm.cmd run complete-run
```

## Build

```powershell
npm.cmd run build
```

## Environment

Create `.env.local` from `.env.example`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000
NEXT_PUBLIC_OTP_PREVIEW=true
NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-project-ref>.supabase.co
NEXT_PUBLIC_STAFF_POLL_MS=10000
NEXT_PUBLIC_RECEPTION_POLL_MS=20000
NEXT_PUBLIC_PATIENT_POLL_MS=30000
NEXT_PUBLIC_DISPLAY_POLL_MS=10000
NEXT_PUBLIC_PATIENT_NOTICE_MS=40000
NEXT_PUBLIC_OPD_START_TIME=09:30
NEXT_PUBLIC_OPD_END_TIME=21:30
NEXT_PUBLIC_OPD_SLOT_INTERVAL_MINUTES=30
```

Google sign-in note:
- Frontend uses `NEXT_PUBLIC_SUPABASE_URL` to start OAuth.
- Never store secrets in frontend env; only public URL values belong here.

## Important Frontend Files

- `src/frontend/AppRouter.jsx`
- `src/frontend/lib/api.js`
- `src/frontend/pages/LoginPage.jsx`
- `src/frontend/pages/patient/PatientDashboard.jsx`
- `src/frontend/pages/patient/PatientRegistration.jsx`
- `src/frontend/pages/patient/PatientTokenPage.jsx`
- `src/frontend/pages/reception/ReceptionDashboard.jsx`
- `src/frontend/pages/staff/StaffDashboard.jsx`
- `src/frontend/pages/case/PatientCasePage.jsx`
- `src/frontend/pages/display/LiveQueueDisplay.jsx`
- `scripts/dev-direct.mjs`

## Frontend Architecture Notes

- the frontend uses Next.js as the app shell
- role-based workflow pages live under `src/frontend/pages`
- React Router handles in-app route flow
- the API layer in `src/frontend/lib/api.js` centralizes backend communication
- the case page acts as the shared patient/visit view across roles
- patient profile flow now uses a single contact field (mobile) in booking/signup UX
- staff dashboards are scoped by `assignedDepartmentIds` from authenticated session

## Practical Notes

- the frontend uses a direct dev launcher to avoid the Windows `spawn EPERM` issue seen with default `next dev`
- the app is role-driven, but backend authorization is still not fully production-hardened
- dashboards and case page depend on the backend APIs being available
- for full workflows, demo cases, and future roadmap, see:
  - [Root README](../README.md)
  - [Docs README](../docs/README.md)

## Suggested Future Frontend Improvements

- stronger responsive behavior for hospital tablets
- better clinical workspace keyboard-first interactions
- more structured doctor consultation forms
- better patient history visualization
- ABHA-linked patient identity and family member flows
- stronger accessibility and multilingual support
