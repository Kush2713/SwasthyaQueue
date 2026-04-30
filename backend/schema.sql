CREATE DATABASE swasthyaqueue;

\c swasthyaqueue;

CREATE TABLE IF NOT EXISTS departments (
  department_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  avg_consult_time INTEGER NOT NULL CHECK (avg_consult_time > 0)
);

CREATE TABLE IF NOT EXISTS patients (
  patient_id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 0),
  gender VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(160),
  address TEXT,
  emergency_contact VARCHAR(20),
  blood_group VARCHAR(10),
  allergies TEXT,
  chronic_conditions TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_accounts (
  account_id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL UNIQUE REFERENCES patients(patient_id) ON DELETE CASCADE,
  email VARCHAR(160) UNIQUE,
  mobile VARCHAR(20) UNIQUE,
  account_source VARCHAR(20) NOT NULL DEFAULT 'self',
  created_by_role VARCHAR(30),
  created_by_name VARCHAR(120),
  assisted_reference VARCHAR(40) UNIQUE,
  otp_hash VARCHAR(128),
  otp_expires_at TIMESTAMP,
  otp_requested_at TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_accounts (
  staff_id SERIAL PRIMARY KEY,
  user_id VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('receptionist', 'nurse', 'doctor', 'admin')),
  name VARCHAR(120) NOT NULL,
  designation VARCHAR(120),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_department_assignments (
  assignment_id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff_accounts(staff_id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (staff_id, department_id)
);

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
  symptoms TEXT NOT NULL,
  pain_scale INTEGER NOT NULL DEFAULT 0 CHECK (pain_scale BETWEEN 0 AND 10),
  preferred_slot TIMESTAMP,
  temperature_c NUMERIC(4,1),
  blood_pressure VARCHAR(20),
  pulse_rate INTEGER,
  spo2 INTEGER,
  weight_kg NUMERIC(5,1),
  triage_notes TEXT,
  assessed_by_name VARCHAR(120),
  assessed_at TIMESTAMP,
  diagnosis TEXT,
  prescription TEXT,
  tests_ordered TEXT,
  follow_up_date TIMESTAMP,
  follow_up_notes TEXT,
  doctor_notes TEXT,
  consulted_by_name VARCHAR(120),
  consulted_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'booked',
  queue_id INTEGER UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue (
  queue_id SERIAL PRIMARY KEY,
  appointment_id INTEGER UNIQUE REFERENCES appointments(appointment_id) ON DELETE SET NULL,
  patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
  priority_level INTEGER NOT NULL CHECK (priority_level BETWEEN 1 AND 3),
  token_number INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  urgent_review_requested BOOLEAN NOT NULL DEFAULT FALSE,
  urgent_review_reason TEXT,
  urgent_review_requested_by_role VARCHAR(30),
  urgent_review_requested_by_name VARCHAR(120),
  urgent_review_requested_at TIMESTAMP,
  escalated_at TIMESTAMP,
  escalated_by_role VARCHAR(30),
  escalated_by_name VARCHAR(120),
  escalation_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_events (
  event_id SERIAL PRIMARY KEY,
  actor_role VARCHAR(30),
  actor_name VARCHAR(120),
  actor_user_id VARCHAR(80),
  actor_account_id INTEGER,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40),
  entity_id VARCHAR(80),
  patient_id INTEGER REFERENCES patients(patient_id) ON DELETE SET NULL,
  appointment_id INTEGER REFERENCES appointments(appointment_id) ON DELETE SET NULL,
  queue_id INTEGER REFERENCES queue(queue_id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_department
  ON queue (department_id);

CREATE INDEX IF NOT EXISTS idx_queue_status
  ON queue (status);

CREATE INDEX IF NOT EXISTS idx_queue_priority_token
  ON queue (priority_level, token_number);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_created
  ON appointments (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_accounts_role_active
  ON staff_accounts (role, active);

CREATE INDEX IF NOT EXISTS idx_staff_department_assignments_staff_active
  ON staff_department_assignments (staff_id, active);

CREATE INDEX IF NOT EXISTS idx_staff_department_assignments_department_active
  ON staff_department_assignments (department_id, active);

CREATE INDEX IF NOT EXISTS idx_workflow_events_patient_created
  ON workflow_events (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_events_appointment_created
  ON workflow_events (appointment_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_active_per_patient
  ON appointments (patient_id)
  WHERE status IN ('booked', 'queued', 'ready-for-doctor', 'in-progress');

INSERT INTO departments (name, avg_consult_time)
VALUES
  ('General Medicine', 15),
  ('Cardiology', 20),
  ('Orthopedics', 18),
  ('Pediatrics', 12),
  ('Emergency', 10)
ON CONFLICT (name) DO NOTHING;
