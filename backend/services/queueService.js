const axios = require("axios");
const pool = require("../db");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:5001";
const HOSPITAL_TIMEZONE = process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata";

// Tries ML first, then falls back to deterministic triage rules so queueing never blocks.
async function determinePriorityLevel({ symptoms, painScale, age, isPregnant, isDisabled }) {
  try {
    const mlResponse = await axios.post(
      `${ML_SERVICE_URL}/predict`,
      {
        age: age || 30,
        pain_scale: painScale || 0,
        symptom_code: 2,
      },
      { timeout: 3000 }
    );

    const modelPriority = Number(mlResponse?.data?.priority);
    if ([1, 2, 3].includes(modelPriority)) {
      return modelPriority;
    }
    return 3;
  } catch (mlError) {
    console.warn("ML service unavailable, using fallback triage rules:", mlError.message);
    let priorityLevel = 3;
    const normalizedSymptoms = String(symptoms || "").toLowerCase();

    if (
      normalizedSymptoms.includes("chest pain") ||
      normalizedSymptoms.includes("breathing") ||
      normalizedSymptoms.includes("unconscious")
    ) {
      priorityLevel = 1;
    } else if (painScale >= 8) {
      priorityLevel = 1;
    } else if (painScale >= 5) {
      priorityLevel = 2;
    }

    if (age >= 60 || age <= 5) {
      priorityLevel = Math.min(priorityLevel, 2);
    }

    if (isPregnant || isDisabled) {
      priorityLevel = 1;
    }

    return priorityLevel;
  }
}

// Creates one queue entry with a race-safe token sequence per department per hospital day.
async function createQueueEntry(db, { appointmentId, patientId, departmentId, priorityLevel }) {
  const tokenDateResult = await db.query(
    `SELECT (CURRENT_TIMESTAMP AT TIME ZONE $1)::date AS token_date`,
    [HOSPITAL_TIMEZONE]
  );
  const tokenDate = tokenDateResult.rows[0].token_date;
  const tokenDateInt = Number(String(tokenDate).replace(/-/g, ""));
  const lockKey = Number(departmentId) * 100000000 + tokenDateInt;

  // Lock per department + operational day to prevent duplicate token numbers under concurrency.
  await db.query("SELECT pg_advisory_xact_lock($1::bigint)", [lockKey]);

  const latestResult = await db.query(
    `
      SELECT COALESCE(MAX(token_number), 0) AS last_token
      FROM queue
      WHERE department_id = $1
        AND token_date = $2
    `,
    [departmentId, tokenDate]
  );

  const tokenNumber = parseInt(latestResult.rows[0].last_token, 10) + 1;

  const result = await db.query(
    `
      INSERT INTO queue (appointment_id, patient_id, department_id, priority_level, token_number, token_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [appointmentId || null, patientId, departmentId, priorityLevel, tokenNumber, tokenDate, "waiting"]
  );

  return result.rows[0];
}

// Returns where the patient currently sits in today's department queue.
async function getQueuePositionInfo(db, queueId, departmentId) {
  const dept = await db.query(
    "SELECT avg_consult_time FROM departments WHERE department_id = $1",
    [departmentId]
  );

  const avgTime = dept.rows[0]?.avg_consult_time || 0;

  const result = await db.query(
    `
      SELECT queue_id
      FROM queue
      WHERE department_id = $1
        AND token_date = (CURRENT_TIMESTAMP AT TIME ZONE $2)::date
        AND status IN ('waiting', 'in-progress')
      ORDER BY priority_level ASC, token_number ASC
    `,
    [departmentId, HOSPITAL_TIMEZONE]
  );

  const index = result.rows.findIndex((item) => item.queue_id === queueId);

  return {
    position: index >= 0 ? index + 1 : null,
    estimatedWaitTime: index >= 0 ? index * avgTime : null,
  };
}

module.exports = {
  determinePriorityLevel,
  createQueueEntry,
  getQueuePositionInfo,
  pool,
};
