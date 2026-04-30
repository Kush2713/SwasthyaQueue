const {
  createQueueEntry,
  analyzePrioritySuggestion,
  pool,
} = require("../services/queueService");
const { logWorkflowEvent } = require("../utils/audit");
const { getActorFromRequest } = require("../middleware/authMiddleware");
const { formatTokenLabel } = require("../utils/tokenLabel");

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toFahrenheitFromCelsius(value) {
  if (value === null) return null;
  return Number(((value * 9) / 5 + 32).toFixed(1));
}

function getTemperatureF(reqBody) {
  const tempF = toNullableNumber(reqBody.temperature_f);
  if (tempF !== null) return tempF;
  const temp = toNullableNumber(reqBody.temperature_c);
  if (temp === null || Number.isNaN(temp)) return temp;
  if (temp <= 45) return toFahrenheitFromCelsius(temp);
  return temp;
}

function validateTriageVitals({ temperatureF, pulseRate, spo2, weightKg, bloodPressure }) {
  if (Number.isNaN(temperatureF) || Number.isNaN(pulseRate) || Number.isNaN(spo2) || Number.isNaN(weightKg)) {
    return "Vitals must be valid numbers.";
  }

  if (temperatureF !== null && (temperatureF < 86 || temperatureF > 113)) {
    return "Temperature should be between 86 and 113 F.";
  }

  if (pulseRate !== null && (pulseRate < 20 || pulseRate > 240)) {
    return "Pulse rate should be between 20 and 240.";
  }

  if (spo2 !== null && (spo2 < 40 || spo2 > 100)) {
    return "SpO2 should be between 40 and 100.";
  }

  if (weightKg !== null && (weightKg < 1 || weightKg > 400)) {
    return "Weight should be between 1 and 400 kg.";
  }

  if (bloodPressure && !/^\d{2,3}\/\d{2,3}$/.test(bloodPressure)) {
    return "Blood pressure should be in SYS/DIA format, for example 120/80.";
  }

  return "";
}

// Add patient to queue with ML + fallback logic
const addToQueue = async (req, res) => {
  try {
    const { patient_id, department_id, symptoms, pain_scale, age, appointment_id } = req.body;
    const actor = getActorFromRequest(req);

    if (!patient_id || !department_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const prioritySuggestion = await analyzePrioritySuggestion({
      symptoms,
      painScale: Number(pain_scale) || 0,
      age,
      isPregnant: req.body.is_pregnant,
      isDisabled: req.body.is_disabled,
    });
    const priority_level = prioritySuggestion.suggestedPriorityLevel;

    const queue = await createQueueEntry(pool, {
      appointmentId: appointment_id || null,
      patientId: patient_id,
      departmentId: department_id,
      priorityLevel: priority_level,
    });

    if (appointment_id) {
      await pool.query(
        `
          UPDATE appointments
          SET status = 'queued',
              queue_id = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE appointment_id = $1
        `,
        [appointment_id, queue.queue_id]
      );
    }

    await logWorkflowEvent(pool, {
      actor,
      action: "queue_entry_created",
      entityType: "queue",
      entityId: queue.queue_id,
      patientId: patient_id,
      appointmentId: appointment_id || null,
      queueId: queue.queue_id,
      details: {
        departmentId: department_id,
        priorityLevel: priority_level,
        prioritySuggestion,
      },
    });

    res.status(201).json({
      message: "Added to queue successfully",
      priority_used: priority_level,
      priority_suggestion: prioritySuggestion,
      queue,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

// Get queue + estimated wait time
const getQueueByDepartment = async (req, res) => {
  try {
    const { department_id } = req.params;

    const dept = await pool.query(
      "SELECT name, avg_consult_time FROM departments WHERE department_id = $1",
      [department_id]
    );

    const avgTime = dept.rows[0].avg_consult_time;
    const departmentName = dept.rows[0].name;

    const result = await pool.query(
      `
        SELECT
          q.*,
          p.patient_id,
          p.name,
          p.age,
          p.phone,
          a.status AS appointment_status,
          a.preferred_slot,
          a.symptoms,
          a.temperature_c,
          a.blood_pressure,
          a.pulse_rate,
          a.spo2,
          a.weight_kg,
          a.triage_notes,
          a.assessed_by_name,
          a.assessed_at
          ,
          a.diagnosis,
          a.prescription,
          a.tests_ordered,
          a.follow_up_date,
          a.follow_up_notes,
          a.doctor_notes,
          a.consulted_by_name,
          a.consulted_at
        FROM queue q
        JOIN patients p ON q.patient_id = p.patient_id
        LEFT JOIN appointments a ON q.appointment_id = a.appointment_id
        WHERE q.department_id = $1
          AND q.status IN ('waiting', 'in-progress')
        ORDER BY priority_level ASC, token_number ASC
      `,
      [department_id]
    );

    const enhancedQueue = await Promise.all(result.rows.map(async (patient, index) => {
      const prioritySuggestion = await analyzePrioritySuggestion({
        symptoms: patient.symptoms,
        painScale: patient.pain_scale,
        age: patient.age,
        isPregnant: false,
        isDisabled: false,
      });

      return {
        ...patient,
        token_label: formatTokenLabel({
          departmentName,
          departmentId: department_id,
          queueCreatedAt: patient.created_at,
          tokenNumber: patient.token_number,
        }),
        estimated_wait_time: index * avgTime,
        priority_suggestion: prioritySuggestion,
        priority_human_confirmed: Boolean(patient.escalated_at || patient.assessed_at),
      };
    }));

    res.json(enhancedQueue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

// Check patient turn
const checkTurn = async (req, res) => {
  try {
    const { patient_id, department_id } = req.body;

    if (!patient_id || !department_id) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const dept = await pool.query(
      "SELECT avg_consult_time FROM departments WHERE department_id = $1",
      [department_id]
    );

    const avgTime = dept.rows[0].avg_consult_time;

    const result = await pool.query(
      `
        SELECT
          q.*,
          p.patient_id,
          p.name,
          p.age,
          p.phone,
          a.status AS appointment_status,
          a.preferred_slot,
          a.symptoms,
          a.temperature_c,
          a.blood_pressure,
          a.pulse_rate,
          a.spo2,
          a.weight_kg,
          a.triage_notes,
          a.assessed_by_name,
          a.assessed_at
          ,
          a.diagnosis,
          a.prescription,
          a.tests_ordered,
          a.follow_up_date,
          a.follow_up_notes,
          a.doctor_notes,
          a.consulted_by_name,
          a.consulted_at
        FROM queue q
        JOIN patients p ON q.patient_id = p.patient_id
        LEFT JOIN appointments a ON q.appointment_id = a.appointment_id
        WHERE q.department_id = $1
          AND q.status IN ('waiting', 'in-progress')
        ORDER BY priority_level ASC, token_number ASC
      `,
      [department_id]
    );

    const index = result.rows.findIndex((p) => p.patient_id === patient_id);

    if (index === -1) {
      return res.status(404).json({ message: "Patient not in queue" });
    }

    const wait_time = index * avgTime;

    res.json({
      patient_id,
      estimated_wait_time: wait_time,
      alert_message: wait_time <= 10 ? "Your turn is coming soon" : "Please wait",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

// Call next patient
const callNextPatient = async (req, res) => {
  try {
    const { department_id } = req.body;
    const actor = getActorFromRequest(req, { role: "receptionist", name: "Front Desk" });

    const result = await pool.query(
      `
        SELECT *
        FROM queue
        WHERE department_id = $1 AND status = 'waiting'
        ORDER BY priority_level ASC, token_number ASC
        LIMIT 1
      `,
      [department_id]
    );

    if (result.rows.length === 0) {
      return res.json({ message: "No patients in queue" });
    }

    const patient = result.rows[0];

    await pool.query(
      "UPDATE queue SET status = 'in-progress' WHERE queue_id = $1",
      [patient.queue_id]
    );

    if (patient.appointment_id) {
      await pool.query(
        `
          UPDATE appointments
          SET status = 'in-progress',
              updated_at = CURRENT_TIMESTAMP
          WHERE appointment_id = $1
        `,
        [patient.appointment_id]
      );
    }

    await logWorkflowEvent(pool, {
      actor,
      action: "queue_called_next",
      entityType: "queue",
      entityId: patient.queue_id,
      patientId: patient.patient_id,
      appointmentId: patient.appointment_id || null,
      queueId: patient.queue_id,
      details: {
        departmentId: department_id,
        tokenNumber: patient.token_number,
      },
    });

    res.json({
      message: "Next patient called",
      patient,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

// Complete patient
const completePatient = async (req, res) => {
  try {
    const { queue_id } = req.body;
    const actor = getActorFromRequest(req, { role: "doctor", name: "Doctor" });

    const result = await pool.query(
      `
        UPDATE queue
        SET status = 'completed'
        WHERE queue_id = $1
        RETURNING *
      `,
      [queue_id]
    );

    if (result.rows[0]?.appointment_id) {
      await pool.query(
        `
          UPDATE appointments
          SET status = 'completed',
              updated_at = CURRENT_TIMESTAMP
          WHERE appointment_id = $1
        `,
        [result.rows[0].appointment_id]
      );
    }

    if (result.rows[0]) {
      await logWorkflowEvent(pool, {
        actor,
        action: "queue_completed",
        entityType: "queue",
        entityId: result.rows[0].queue_id,
        patientId: result.rows[0].patient_id,
        appointmentId: result.rows[0].appointment_id || null,
        queueId: result.rows[0].queue_id,
      });
    }

    res.json({
      message: "Patient marked as completed",
      patient: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

// Stats
const getStats = async (req, res) => {
  try {
    const total = await pool.query("SELECT COUNT(*) FROM queue WHERE status != 'cancelled'");
    const waiting = await pool.query("SELECT COUNT(*) FROM queue WHERE status = 'waiting'");
    const completed = await pool.query("SELECT COUNT(*) FROM queue WHERE status = 'completed'");

    res.json({
      total_patients: parseInt(total.rows[0].count, 10),
      waiting_patients: parseInt(waiting.rows[0].count, 10),
      completed_patients: parseInt(completed.rows[0].count, 10),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

// Get position
const getPosition = async (req, res) => {
  try {
    const { patient_id, department_id } = req.params;

    const result = await pool.query(
      `
        SELECT *
        FROM queue
        WHERE department_id = $1
          AND status IN ('waiting', 'in-progress')
        ORDER BY priority_level ASC, token_number ASC
      `,
      [department_id]
    );

    const index = result.rows.findIndex((p) => p.patient_id == patient_id);

    if (index === -1) {
      return res.status(404).json({ message: "Patient not in queue" });
    }

    res.json({ position: index + 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

const flagUrgentReview = async (req, res) => {
  try {
    const queueId = Number(req.params.queue_id);
    const reason = String(req.body.reason || "").trim();
    const actor = getActorFromRequest(req, { role: "receptionist", name: "Front Desk" });
    const requestedByRole = actor.role || "receptionist";
    const requestedByName = actor.name || "Front Desk";

    if (!Number.isFinite(queueId)) {
      return res.status(400).json({ error: "Invalid queue id." });
    }

    if (!reason) {
      return res.status(400).json({ error: "Please provide a reason for urgent review." });
    }

    const result = await pool.query(
      `
        UPDATE queue
        SET urgent_review_requested = TRUE,
            urgent_review_reason = $2,
            urgent_review_requested_by_role = $3,
            urgent_review_requested_by_name = $4,
            urgent_review_requested_at = CURRENT_TIMESTAMP
        WHERE queue_id = $1
          AND status IN ('waiting', 'in-progress')
        RETURNING *
      `,
      [queueId, reason, requestedByRole, requestedByName]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Queue entry not found for urgent review." });
    }

    await logWorkflowEvent(pool, {
      actor,
      action: "urgent_review_requested",
      entityType: "queue",
      entityId: queueId,
      patientId: result.rows[0].patient_id,
      appointmentId: result.rows[0].appointment_id || null,
      queueId,
      details: { reason },
    });

    res.json({
      message: "Patient flagged for urgent nurse review.",
      queue: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to flag urgent review right now." });
  }
};

const approvePriorityOverride = async (req, res) => {
  try {
    const queueId = Number(req.params.queue_id);
    const priorityLevel = Number(req.body.priority_level);
    const actor = getActorFromRequest(req, { role: "nurse", name: "Triage Nurse" });
    const escalatedByRole = actor.role || "nurse";
    const escalatedByName = actor.name || "Triage Nurse";
    const escalationNote = String(req.body.note || "").trim();

    if (!Number.isFinite(queueId)) {
      return res.status(400).json({ error: "Invalid queue id." });
    }

    if (![1, 2, 3].includes(priorityLevel)) {
      return res.status(400).json({ error: "Priority level must be 1, 2, or 3." });
    }

    const result = await pool.query(
      `
        UPDATE queue
        SET priority_level = $2,
            urgent_review_requested = TRUE,
            escalated_at = CURRENT_TIMESTAMP,
            escalated_by_role = $3,
            escalated_by_name = $4,
            escalation_note = $5
        WHERE queue_id = $1
          AND status IN ('waiting', 'in-progress')
        RETURNING *
      `,
      [queueId, priorityLevel, escalatedByRole, escalatedByName, escalationNote || null]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Queue entry not found for escalation." });
    }

    await logWorkflowEvent(pool, {
      actor,
      action: "queue_priority_overridden",
      entityType: "queue",
      entityId: queueId,
      patientId: result.rows[0].patient_id,
      appointmentId: result.rows[0].appointment_id || null,
      queueId,
      details: {
        priorityLevel,
        note: escalationNote || null,
      },
    });

    res.json({
      message: "Priority updated successfully.",
      queue: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to update queue priority right now." });
  }
};

const confirmPrioritySuggestion = async (req, res) => {
  try {
    const queueId = Number(req.params.queue_id);
    const actor = getActorFromRequest(req, { role: "nurse", name: "Triage Nurse" });
    const confirmedPriorityLevel = Number(req.body.priority_level);
    const note = String(req.body.note || "").trim();

    if (!Number.isFinite(queueId)) {
      return res.status(400).json({ error: "Invalid queue id." });
    }

    const queueResult = await pool.query(
      `
        SELECT q.*, a.symptoms, a.pain_scale, p.age
        FROM queue q
        LEFT JOIN appointments a ON a.appointment_id = q.appointment_id
        LEFT JOIN patients p ON p.patient_id = q.patient_id
        WHERE q.queue_id = $1
          AND q.status IN ('waiting', 'in-progress')
        LIMIT 1
      `,
      [queueId]
    );

    if (!queueResult.rows.length) {
      return res.status(404).json({ error: "Queue entry not found for confirmation." });
    }

    const current = queueResult.rows[0];
    const suggestion = await analyzePrioritySuggestion({
      symptoms: current.symptoms,
      painScale: current.pain_scale,
      age: current.age,
      isPregnant: false,
      isDisabled: false,
    });

    const finalPriority = [1, 2, 3].includes(confirmedPriorityLevel)
      ? confirmedPriorityLevel
      : current.priority_level;

    const updateResult = await pool.query(
      `
        UPDATE queue
        SET priority_level = $2
        WHERE queue_id = $1
        RETURNING *
      `,
      [queueId, finalPriority]
    );

    await logWorkflowEvent(pool, {
      actor,
      action: "priority_confirmed_by_nurse",
      entityType: "queue",
      entityId: queueId,
      patientId: current.patient_id,
      appointmentId: current.appointment_id || null,
      queueId,
      details: {
        finalPriorityLevel: finalPriority,
        suggestion,
        note: note || null,
      },
    });

    res.json({
      message: "Priority confirmed by nurse.",
      queue: updateResult.rows[0],
      priority_suggestion: suggestion,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to confirm priority right now." });
  }
};

const recordNurseTriage = async (req, res) => {
  try {
    const queueId = Number(req.params.queue_id);
    const actor = getActorFromRequest(req, { role: "nurse", name: "Triage Nurse" });
    const assessedByName = String(actor.name || req.body.assessed_by_name || "Triage Nurse").trim();
    const triageNotes = String(req.body.triage_notes || "").trim();
    const temperatureF = getTemperatureF(req.body);
    const pulseRate = toNullableNumber(req.body.pulse_rate);
    const spo2 = toNullableNumber(req.body.spo2);
    const weightKg = toNullableNumber(req.body.weight_kg);
    const bloodPressure = String(req.body.blood_pressure || "").trim();

    if (!Number.isFinite(queueId)) {
      return res.status(400).json({ error: "Invalid queue id." });
    }

    if (!assessedByName) {
      return res.status(400).json({ error: "Assessed by name is required." });
    }

    const validationError = validateTriageVitals({
      temperatureF,
      pulseRate,
      spo2,
      weightKg,
      bloodPressure,
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const result = await pool.query(
      `
        UPDATE appointments a
        SET temperature_c = $2,
            blood_pressure = $3,
            pulse_rate = $4,
            spo2 = $5,
            weight_kg = $6,
            triage_notes = $7,
            assessed_by_name = $8,
            assessed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        FROM queue q
        WHERE q.queue_id = $1
          AND q.appointment_id = a.appointment_id
          AND q.status = 'in-progress'
          AND a.status IN ('in-progress', 'ready-for-doctor')
        RETURNING
          a.appointment_id,
          a.temperature_c,
          a.blood_pressure,
          a.pulse_rate,
          a.spo2,
          a.weight_kg,
          a.triage_notes,
          a.assessed_by_name,
          a.assessed_at
      `,
      [queueId, temperatureF, bloodPressure || null, pulseRate, spo2, weightKg, triageNotes || null, assessedByName]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Active appointment not found for triage." });
    }

    await logWorkflowEvent(pool, {
      actor,
      action: "triage_saved",
      entityType: "appointment",
      entityId: result.rows[0].appointment_id,
      appointmentId: result.rows[0].appointment_id,
      queueId,
      details: {
        temperatureF,
        bloodPressure: bloodPressure || null,
        pulseRate,
        spo2,
        weightKg,
        triageNotes: triageNotes || null,
      },
    });

    res.json({
      message: "Nurse assessment saved successfully.",
      triage: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to save nurse assessment right now." });
  }
};

const markReadyForDoctor = async (req, res) => {
  try {
    const queueId = Number(req.params.queue_id);
    const actor = getActorFromRequest(req, { role: "nurse", name: "Triage Nurse" });
    const assessedByName = String(actor.name || req.body.assessed_by_name || "Triage Nurse").trim();
    const triageNotes = String(req.body.triage_notes || "").trim();
    const temperatureF = getTemperatureF(req.body);
    const pulseRate = toNullableNumber(req.body.pulse_rate);
    const spo2 = toNullableNumber(req.body.spo2);
    const weightKg = toNullableNumber(req.body.weight_kg);
    const bloodPressure = String(req.body.blood_pressure || "").trim();

    if (!Number.isFinite(queueId)) {
      return res.status(400).json({ error: "Invalid queue id." });
    }

    const validationError = validateTriageVitals({
      temperatureF,
      pulseRate,
      spo2,
      weightKg,
      bloodPressure,
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const result = await pool.query(
      `
        UPDATE appointments a
        SET status = 'ready-for-doctor',
            temperature_c = $3,
            blood_pressure = $4,
            pulse_rate = $5,
            spo2 = $6,
            weight_kg = $7,
            triage_notes = $8,
            assessed_by_name = COALESCE(NULLIF($2, ''), a.assessed_by_name),
            assessed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        FROM queue q
        WHERE q.queue_id = $1
          AND q.appointment_id = a.appointment_id
          AND q.status = 'in-progress'
          AND a.status IN ('in-progress', 'ready-for-doctor')
        RETURNING a.appointment_id, a.patient_id, a.status, a.assessed_by_name, a.assessed_at
      `,
      [queueId, assessedByName, temperatureF, bloodPressure || null, pulseRate, spo2, weightKg, triageNotes || null]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Active appointment not found for doctor handoff." });
    }

    await logWorkflowEvent(pool, {
      actor,
      action: "marked_ready_for_doctor",
      entityType: "appointment",
      entityId: result.rows[0].appointment_id,
      patientId: result.rows[0].patient_id,
      appointmentId: result.rows[0].appointment_id,
      queueId,
      details: {
        temperatureF,
        bloodPressure: bloodPressure || null,
        pulseRate,
        spo2,
        weightKg,
        triageNotes: triageNotes || null,
      },
    });

    res.json({
      message: "Patient marked ready for doctor.",
      appointment: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to mark patient ready for doctor right now." });
  }
};

module.exports = {
  addToQueue,
  getQueueByDepartment,
  checkTurn,
  callNextPatient,
  completePatient,
  getStats,
  getPosition,
  flagUrgentReview,
  approvePriorityOverride,
  confirmPrioritySuggestion,
  recordNurseTriage,
  markReadyForDoctor,
};
