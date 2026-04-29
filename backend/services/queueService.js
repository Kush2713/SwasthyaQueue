const axios = require("axios");
const pool = require("../db");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:5001";

async function determinePriorityLevel({ symptoms, painScale, age, isPregnant, isDisabled }) {
  try {
    const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
      age: age || 30,
      pain_scale: painScale || 0,
      symptom_code: 2,
    });

    return mlResponse.data.priority;
  } catch (mlError) {
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

async function createQueueEntry(db, { appointmentId, patientId, departmentId, priorityLevel }) {
  const countResult = await db.query(
    "SELECT COALESCE(MAX(token_number), 0) AS max_token FROM queue WHERE department_id = $1",
    [departmentId]
  );

  const tokenNumber = parseInt(countResult.rows[0].max_token, 10) + 1;

  const result = await db.query(
    `
      INSERT INTO queue (appointment_id, patient_id, department_id, priority_level, token_number, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [appointmentId || null, patientId, departmentId, priorityLevel, tokenNumber, "waiting"]
  );

  return result.rows[0];
}

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
      WHERE department_id = $1 AND status IN ('waiting', 'in-progress')
      ORDER BY priority_level ASC, token_number ASC
    `,
    [departmentId]
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
