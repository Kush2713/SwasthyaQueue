# SwasthyaQueue ML Service

This folder contains the Python ML support service used by SwasthyaQueue.

Its current role is narrow and practical:

- accept triage-related input
- return a suggested urgency / priority signal
- support the backend when assigning queue priority

It is an assistant to workflow, not the owner of workflow.

## What This Service Does

The ML service helps estimate urgency using structured patient input such as:

- age
- pain scale
- symptom code

The backend calls this service and then decides how to use that prediction.

Important:

- backend still owns queue persistence
- backend still owns fallback logic
- hospital workflow must continue even if ML is unavailable

## Current Files

- [app.py](app.py)
  Flask app and prediction endpoint
- [train_model.py](train_model.py)
  training/export utility for the model
- [triage_model.pkl](triage_model.pkl)
  serialized trained model
- [requirements.txt](requirements.txt)
  Python dependencies

## Local Run

From this folder:

```powershell
python -m pip install -r requirements.txt
python app.py
```

Default local URL:

- `http://localhost:5001`

Quick check:

- `http://localhost:5001`

Expected response:

- `ML API Running...`

## How It Fits Into The System

```text
Frontend -> Backend -> ML Service
```

The frontend does not call this service directly.

The backend may call ML while:

- creating a normal appointment
- assigning a queue priority

In practice:

- normal OPD booking can use ML assistance
- quick intake is more expedited and operationally driven
- nurse triage may later refine urgency regardless of initial ML suggestion

## Why Keep It Separate

Current advantages:

- isolated Python dependencies
- easier model retraining without touching backend logic
- clear separation between workflow engine and predictive helper

Tradeoff:

- one extra service to run locally and host

For a future simpler deployment, this logic could be merged into the backend if needed.

## Current Practical Limits

This is not yet a full clinical decision-support system.

It currently:

- supports triage assistance only
- does not replace nurse judgment
- does not replace doctor decision making
- should not be treated as final clinical truth

## Suggested Real-Life Future Improvements

- better symptom encoding
- broader structured intake features
- retraining from real anonymized visit outcomes
- confidence score in response
- explainability or reason tags
- department-specific triage logic
- pediatric / emergency specific models
- ABHA-linked longitudinal signal input where consent allows

## Safety Principle

Use ML to assist:

- queue prioritization
- front-desk guidance
- early triage hints

Do not use ML to decide:

- final diagnosis
- prescriptions
- discharge
- emergency outcome without clinician review

## Related Docs

- [Root README](../README.md)
- [Backend README](../backend/README.md)
- [Workflows](../docs/WORKFLOWS.md)
