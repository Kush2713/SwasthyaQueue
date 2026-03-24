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
  phone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS queue (
  queue_id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
  priority_level INTEGER NOT NULL CHECK (priority_level BETWEEN 1 AND 3),
  token_number INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_department
  ON queue (department_id);

CREATE INDEX IF NOT EXISTS idx_queue_status
  ON queue (status);

CREATE INDEX IF NOT EXISTS idx_queue_priority_token
  ON queue (priority_level, token_number);

INSERT INTO departments (name, avg_consult_time)
VALUES
  ('General Medicine', 15),
  ('Cardiology', 20),
  ('Orthopedics', 18),
  ('Pediatrics', 12),
  ('Emergency', 10)
ON CONFLICT (name) DO NOTHING;
