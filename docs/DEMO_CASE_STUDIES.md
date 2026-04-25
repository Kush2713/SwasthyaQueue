# SwasthyaQueue Clinical Demo Cases

This document is a presentation-ready case catalog for showing real OPD workflows.

Each case is written to show full continuity:

- reception intake or lookup
- nurse triage and escalation
- doctor consultation and closure
- patient-visible history continuity

## Demo Catalog At A Glance

| Case ID | Department | Scenario | Entry Path | Priority Path | Outcome To Show |
| --- | --- | --- | --- | --- | --- |
| GM-01 | General Medicine | Returning fever case | Patient self-booking | Normal to ready-for-doctor | History continuity and faster repeat visit |
| CD-01 | Cardiology | Chest discomfort walk-in | Quick intake by reception | High to critical escalation | Urgent handling does not wait in normal line |
| OR-01 | Orthopedics | No-phone walk-in knee injury | Staff-assisted account | Normal with triage notes | Trackable record even without patient phone |
| PD-01 | Pediatrics | Child with cough and fever | Parent assisted at reception | Normal pediatric triage | Follow-up ready pediatric history |
| EM-01 | Emergency | Breathlessness at gate | Quick intake first | Critical fast-track | Queue first, paperwork later |
| LU-01 | Cross-department lookup | Duplicate names in OPD | Reception lookup by mobile or token | Correct patient disambiguation | Right record opened without confusion |
| RV-01 | Return visit continuity | Same patient revisits after 10 days | Patient OTP login and booking | Guided by prior notes | Doctor sees previous diagnosis and advice |
| ABHA-F1 | Future extension | ABHA-consented continuity | Identity link and consent | Clinical context enrichment | Reduced re-entry and stronger longitudinal care |
| FAM-F1 | Future extension | Daughter booking for parent | Family and dependent linking | Caregiver-assisted workflow | Real Indian household care model support |

## 1. GM-01 | General Medicine | Returning Fever Case

### Scenario
A patient with prior OPD history returns with fever, weakness, and body pain.

### Current hospital pain
- patient repeats profile details every visit
- prior notes are not visible at first touchpoint
- reception cannot answer wait clearly

### Demo flow
1. Patient logs in with OTP and starts new OPD registration.
2. Profile summary is auto-filled from existing account.
3. Symptoms are submitted and token is generated.
4. Reception answers wait status from queue board and patient lookup.
5. Nurse records vitals and triage notes.
6. Nurse marks ready for doctor.
7. Doctor records diagnosis, prescription, and follow-up advice.
8. Visit appears in patient history.

### What to highlight on screen
- profile reuse and reduced data repetition
- triage-to-doctor handoff status
- completed consultation in history timeline

## 2. CD-01 | Cardiology | Chest Discomfort Walk-In

### Scenario
A middle-aged patient reports chest discomfort and dizziness at reception.

### Current hospital pain
- urgent but conscious patients can get delayed in standard queue
- escalation trail is verbal, not auditable

### Demo flow
1. Reception uses quick intake to immediately create queue case.
2. Reception flags urgent review with reason.
3. Nurse sees urgent card, captures vitals, and raises priority to critical.
4. Nurse marks ready for doctor.
5. Doctor sees high-priority consult card and completes consultation.

### What to highlight on screen
- urgent review signal from reception to nurse
- nurse-approved priority override
- reduced delay for potentially serious symptoms

## 3. OR-01 | Orthopedics | No-Phone Walk-In

### Scenario
A laborer with knee swelling has no smartphone and no email access.

### Current hospital pain
- registration fails when digital identity assumptions are strict
- patient cannot be traced in follow-up

### Demo flow
1. Reception creates staff-assisted patient account.
2. Internal assisted reference is stored against patient profile.
3. Reception books orthopedic visit and adds queue entry.
4. Nurse captures pain score and mobility notes.
5. Doctor records diagnosis, medication advice, and revisit note.

### What to highlight on screen
- inclusive onboarding without phone dependency
- one shared longitudinal record across staff roles

## 4. PD-01 | Pediatrics | Child Visit With Caregiver

### Scenario
A caregiver brings a child with cough and intermittent fever.

### Current hospital pain
- child records are fragmented across visits
- caregiver repeats details every time

### Demo flow
1. Reception searches existing child record by mobile, name, or token.
2. New pediatric visit is registered.
3. Nurse records pediatric vitals and triage observation.
4. Doctor completes consultation with dosage and care guidance.
5. Parent returns later with faster continuity.

### What to highlight on screen
- child visit record continuity
- practical handoff from front desk to clinician

## 5. EM-01 | Emergency | Breathlessness At Arrival

### Scenario
A patient arrives with acute breathlessness and cannot complete paperwork first.

### Current hospital pain
- registration-first process delays clinical attention
- later paperwork causes missing data

### Demo flow
1. Reception performs quick intake with minimum mandatory details.
2. Patient is pushed to emergency queue immediately.
3. Nurse enters triage vitals and critical notes.
4. Priority is escalated and patient marked ready for doctor.
5. Doctor handles consultation first; profile enrichment happens after stabilization.

### What to highlight on screen
- clinical first-response flow
- safe deferral of non-critical admin data

## 6. LU-01 | Reception Lookup Accuracy | Duplicate Names

### Scenario
Two patients with the same name are present in OPD operations.

### Current hospital pain
- wrong patient file can be opened in crowded desk conditions

### Demo flow
1. Reception searches by name.
2. Multiple matches are shown with patient ID and queue context.
3. Reception confirms by mobile or emergency contact.
4. Correct case is opened for action.

### What to highlight on screen
- disambiguation by patient ID, mobile, and token
- reduced wrong-record risk

## 7. RV-01 | Return Visit Continuity

### Scenario
The same patient returns after prior treatment and needs review.

### Demo flow
1. Patient logs in with OTP and books a new visit.
2. Doctor opens current case and views recent visit context.
3. New consultation updates diagnosis and follow-up plan.
4. History now shows previous and current visit sequence.

### What to highlight on screen
- continuity of care, not isolated tickets
- better follow-up quality

## 8. ABHA-F1 | ABHA-Consented Continuity (Future)

### Scenario
Patient opts to link ABHA-based identity and records with consent.

### Future flow
1. Patient verifies identity and grants consent.
2. Local profile is linked to ABHA context.
3. OPD booking reuses verified profile elements.
4. Doctor sees richer longitudinal context.

### Demo message
SwasthyaQueue evolves from token management to digital OPD continuity infrastructure.

## 9. FAM-F1 | Family-Linked Booking (Future)

### Scenario
An adult child manages OPD bookings for an elderly parent.

### Future flow
1. Primary user is verified.
2. Parent profile is linked as dependent.
3. Booking and follow-up happen under caregiver flow.
4. Clinical data stays separated per patient, access governed by consent.

### Demo message
Matches real Indian family care patterns while preserving clinical record integrity.

## Suggested Live Demo Order (25-35 Minutes)

1. GM-01 for baseline full workflow.
2. LU-01 to show safe patient lookup in crowd conditions.
3. CD-01 or EM-01 to show urgent escalation logic.
4. OR-01 for inclusivity without phone dependence.
5. RV-01 for continuity and history value.
6. ABHA-F1 and FAM-F1 as roadmap close.

## Core Narrative For Stakeholders

SwasthyaQueue is not only a queue display system. It is an OPD workflow platform that improves:

- reception control and lookup accuracy
- nurse triage structure and escalation safety
- doctor handoff quality and consultation context
- patient continuity across visits
- readiness for ABHA-linked and family-linked care journeys

Use [MANUAL_CASE_RUNBOOK.md](/D:/Study/Learning/Projects/SwasthyaQueue/docs/MANUAL_CASE_RUNBOOK.md) for full step-by-step manual execution with unique patient details for every case.
