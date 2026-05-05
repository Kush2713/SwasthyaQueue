# SwasthyaQueue Manual Case Runbook

This runbook is for manual demo/testing only.

All patient names below are unique.  
No auto-seeding is required.

## 0. Start Clean (Local Only)

Run from [backend](/D:/Study/Learning/Projects/SwasthyaQueue/backend):

```powershell
npm.cmd run empty-run
```

Optional ready-made showcase dataset (recommended for quick demos):

```powershell
npm.cmd run showcase-run
```

This seeds 20 patients total:
- 5 departments
- for each department: 1 normal queue + 1 quick-intake + 1 staff-assisted + 1 completed
- plus 5 future-date advance-booking queue entries (one per department)

Future-date validation:
1. Open Reception dashboard and set `Queue Date` to tomorrow.
2. Verify future advance-booking rows appear there.
3. Open Nurse/Doctor dashboards with current date.
4. Verify those future entries do not show in active clinical queues.

## 1. Shared Execution Pattern (Use For Every Case)

1. Patient signup or reception intake using case details.
2. Create appointment in the mentioned department.
3. Confirm token appears in Reception queue board.
4. Nurse records triage (Temp in Fahrenheit, BP, Pulse, SpO2, Weight, notes).
5. If case says urgent/critical, do `Flag Urgent Review` and priority escalation.
6. Nurse clicks `Ready For Doctor` where applicable.
7. Doctor opens case, adds diagnosis/prescription/tests/follow-up.
8. Complete visit for completed-case scenarios.
9. Verify patient lookup and history.

## 2. Case Matrix (25 Cases)

| Case ID | Department | Patient Name | Mobile | Type | Expected Status End |
| --- | --- | --- | --- | --- | --- |
| GM-01 | General Medicine | Neha Reddy | 9000011111 | Normal waiting | waiting |
| GM-02 | General Medicine | Arjun Dev | 9000011112 | Urgent waiting | waiting |
| GM-03 | General Medicine | Kavya Menon | 9000011113 | Ready for doctor | ready-for-doctor |
| GM-04 | General Medicine | Rahul Joshi | 9000011114 | In consultation | in-progress |
| GM-05 | General Medicine | Priya Nair | 9000011115 | Completed visit | completed |
| CD-01 | Cardiology | Imran Shaikh | 9000022221 | Normal waiting | waiting |
| CD-02 | Cardiology | Sahana Iyer | 9000022222 | Urgent waiting | waiting |
| CD-03 | Cardiology | Vivek Rana | 9000022223 | Ready for doctor | ready-for-doctor |
| CD-04 | Cardiology | Meenal Arora | 9000022224 | In consultation | in-progress |
| CD-05 | Cardiology | Yusuf Ali | 9000022225 | Completed visit | completed |
| OR-01 | Orthopedics | Nitin Kulkarni | 9000033331 | Normal waiting | waiting |
| OR-02 | Orthopedics | Gauri Patil |  | Staff-assisted no-phone | waiting |
| OR-03 | Orthopedics | Darshan Rao | 9000033333 | Ready for doctor | ready-for-doctor |
| OR-04 | Orthopedics | Tanvi Shah | 9000033334 | In consultation | in-progress |
| OR-05 | Orthopedics | Harish Pillai | 9000033335 | Completed visit | completed |
| PD-01 | Pediatrics | Aarav Singh | 9000044441 | Normal waiting | waiting |
| PD-02 | Pediatrics | Isha Kapoor | 9000044442 | Urgent waiting | waiting |
| PD-03 | Pediatrics | Ritesh Verma | 9000044443 | Ready for doctor | ready-for-doctor |
| PD-04 | Pediatrics | Naina Thomas | 9000044444 | In consultation | in-progress |
| PD-05 | Pediatrics | Omkar Das | 9000044445 | Completed visit | completed |
| EM-01 | Emergency | Farhan Khan | 9000055551 | Normal waiting | waiting |
| EM-02 | Emergency | Latha Subramani | 9000055552 | Urgent waiting | waiting |
| EM-03 | Emergency | Dev Malhotra | 9000055553 | Ready for doctor | ready-for-doctor |
| EM-04 | Emergency | Pooja Bedi | 9000055554 | In consultation | in-progress |
| EM-05 | Emergency | Kiran Shetty | 9000055555 | Completed visit | completed |

## 3. Department-Wise Detailed Steps

## General Medicine (GM-01 to GM-05)

### GM-01
- Symptoms: fever, body ache, weakness
- Pain scale: 3
- Triage: Temp 100.4 F, BP 118/78, Pulse 92, SpO2 98, Weight 58
- Nurse note: low-grade fever for 2 days
- Doctor: viral febrile illness, paracetamol + hydration

### GM-02 (Urgent)
- Symptoms: persistent fever with dizziness
- Pain scale: 6
- Reception action: flag urgent review
- Triage: Temp 101.2 F, BP 126/84, Pulse 104, SpO2 97, Weight 63
- Nurse escalation: high priority

### GM-03 (Ready For Doctor)
- Symptoms: throat pain and fever
- Pain scale: 4
- Triage saved + mark ready for doctor
- Keep case in ready-for-doctor list for demo handoff

### GM-04 (In Consultation)
- Symptoms: fatigue with palpitations
- Pain scale: 5
- Call next and move to in-consultation
- Keep doctor form open without completion

### GM-05 (Completed)
- Symptoms: follow-up after 3 days
- Full cycle: triage -> ready -> doctor note -> complete visit

## Cardiology (CD-01 to CD-05)

### CD-01
- Symptoms: chest heaviness on exertion
- Pain scale: 4
- Keep as normal waiting

### CD-02 (Urgent)
- Symptoms: chest tightness and sweating
- Pain scale: 8
- Reception urgent flag + nurse escalation to critical

### CD-03
- Symptoms: intermittent palpitations
- Triage complete, mark ready for doctor, keep pending consult

### CD-04
- Symptoms: chest pain with breathlessness
- Move to in-consultation

### CD-05
- Scenario: hypertension follow-up
- Complete consultation with tests ordered (ECG/CBC as needed)

## Orthopedics (OR-01 to OR-05)

### OR-01
- Symptoms: knee pain while climbing stairs
- Normal waiting flow

### OR-02 (No phone assisted)
- Use receptionist `Staff-Assisted Patient Account`
- Leave mobile blank
- Symptoms: ankle swelling after twist injury

### OR-03
- Symptoms: low back pain radiating to leg
- Triage + ready-for-doctor handoff

### OR-04
- Symptoms: shoulder injury with restricted movement
- Move to in-consultation

### OR-05
- Scenario: post-cast follow-up
- Full cycle completed

## Pediatrics (PD-01 to PD-05)

### PD-01
- Child cough + fever, normal waiting

### PD-02 (Urgent)
- Child vomiting and weakness
- Urgent flag + high priority triage

### PD-03
- Child high fever with throat infection
- Mark ready-for-doctor

### PD-04
- Child wheeze and breathing discomfort
- Keep in-consultation for doctor queue view

### PD-05
- Pediatric follow-up completion case

## Emergency (EM-01 to EM-05)

### EM-01
- Symptoms: abdominal pain + nausea
- Normal emergency queue case

### EM-02 (Urgent)
- Symptoms: acute dizziness and sweating
- Immediate urgent review + escalation

### EM-03
- Symptoms: high fever with dehydration
- Triage complete + ready-for-doctor

### EM-04
- Symptoms: severe breathlessness
- In-consultation case

### EM-05
- Stabilized emergency revisit
- Complete full doctor closure

## 4. Lookup + Edge Checks

After creating all 25:

1. Reception lookup by:
- token
- patient ID
- mobile
- name
- emergency contact
2. Verify OR-02 is discoverable via name/patient ID (no mobile).
3. Verify each department has:
- 2 waiting
- 1 ready-for-doctor
- 1 in-consultation
- 1 completed

## 5. Final Review Checklist

1. No duplicate names across current dataset.
2. No raw API HTML errors in UI.
3. Triage accepts Fahrenheit values like `100.4`.
4. Ready-for-doctor handoff visible to doctor.
5. Completed visits appear in patient history.
