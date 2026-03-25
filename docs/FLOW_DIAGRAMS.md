# SwasthyaQueue Flow Diagrams

This document gives visual workflow diagrams for explaining SwasthyaQueue to:

- teammates
- mentors
- evaluators
- hospital stakeholders
- demo audiences

These are written in Mermaid so they are easy to edit and can later be exported as images if needed.

## 1. System Overview

```mermaid
flowchart LR
    P["Patient"] --> F["Frontend"]
    R["Receptionist"] --> F
    N["Nurse"] --> F
    D["Doctor"] --> F
    L["Lobby Display"] --> F

    F --> B["Backend API"]
    B --> DB["PostgreSQL"]
    B --> ML["ML Triage Service"]
```

## 2. Patient Self-Service Flow

```mermaid
flowchart TD
    A["Patient opens app"] --> B["Signup or OTP login"]
    B --> C["Patient Dashboard"]
    C --> D["Book New Visit"]
    D --> E["Enter symptoms and visit details"]
    E --> F["Review and Confirm"]
    F --> G["Appointment + Queue entry created"]
    G --> H["Token generated"]
    H --> I["Return to Dashboard"]
    I --> J["Track active visit and history"]
```

## 3. Receptionist Assisted Flow

```mermaid
flowchart TD
    A["Patient arrives at front desk"] --> B{"Existing patient?"}
    B -->|Yes| C["Search by token, mobile, or name"]
    B -->|No| D{"Normal or rush?"}
    D -->|Normal| E["Create assisted patient account"]
    D -->|Rush| F["Quick Intake"]

    C --> G["Open patient case or continue existing visit"]
    E --> H["Create appointment / booking"]
    F --> I["Add directly to queue"]

    H --> J["Queue token created"]
    I --> J
    G --> J

    J --> K["Reception answers wait-time questions"]
    K --> L["Reception calls next patient"]
```

## 4. Nurse Triage Flow

```mermaid
flowchart TD
    A["Reception flags urgent review or patient reaches triage"] --> B["Nurse Workbench"]
    B --> C["Select patient"]
    C --> D["Review symptoms and patient context"]
    D --> E["Record vitals"]
    E --> F["Add triage notes"]
    F --> G{"Urgency change needed?"}
    G -->|Yes| H["Mark High or Critical"]
    G -->|No| I["Keep current priority"]
    H --> J["Mark Ready For Doctor"]
    I --> J
    J --> K["Patient moves to doctor consultation list"]
```

## 5. Doctor Consultation Flow

```mermaid
flowchart TD
    A["Patient marked Ready For Doctor"] --> B["Doctor Consultation Workspace"]
    B --> C["Select patient"]
    C --> D["Review symptoms, vitals, triage notes, and history"]
    D --> E["Enter diagnosis"]
    E --> F["Enter prescription / advice"]
    F --> G["Add doctor notes"]
    G --> H["Complete visit"]
    H --> I["Visit moves to history"]
```

## 6. Shared Patient Case Page

```mermaid
flowchart LR
    R["Receptionist"] --> C["Shared Patient Case"]
    N["Nurse"] --> C
    D["Doctor"] --> C

    C --> P1["Patient profile"]
    C --> P2["Current visit"]
    C --> P3["Queue + token context"]
    C --> P4["Triage details"]
    C --> P5["Doctor consultation details"]
    C --> P6["Past visit history"]
```

## 7. Queue and Lobby Display Flow

```mermaid
flowchart TD
    A["Appointment or Quick Intake created"] --> B["Queue entry created"]
    B --> C["Reception dashboard updates"]
    B --> D["Patient dashboard updates"]
    B --> E["Lobby display updates"]
    C --> F["Reception calls next"]
    F --> G["Patient status changes"]
    G --> D
    G --> E
    G --> H["Nurse / Doctor continue care flow"]
```

## 8. Rush Case Flow

```mermaid
flowchart TD
    A["Rush patient arrives"] --> B["Reception uses Quick Intake"]
    B --> C["Minimal details only"]
    C --> D["Patient enters queue immediately"]
    D --> E["Nurse triage refines urgency"]
    E --> F["Doctor consultation follows"]
    F --> G["Reception can complete profile later if needed"]
```

## 9. Why This System Helps

```mermaid
flowchart LR
    T1["Traditional OPD"] --> P1["Repeated form filling"]
    T1 --> P2["No queue visibility"]
    T1 --> P3["Hard to explain wait time"]
    T1 --> P4["Weak continuity across roles"]

    S1["SwasthyaQueue"] --> G1["Single patient journey"]
    S1 --> G2["Role-based dashboards"]
    S1 --> G3["Visible queue + token flow"]
    S1 --> G4["Shared case record"]
    S1 --> G5["Faster rush-case handling"]
```

## 10. Case Study Coverage

Yes, case studies are still useful even with diagrams.

Use diagrams to explain:

- structure
- movement of data
- role interaction

Use case studies to explain:

- why this matters in real hospitals
- what happens in a cardiology case vs emergency case
- what pain points are solved in each department

Best combination for demo:

1. show one system overview diagram
2. show one role flow diagram
3. present one department case study
4. then run the live demo

## Suggested Presentation Order

1. System Overview
2. Receptionist Assisted Flow
3. Nurse Triage Flow
4. Doctor Consultation Flow
5. Rush Case Flow
6. One or two case studies from [DEMO_CASE_STUDIES.md](DEMO_CASE_STUDIES.md)

## Related Docs

- [Docs README](README.md)
- [Workflows](WORKFLOWS.md)
- [Demo Case Studies](DEMO_CASE_STUDIES.md)
- [Root README](../README.md)
