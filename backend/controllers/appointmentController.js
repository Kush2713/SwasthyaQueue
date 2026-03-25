const pool = require("../db");
const {
  createQueueEntry,
  determinePriorityLevel,
  getQueuePositionInfo,
} = require("../services/queueService");

function mapAppointmentRow(row) {
  return {
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    departmentId: row.department_id,
    department: row.department_name,
    symptoms: row.symptoms,
    painScale: row.pain_scale,
    preferredSlot: row.preferred_slot,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    queueId: row.queue_id,
    token: row.token_number,
    priorityLevel: row.priority_level,
    queueStatus: row.queue_status,
    triage: {
      temperatureC: row.temperature_c,
      bloodPressure: row.blood_pressure,
      pulseRate: row.pulse_rate,
      spo2: row.spo2,
      weightKg: row.weight_kg,
      notes: row.triage_notes,
      assessedByName: row.assessed_by_name,
      assessedAt: row.assessed_at,
    },
    doctor: {
      diagnosis: row.diagnosis,
      prescription: row.prescription,
      notes: row.doctor_notes,
      consultedByName: row.consulted_by_name,
      consultedAt: row.consulted_at,
    },
  };
}

function normalizePreferredSlot(preferredSlot) {
  if (!preferredSlot) return null;

  const parsed = new Date(preferredSlot);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid preferred slot selected.");
  }

  const hours = parsed.getHours();
  const minutes = parsed.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const opdStart = 9 * 60 + 30;
  const opdEnd = 21 * 60 + 30;

  if (totalMinutes < opdStart || totalMinutes > opdEnd) {
    throw new Error("Preferred slot must be within OPD hours: 9:30 AM to 9:30 PM.");
  }

  return parsed.toISOString();
}

function normalizeOptionalPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(-10);
}

async function getAppointmentDetails(db, appointmentId) {
  const result = await db.query(
    `
      SELECT
        a.*,
        d.name AS department_name,
        q.queue_id,
        q.token_number,
        q.priority_level,
        q.status AS queue_status
      FROM appointments a
      JOIN departments d ON d.department_id = a.department_id
      LEFT JOIN queue q ON q.appointment_id = a.appointment_id
      WHERE a.appointment_id = $1
    `,
    [appointmentId]
  );

  return result.rows[0] || null;
}

async function getCasePayload(db, queueId) {
  const caseResult = await db.query(
    `
      SELECT
        q.queue_id,
        q.patient_id,
        q.department_id,
        q.priority_level,
        q.token_number,
        q.status AS queue_status,
        q.created_at AS queued_at,
        q.urgent_review_requested,
        q.urgent_review_reason,
        q.urgent_review_requested_by_name,
        q.escalated_at,
        q.escalated_by_name,
        q.escalation_note,
        d.name AS department_name,
        p.name AS patient_name,
        p.age,
        p.gender,
        p.phone,
        p.email,
        p.address,
        p.emergency_contact,
        p.blood_group,
        p.allergies,
        p.chronic_conditions,
        a.appointment_id,
        a.symptoms,
        a.pain_scale,
        a.preferred_slot,
        a.status AS appointment_status,
        a.temperature_c,
        a.blood_pressure,
        a.pulse_rate,
        a.spo2,
        a.weight_kg,
        a.triage_notes,
        a.assessed_by_name,
        a.assessed_at,
        a.diagnosis,
        a.prescription,
        a.doctor_notes,
        a.consulted_by_name,
        a.consulted_at,
        a.created_at AS appointment_created_at,
        a.updated_at AS appointment_updated_at
      FROM queue q
      JOIN patients p ON p.patient_id = q.patient_id
      JOIN departments d ON d.department_id = q.department_id
      LEFT JOIN appointments a ON a.appointment_id = q.appointment_id
      WHERE q.queue_id = $1
      LIMIT 1
    `,
    [queueId]
  );

  const current = caseResult.rows[0];
  if (!current) return null;

  const historyResult = await db.query(
    `
      SELECT
        a.appointment_id,
        a.department_id,
        d.name AS department_name,
        a.symptoms,
        a.pain_scale,
        a.preferred_slot,
        a.status,
        a.temperature_c,
        a.blood_pressure,
        a.pulse_rate,
        a.spo2,
        a.weight_kg,
        a.triage_notes,
        a.assessed_by_name,
        a.assessed_at,
        a.diagnosis,
        a.prescription,
        a.doctor_notes,
        a.consulted_by_name,
        a.consulted_at,
        a.created_at,
        q.queue_id,
        q.token_number,
        q.priority_level,
        q.status AS queue_status
      FROM appointments a
      JOIN departments d ON d.department_id = a.department_id
      LEFT JOIN queue q ON q.appointment_id = a.appointment_id
      WHERE a.patient_id = $1
      ORDER BY a.created_at DESC
      LIMIT 8
    `,
    [current.patient_id]
  );

  return {
    patient: {
      patientId: current.patient_id,
      name: current.patient_name,
      age: current.age,
      gender: current.gender,
      phone: current.phone,
      email: current.email,
      address: current.address,
      emergencyContact: current.emergency_contact,
      bloodGroup: current.blood_group,
      allergies: current.allergies,
      chronicConditions: current.chronic_conditions,
    },
    currentVisit: {
      queueId: current.queue_id,
      appointmentId: current.appointment_id,
      departmentId: current.department_id,
      department: current.department_name,
      token: current.token_number,
      priorityLevel: current.priority_level,
      queueStatus: current.queue_status,
      appointmentStatus: current.appointment_status,
      symptoms: current.symptoms,
      painScale: current.pain_scale,
      preferredSlot: current.preferred_slot,
      queuedAt: current.queued_at,
      createdAt: current.appointment_created_at,
      updatedAt: current.appointment_updated_at,
      urgentReviewRequested: current.urgent_review_requested,
      urgentReviewReason: current.urgent_review_reason,
      urgentReviewRequestedByName: current.urgent_review_requested_by_name,
      escalatedAt: current.escalated_at,
      escalatedByName: current.escalated_by_name,
      escalationNote: current.escalation_note,
      triage: {
        temperatureC: current.temperature_c,
        bloodPressure: current.blood_pressure,
        pulseRate: current.pulse_rate,
        spo2: current.spo2,
        weightKg: current.weight_kg,
        notes: current.triage_notes,
        assessedByName: current.assessed_by_name,
        assessedAt: current.assessed_at,
      },
      doctor: {
        diagnosis: current.diagnosis,
        prescription: current.prescription,
        notes: current.doctor_notes,
        consultedByName: current.consulted_by_name,
        consultedAt: current.consulted_at,
      },
    },
    visitHistory: historyResult.rows.map((row) => ({
      appointmentId: row.appointment_id,
      queueId: row.queue_id,
      token: row.token_number,
      departmentId: row.department_id,
      department: row.department_name,
      symptoms: row.symptoms,
      painScale: row.pain_scale,
      preferredSlot: row.preferred_slot,
      status: row.status,
      queueStatus: row.queue_status,
      priorityLevel: row.priority_level,
      createdAt: row.created_at,
      triage: {
        temperatureC: row.temperature_c,
        bloodPressure: row.blood_pressure,
        pulseRate: row.pulse_rate,
        spo2: row.spo2,
        weightKg: row.weight_kg,
        notes: row.triage_notes,
        assessedByName: row.assessed_by_name,
        assessedAt: row.assessed_at,
      },
      doctor: {
        diagnosis: row.diagnosis,
        prescription: row.prescription,
        notes: row.doctor_notes,
        consultedByName: row.consulted_by_name,
        consultedAt: row.consulted_at,
      },
    })),
  };
}

async function saveDoctorUpdate(req, res) {
  const appointmentId = Number(req.params.id);
  const diagnosis = String(req.body.diagnosis || "").trim();
  const prescription = String(req.body.prescription || "").trim();
  const doctorNotes = String(req.body.doctor_notes || "").trim();
  const consultedByName = String(req.body.consulted_by_name || "Doctor").trim();
  const completeVisit = Boolean(req.body.complete_visit);

  if (!Number.isFinite(appointmentId)) {
    return res.status(400).json({ error: "Invalid appointment id." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const appointmentResult = await client.query(
      `
        SELECT appointment_id, queue_id, status
        FROM appointments
        WHERE appointment_id = $1
        LIMIT 1
      `,
      [appointmentId]
    );

    if (!appointmentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Appointment not found." });
    }

    const appointment = appointmentResult.rows[0];
    const nextStatus = completeVisit
      ? "completed"
      : ["queued", "ready-for-doctor"].includes(appointment.status)
        ? "in-progress"
        : appointment.status;

    await client.query(
      `
        UPDATE appointments
        SET diagnosis = $2,
            prescription = $3,
            doctor_notes = $4,
            consulted_by_name = $5,
            consulted_at = CURRENT_TIMESTAMP,
            status = $6,
            updated_at = CURRENT_TIMESTAMP
        WHERE appointment_id = $1
      `,
      [appointmentId, diagnosis || null, prescription || null, doctorNotes || null, consultedByName, nextStatus]
    );

    if (appointment.queue_id) {
      await client.query(
        `
          UPDATE queue
          SET status = $2
          WHERE queue_id = $1
            AND status IN ('waiting', 'in-progress')
        `,
          [appointment.queue_id, completeVisit ? "completed" : "in-progress"]
        );
      }

    const refreshed = await getAppointmentDetails(client, appointmentId);
    await client.query("COMMIT");

    res.json({
      message: completeVisit ? "Doctor notes saved and visit completed." : "Doctor notes saved successfully.",
      appointment: refreshed ? mapAppointmentRow(refreshed) : null,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Unable to save doctor update right now." });
  } finally {
    client.release();
  }
}

async function createAppointment(req, res) {
  const {
    department_id,
    symptoms,
    pain_scale,
    preferred_slot,
    is_pregnant,
    is_disabled,
  } = req.body;

  if (!department_id || !symptoms?.trim()) {
    return res.status(400).json({ error: "Department and symptoms are required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const departmentResult = await client.query(
      `
        SELECT department_id
        FROM departments
        WHERE department_id = $1
        LIMIT 1
      `,
      [department_id]
    );

    if (!departmentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Selected department is not available." });
    }

    const patientResult = await client.query(
      `
        SELECT patient_id, age
        FROM patients
        WHERE patient_id = $1
      `,
      [req.auth.patient_id]
    );

    if (!patientResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Patient profile not found." });
    }

    const activeAppointment = await client.query(
      `
        SELECT appointment_id
        FROM appointments
        WHERE patient_id = $1
          AND status IN ('booked', 'queued', 'ready-for-doctor', 'in-progress')
        LIMIT 1
      `,
      [req.auth.patient_id]
    );

    if (activeAppointment.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "You already have an active appointment." });
    }

    const patient = patientResult.rows[0];
    let normalizedPreferredSlot = null;
    try {
      normalizedPreferredSlot = normalizePreferredSlot(preferred_slot);
    } catch (slotError) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: slotError.message });
    }

    const priorityLevel = await determinePriorityLevel({
      symptoms,
      painScale: Number(pain_scale) || 0,
      age: patient.age,
      isPregnant: Boolean(is_pregnant),
      isDisabled: Boolean(is_disabled),
    });

    const appointmentResult = await client.query(
      `
        INSERT INTO appointments (
          patient_id, department_id, symptoms, pain_scale, preferred_slot, status
        )
        VALUES ($1, $2, $3, $4, $5, 'booked')
        RETURNING *
      `,
      [
        req.auth.patient_id,
        department_id,
        symptoms.trim(),
        Number(pain_scale) || 0,
        normalizedPreferredSlot,
      ]
    );

    const appointment = appointmentResult.rows[0];
    const queue = await createQueueEntry(client, {
      appointmentId: appointment.appointment_id,
      patientId: req.auth.patient_id,
      departmentId: department_id,
      priorityLevel,
    });

    await client.query(
      `
        UPDATE appointments
        SET status = 'queued',
            queue_id = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE appointment_id = $1
      `,
      [appointment.appointment_id, queue.queue_id]
    );

    const details = await getAppointmentDetails(client, appointment.appointment_id);
    const positionInfo = await getQueuePositionInfo(client, queue.queue_id, department_id);

    await client.query("COMMIT");

    res.status(201).json({
      message: "Appointment booked successfully.",
      appointment: {
        ...mapAppointmentRow(details),
        position: positionInfo.position,
        estimatedWait: positionInfo.estimatedWaitTime,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Unable to create appointment right now." });
  } finally {
    client.release();
  }
}

async function createQuickIntake(req, res) {
  const {
    name,
    age,
    gender,
    mobile,
    department_id,
    symptoms,
    emergency_contact,
    address,
    created_by_name,
  } = req.body;

  if (!name?.trim() || !department_id) {
    return res.status(400).json({ error: "Patient name and department are required for quick intake." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const departmentResult = await client.query(
      "SELECT department_id FROM departments WHERE department_id = $1 LIMIT 1",
      [department_id]
    );

    if (!departmentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Selected department is not available." });
    }

    const normalizedMobile = normalizeOptionalPhone(mobile);
    const normalizedEmergency = normalizeOptionalPhone(emergency_contact);

    const patientResult = await client.query(
      `
        INSERT INTO patients (name, age, gender, phone, address, emergency_contact)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        name.trim(),
        Number(age) || 0,
        gender || null,
        normalizedMobile,
        address?.trim() || null,
        normalizedEmergency,
      ]
    );

    const patient = patientResult.rows[0];

    if (normalizedMobile) {
      await client.query(
        `
          INSERT INTO patient_accounts (patient_id, mobile, account_source, created_by_role, created_by_name)
          VALUES ($1, $2, 'staff-assisted', 'receptionist', $3)
          ON CONFLICT (mobile) DO NOTHING
        `,
        [patient.patient_id, normalizedMobile, String(created_by_name || "Front Desk").trim() || "Front Desk"]
      );
    }

    const patientAge = Number(patient.age) || 0;
    const appointmentResult = await client.query(
      `
        INSERT INTO appointments (patient_id, department_id, symptoms, pain_scale, status)
        VALUES ($1, $2, $3, $4, 'booked')
        RETURNING *
      `,
        [
          patient.patient_id,
          department_id,
          String(symptoms || "Quick intake by reception").trim() || "Quick intake by reception",
          0,
        ]
      );

    const appointment = appointmentResult.rows[0];
    const suggestedPriorityLevel = await determinePriorityLevel({
      symptoms: appointment.symptoms,
      painScale: 0,
      age: patientAge,
      isPregnant: false,
      isDisabled: false,
    });
    const priorityLevel = Math.min(suggestedPriorityLevel, 2);

    const queue = await createQueueEntry(client, {
      appointmentId: appointment.appointment_id,
      patientId: patient.patient_id,
      departmentId: department_id,
      priorityLevel,
    });

    await client.query(
      `
        UPDATE appointments
        SET status = 'queued',
            queue_id = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE appointment_id = $1
      `,
      [appointment.appointment_id, queue.queue_id]
    );

    const casePayload = await getCasePayload(client, queue.queue_id);

    await client.query("COMMIT");

    res.status(201).json({
      message: "Quick intake completed and patient added to the queue.",
      case: casePayload,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Unable to complete quick intake right now." });
  } finally {
    client.release();
  }
}

async function getCaseByQueueId(req, res) {
  const queueId = Number(req.params.queue_id);

  if (!Number.isFinite(queueId)) {
    return res.status(400).json({ error: "Invalid queue id." });
  }

  try {
    const payload = await getCasePayload(pool, queueId);
    if (!payload) {
      return res.status(404).json({ error: "Case not found." });
    }

    res.json({ case: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to load patient case right now." });
  }
}

async function getMyActiveAppointment(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          a.*,
          d.name AS department_name,
          q.queue_id,
          q.token_number,
          q.priority_level,
          q.status AS queue_status
        FROM appointments a
        JOIN departments d ON d.department_id = a.department_id
        LEFT JOIN queue q ON q.appointment_id = a.appointment_id
        WHERE a.patient_id = $1
          AND a.status IN ('booked', 'queued', 'ready-for-doctor', 'in-progress')
        ORDER BY a.created_at DESC
        LIMIT 1
      `,
      [req.auth.patient_id]
    );

    if (!result.rows.length) {
      return res.json({ appointment: null });
    }

    const appointment = result.rows[0];
    let position = null;
    let estimatedWait = null;

    if (appointment.queue_id) {
      const positionInfo = await getQueuePositionInfo(pool, appointment.queue_id, appointment.department_id);
      position = positionInfo.position;
      estimatedWait = positionInfo.estimatedWaitTime;
    }

    res.json({
      appointment: {
        ...mapAppointmentRow(appointment),
        position,
        estimatedWait,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to load active appointment." });
  }
}

async function getMyAppointmentHistory(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          a.*,
          d.name AS department_name,
          q.queue_id,
          q.token_number,
          q.priority_level,
          q.status AS queue_status
        FROM appointments a
        JOIN departments d ON d.department_id = a.department_id
        LEFT JOIN queue q ON q.appointment_id = a.appointment_id
        WHERE a.patient_id = $1
        ORDER BY a.created_at DESC
      `,
      [req.auth.patient_id]
    );

    res.json({
      appointments: result.rows.map(mapAppointmentRow),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to load appointment history." });
  }
}

async function cancelAppointment(req, res) {
  const appointmentId = Number(req.params.id);

  if (!Number.isFinite(appointmentId)) {
    return res.status(400).json({ error: "Invalid appointment id." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          a.*,
          q.queue_id,
          q.status AS queue_status
        FROM appointments a
        LEFT JOIN queue q ON q.appointment_id = a.appointment_id
        WHERE a.appointment_id = $1 AND a.patient_id = $2
        LIMIT 1
      `,
      [appointmentId, req.auth.patient_id]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Appointment not found." });
    }

    const appointment = result.rows[0];

    if (!["booked", "queued"].includes(appointment.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Only booked or queued appointments can be cancelled." });
    }

    await client.query(
      `
        UPDATE appointments
        SET status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP
        WHERE appointment_id = $1
      `,
      [appointmentId]
    );

    if (appointment.queue_id && appointment.queue_status === "waiting") {
      await client.query(
        `
          UPDATE queue
          SET status = 'cancelled'
          WHERE queue_id = $1
        `,
        [appointment.queue_id]
      );
    }

    const refreshed = await getAppointmentDetails(client, appointmentId);

    await client.query("COMMIT");

    res.json({
      message: "Appointment cancelled successfully.",
      appointment: refreshed ? mapAppointmentRow(refreshed) : null,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Unable to cancel appointment right now." });
  } finally {
    client.release();
  }
}

module.exports = {
  createAppointment,
  createQuickIntake,
  getCaseByQueueId,
  getMyActiveAppointment,
  getMyAppointmentHistory,
  cancelAppointment,
  saveDoctorUpdate,
};
