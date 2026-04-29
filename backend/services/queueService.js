const axios = require("axios");
const pool = require("../db");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:5001";

function clampPriority(value, fallback = 3) {
  const parsed = Number(value);
  if (![1, 2, 3].includes(parsed)) return fallback;
  return parsed;
}

function getRuleBasedPriority({ symptoms, painScale, age, isPregnant, isDisabled }) {
  let priorityLevel = 3;
  const reasons = [];
  const normalizedSymptoms = String(symptoms || "").toLowerCase();
  const pain = Number(painScale) || 0;
  const personAge = Number(age) || 0;

  if (
    normalizedSymptoms.includes("chest pain") ||
    normalizedSymptoms.includes("breathing") ||
    normalizedSymptoms.includes("unconscious") ||
    normalizedSymptoms.includes("seizure") ||
    normalizedSymptoms.includes("stroke")
  ) {
    priorityLevel = 1;
    reasons.push("Hard clinical red-flag symptom");
  } else if (pain >= 8) {
    priorityLevel = 1;
    reasons.push("Severe pain score (>=8)");
  } else if (pain >= 5) {
    priorityLevel = 2;
    reasons.push("Moderate pain score (>=5)");
  }

  if (personAge >= 60 || (personAge > 0 && personAge <= 5)) {
    priorityLevel = Math.min(priorityLevel, 2);
    reasons.push("Age vulnerability modifier");
  }

  if (isPregnant || isDisabled) {
    priorityLevel = 1;
    reasons.push("High-risk vulnerability modifier");
  }

  return {
    priorityLevel,
    reasons,
    hardRule: priorityLevel === 1 && reasons.some((reason) => reason.toLowerCase().includes("red-flag")),
  };
}

async function analyzePrioritySuggestion({ symptoms, painScale, age, isPregnant, isDisabled }) {
  const rule = getRuleBasedPriority({ symptoms, painScale, age, isPregnant, isDisabled });

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

    const mlPriority = clampPriority(mlResponse?.data?.priority, rule.priorityLevel);

    // Human-in-loop safety: hard clinical red flags cannot be downgraded by ML.
    const suggestedPriorityLevel = rule.hardRule ? Math.min(rule.priorityLevel, mlPriority) : mlPriority;

    return {
      suggestedPriorityLevel,
      source: "ml+rules",
      mlPriorityLevel: mlPriority,
      rulePriorityLevel: rule.priorityLevel,
      confidence: Number.isFinite(Number(mlResponse?.data?.confidence)) ? Number(mlResponse.data.confidence) : null,
      reason: rule.reasons.join("; ") || "ML suggestion with rule guardrails",
      requiresHumanConfirmation: true,
      mlAvailable: true,
    };
  } catch (mlError) {
    return {
      suggestedPriorityLevel: rule.priorityLevel,
      source: "rules-fallback",
      mlPriorityLevel: null,
      rulePriorityLevel: rule.priorityLevel,
      confidence: null,
      reason: rule.reasons.join("; ") || "Rule-based fallback",
      requiresHumanConfirmation: true,
      mlAvailable: false,
    };
  }
}

async function determinePriorityLevel(input) {
  const suggestion = await analyzePrioritySuggestion(input);
  return suggestion.suggestedPriorityLevel;
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
  analyzePrioritySuggestion,
  determinePriorityLevel,
  createQueueEntry,
  getQueuePositionInfo,
  pool,
};
