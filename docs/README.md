# SwasthyaQueue Docs

This folder contains the product and workflow documentation for SwasthyaQueue.

Use these documents when you want to understand:

- how the system is intended to work
- how to explain it in a demo
- why this digitization matters in Indian OPD settings
- where the product can go next

## Files In This Folder

Run-state helpers (from `backend/`) for demos:

- `npm.cmd run empty-run` -> clear all operational records
- `npm.cmd run complete-run` -> load full baseline + rush demo dataset
- `npm.cmd run test:e2e:smoke` -> automated API workflow verification

Current hardening highlights (already implemented):

- department-scoped staff visibility and write authorization
- department-specific nurse triage required fields
- stable queue workflow guards (clear 409 errors for wrong-state actions)
- optional preferred-slot booking support (no slot selected by default; advance slot allowed only for pain level <= 5)

Current final-branch role setup:

- 1 receptionist account
- 5 nurse accounts (department-specific)
- 5 doctor accounts (department-specific)
- DB-backed staff-to-department assignments and scoped dashboards

Credential source:

- See [Root README demo credential section](../README.md)
- See [Backend README seeded credentials](../backend/README.md)

### [WORKFLOWS.md](WORKFLOWS.md)

Use this when you want the operational flow.

It covers:

- patient self-service flow
- receptionist-assisted flow
- rush-case quick intake flow
- nurse triage flow
- doctor consultation flow
- display/lobby flow

### [DEMO_CASE_STUDIES.md](DEMO_CASE_STUDIES.md)

Use this when you want demo storytelling.

It includes:

- example patient cases by department
- end-to-end visit narratives
- why queue visibility and digitization matter in each case
- intent and impact for live demo explanation

### [MANUAL_CASE_RUNBOOK.md](MANUAL_CASE_RUNBOOK.md)

Use this when you want deterministic manual demo execution.

It includes:

- department-wise case seeds and expected outcomes
- step-by-step reception to doctor walkthrough
- triage validation notes (including Fahrenheit vitals)
- quick verification checklist for live presentation runs

### [FLOW_DIAGRAMS.md](FLOW_DIAGRAMS.md)

Use this when you want quick visual explanation.

It includes:

- system architecture flow
- patient flow
- receptionist flow
- nurse flow
- doctor flow
- rush-case flow
- queue/display flow

## Suggested Reading Order

If you are new to the project:

1. [Root README](../README.md)
2. [FLOW_DIAGRAMS.md](FLOW_DIAGRAMS.md)
3. [WORKFLOWS.md](WORKFLOWS.md)
4. [DEMO_CASE_STUDIES.md](DEMO_CASE_STUDIES.md)
5. [MANUAL_CASE_RUNBOOK.md](MANUAL_CASE_RUNBOOK.md)
6. [Backend README](../backend/README.md)
7. [Frontend README](../frontend/README.md)
8. [ML Service README](../ml-service/README.md)

## Documentation Purpose

This folder is meant to bridge two things:

- engineering understanding
- hospital/product understanding

The repo is no longer just a coding exercise. The docs here help explain:

- who uses the system
- what they do
- what pain points it solves
- what future real-world features matter most

## Future Docs To Add

- ABHA integration concept note
- role permissions matrix
- patient privacy and consent model
- admin reporting requirements
- hospital deployment checklist
