const pool = require("../db");

async function ensureSchema() {
  await pool.query(`
    ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS email VARCHAR(160),
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20),
    ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10),
    ADD COLUMN IF NOT EXISTS allergies TEXT,
    ADD COLUMN IF NOT EXISTS chronic_conditions TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    ALTER TABLE patient_accounts
    ALTER COLUMN mobile DROP NOT NULL
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS temperature_c NUMERIC(4,1),
    ADD COLUMN IF NOT EXISTS blood_pressure VARCHAR(20),
    ADD COLUMN IF NOT EXISTS pulse_rate INTEGER,
    ADD COLUMN IF NOT EXISTS spo2 INTEGER,
    ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,1),
    ADD COLUMN IF NOT EXISTS triage_notes TEXT,
    ADD COLUMN IF NOT EXISTS assessed_by_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS assessed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS diagnosis TEXT,
    ADD COLUMN IF NOT EXISTS prescription TEXT,
    ADD COLUMN IF NOT EXISTS tests_ordered TEXT,
    ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP,
    ADD COLUMN IF NOT EXISTS follow_up_notes TEXT,
    ADD COLUMN IF NOT EXISTS doctor_notes TEXT,
    ADD COLUMN IF NOT EXISTS consulted_by_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS consulted_at TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE queue
    ADD COLUMN IF NOT EXISTS appointment_id INTEGER UNIQUE REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS token_date DATE,
    ADD COLUMN IF NOT EXISTS urgent_review_requested BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS urgent_review_reason TEXT,
    ADD COLUMN IF NOT EXISTS urgent_review_requested_by_role VARCHAR(30),
    ADD COLUMN IF NOT EXISTS urgent_review_requested_by_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS urgent_review_requested_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS escalated_by_role VARCHAR(30),
    ADD COLUMN IF NOT EXISTS escalated_by_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS escalation_note TEXT
  `);

  await pool.query(`
    UPDATE queue
    SET token_date = (created_at AT TIME ZONE 'Asia/Kolkata')::date
    WHERE token_date IS NULL
  `);

  await pool.query(`
    ALTER TABLE queue
    ALTER COLUMN token_date SET NOT NULL
  `);

  await pool.query(`
    ALTER TABLE queue
    ALTER COLUMN token_date SET DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_appointments_patient_created
    ON appointments (patient_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_workflow_events_patient_created
    ON workflow_events (patient_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_workflow_events_appointment_created
    ON workflow_events (appointment_id, created_at DESC)
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_department_day_token
    ON queue (department_id, token_date, token_number)
  `);

    await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_active_per_patient
      ON appointments (patient_id)
      WHERE status IN ('booked', 'queued', 'ready-for-doctor', 'in-progress')
    `);
  }

module.exports = { ensureSchema };
