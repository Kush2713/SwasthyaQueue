# SwasthyaQueue Workflows

This document explains how each role is expected to use the system.

## 1. Patient Self-Service Workflow

1. Patient signs up using mobile/email and OTP.
2. Patient lands on the dashboard.
3. Patient books a visit by entering current symptoms.
   - same-day slot is allowed only if it is in the future (next hour onward) and within OPD hours
4. Patient reviews and confirms.
5. Token is generated.
6. Patient tracks queue state on dashboard.
7. After consultation, visit moves into history.

Why this helps:

- no repeated registration every time
- patient can return later and see previous visits
- active appointment is clearly visible

## 2. Reception Workflow

Reception is the operational control desk.

Main actions:

- patient lookup
- wait-time explanation
- call next
- quick intake
- assisted account creation
- open patient case
- urgent review flagging
- department-scoped operations based on receptionist assignment map

### Normal desk flow

1. Search patient by token, mobile, or name.
2. If found, continue using existing patient/case.
3. If not found:
   - create assisted account, or
   - use quick intake
4. Track queue board by department.
5. Call next patient for the department.

### Rush-case flow

1. Use quick intake.
2. Add patient to queue immediately.
3. Finish detailed profile later from case page.

Why this helps:

- less line pressure at front desk
- faster intake under rush
- better queue visibility for lobby

## 3. Nurse Workflow

Nurse work should be triage-first, not queue-manager-first.

Main actions:

- view urgent review requests
- select patient for triage
- record vitals
- record triage notes
- approve high / critical escalation
- mark ready for doctor
- triage fields required by department profile (for example Pediatrics requires weight)

### Intended nurse flow

1. Open triage workspace.
2. Select urgent patient or next triage patient.
3. Record:
   - temperature
   - BP
   - pulse
   - SpO2
   - weight
4. Add triage notes.
   - if queue is still `waiting`, triage is blocked until reception calls patient (must be `in-progress`)
5. Escalate if required.
6. Mark patient ready for doctor.

Why this helps:

- clear handoff from reception to doctor
- structured vitals instead of verbal transfer
- urgent cases become visible and auditable

## 4. Doctor Workflow

Doctor workflow should focus on patient history and consultation, not queue management.

Main actions:

- open patient from consultation list
- review symptoms and triage
- review patient case and history
- record diagnosis
- record prescription/advice
- complete visit
- department-scoped consultation list based on doctor assignment map

### Intended doctor flow

1. Open consultation workspace.
2. Select patient ready for consultation.
3. Review:
   - symptoms
   - vitals
   - triage notes
   - patient history
4. Record diagnosis.
5. Record prescription/advice.
6. Complete visit.

Why this helps:

- better continuity of care
- fewer missed handoff details
- visit closure is structured

## 5. Shared Case Page

The case page is the shared patient record workspace.

### Reception sees

- profile
- visit basics
- can complete missing profile details

### Nurse sees

- profile
- current visit
- vitals/triage
- history context

### Doctor sees

- symptoms
- triage context
- diagnosis/prescription sections
- visit history

## 6. Public Display Workflow

The display board is for lobby visibility.

It should help:

- patients know current token movement
- attendants estimate wait
- reduce crowding at reception

## 7. Future Real-Life Workflow Additions

### ABHA-linked patient verification

Possible future flow:

1. Patient verifies ABHA identity.
2. Hospital links local patient record after consent.
3. Existing clinical data becomes easier to trace.

### Family member/dependent flow

Possible future flow:

1. Primary patient verifies identity.
2. Adds family member after consent/verification.
3. Books and tracks dependent visits.

### Post-consultation continuity

Future additions:

- test/lab orders
- medicines with dosage
- revisit date
- follow-up reminders
- family-visible records where authorized
