const pool = require("../db");
const { logWorkflowEvent } = require("../utils/audit");
const { getActorFromRequest } = require("../middleware/authMiddleware");
const { formatTokenLabel } = require("../utils/tokenLabel");
const HOSPITAL_TIMEZONE = process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata";

// Register Patient
const registerPatient = async (req, res) => {
  try {
    const { name, age, gender, phone } = req.body;
    const actor = getActorFromRequest(req, { role: "receptionist", name: "Front Desk" });

    // Insert into DB
    const result = await pool.query(
      "INSERT INTO patients (name, age, gender, phone) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, age, gender, phone]
    );

    await logWorkflowEvent(pool, {
      actor,
      action: "patient_registered",
      entityType: "patient",
      entityId: result.rows[0].patient_id,
      patientId: result.rows[0].patient_id,
      details: { phone: phone || null },
    });

    res.status(201).json({
      message: "Patient registered successfully",
      patient: result.rows[0],
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

const updatePatientProfile = async (req, res) => {
  try {
    const patientId = req.auth.patient_id;
    const actor = getActorFromRequest(req);
    const {
      name,
      age,
      gender,
      mobile,
      email,
      address,
      emergencyContact,
      bloodGroup,
      allergies,
      chronicConditions,
    } = req.body;

    const result = await pool.query(
      `
        UPDATE patients
        SET name = $2,
            age = $3,
            gender = $4,
            phone = $5,
            email = $6,
            address = $7,
            emergency_contact = $8,
            blood_group = $9,
            allergies = $10,
            chronic_conditions = $11
        WHERE patient_id = $1
        RETURNING *
      `,
      [
        patientId,
        name?.trim(),
        Number(age),
        gender,
        mobile,
        email || null,
        address || null,
        emergencyContact || null,
        bloodGroup || null,
        allergies || null,
        chronicConditions || null,
      ]
    );

    await pool.query(
      `
        UPDATE patient_accounts
        SET email = $2,
            mobile = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE patient_id = $1
      `,
      [patientId, email || null, mobile]
    );

    await logWorkflowEvent(pool, {
      actor,
      action: "patient_profile_updated",
      entityType: "patient",
      entityId: patientId,
      patientId,
      details: {
        mobile: mobile || null,
        email: email || null,
      },
    });

    res.json({
      message: "Patient profile updated successfully",
      patient: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to update patient profile" });
  }
};

const updatePatientProfileById = async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const actor = getActorFromRequest(req, { role: "receptionist", name: "Front Desk" });
    const {
      name,
      age,
      gender,
      mobile,
      email,
      address,
      emergencyContact,
      bloodGroup,
      allergies,
      chronicConditions,
    } = req.body;

    if (!Number.isFinite(patientId)) {
      return res.status(400).json({ error: "Invalid patient id." });
    }

    const result = await pool.query(
      `
        UPDATE patients
        SET name = $2,
            age = $3,
            gender = $4,
            phone = $5,
            email = $6,
            address = $7,
            emergency_contact = $8,
            blood_group = $9,
            allergies = $10,
            chronic_conditions = $11
        WHERE patient_id = $1
        RETURNING *
      `,
      [
        patientId,
        name?.trim(),
        Number(age) || 0,
        gender || null,
        mobile || null,
        email || null,
        address || null,
        emergencyContact || null,
        bloodGroup || null,
        allergies || null,
        chronicConditions || null,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Patient not found." });
    }

    await pool.query(
      `
        UPDATE patient_accounts
        SET email = $2,
            mobile = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE patient_id = $1
      `,
      [patientId, email || null, mobile || null]
    );

    await logWorkflowEvent(pool, {
      actor,
      action: "patient_profile_updated_by_staff",
      entityType: "patient",
      entityId: patientId,
      patientId,
      details: {
        mobile: mobile || null,
        email: email || null,
      },
    });

    res.json({
      message: "Patient profile updated successfully.",
      patient: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to update patient profile." });
  }
};

const lookupPatients = async (req, res) => {
  try {
    const rawQuery = String(req.query.q || "").trim();
    if (!rawQuery) {
      return res.status(400).json({ error: "Search query is required." });
    }

    const numericQuery = Number(rawQuery);
    const digitsQuery = rawQuery.replace(/\D/g, "");
    const likeQuery = `%${rawQuery.toLowerCase()}%`;
    const likeDigitsQuery = `%${digitsQuery}%`;

    const result = await pool.query(
      `
        SELECT
          p.patient_id,
          p.name,
          p.age,
          p.gender,
          p.phone,
          p.email,
          p.address,
          p.emergency_contact,
          latest.appointment_id,
          latest.appointment_status,
          latest.department_id,
          latest.department_name,
          latest.symptoms,
          latest.preferred_slot,
          latest.appointment_created_at,
          latest.queue_id,
          latest.token_number,
          latest.queue_status,
          latest.priority_level,
          latest.queue_created_at
        FROM patients p
        LEFT JOIN LATERAL (
          SELECT
            a.appointment_id,
            a.status AS appointment_status,
            a.department_id,
            d.name AS department_name,
            a.symptoms,
            a.preferred_slot,
            a.created_at AS appointment_created_at,
            q.queue_id,
            q.token_number,
            q.status AS queue_status,
            q.priority_level,
            q.created_at AS queue_created_at
          FROM appointments a
          JOIN departments d ON d.department_id = a.department_id
          LEFT JOIN queue q ON q.appointment_id = a.appointment_id
          WHERE a.patient_id = p.patient_id
          ORDER BY a.created_at DESC
          LIMIT 1
        ) latest ON TRUE
        WHERE
          ($2::bigint IS NOT NULL AND p.patient_id = $2::bigint)
          OR (
            $2::bigint IS NOT NULL
            AND latest.token_number = $2::bigint
            AND latest.queue_status IN ('waiting', 'in-progress')
            AND EXISTS (
              SELECT 1
              FROM queue q2
              WHERE q2.queue_id = latest.queue_id
                AND q2.created_at >= ((CURRENT_TIMESTAMP AT TIME ZONE $6)::date)::timestamp
            )
          )
          OR ($3::text <> '' AND REGEXP_REPLACE(COALESCE(p.phone, ''), '\\D', '', 'g') LIKE $4)
          OR ($3::text <> '' AND REGEXP_REPLACE(COALESCE(p.emergency_contact, ''), '\\D', '', 'g') LIKE $4)
          OR LOWER(p.name) LIKE $1
          OR LOWER(COALESCE(p.email, '')) LIKE $1
          OR LOWER(COALESCE(p.address, '')) LIKE $1
        ORDER BY
          CASE
            WHEN $2::bigint IS NOT NULL AND p.patient_id = $2::bigint THEN 0
            WHEN REGEXP_REPLACE(COALESCE(p.phone, ''), '\\D', '', 'g') = $3 THEN 1
            WHEN REGEXP_REPLACE(COALESCE(p.emergency_contact, ''), '\\D', '', 'g') = $3 THEN 2
            WHEN (
              $2::bigint IS NOT NULL
              AND latest.token_number = $2::bigint
              AND latest.queue_status IN ('waiting', 'in-progress')
            ) THEN 3
            WHEN LOWER(p.name) = LOWER($5) THEN 4
            ELSE 5
          END,
          p.name ASC
        LIMIT 20
      `,
      [
        likeQuery,
        Number.isFinite(numericQuery) ? numericQuery : null,
        digitsQuery,
        likeDigitsQuery,
        rawQuery,
        HOSPITAL_TIMEZONE,
      ]
    );

    const patientIds = result.rows.map((row) => row.patient_id).filter(Boolean);
    let historyByPatientId = {};

    if (patientIds.length) {
      const historyResult = await pool.query(
        `
          SELECT
            a.patient_id,
            a.appointment_id,
            a.status AS appointment_status,
            a.department_id,
            d.name AS department_name,
            a.symptoms,
            a.preferred_slot,
            a.created_at AS appointment_created_at,
            q.queue_id,
            q.token_number,
            q.status AS queue_status,
            q.priority_level,
            q.created_at AS queue_created_at,
            a.diagnosis,
            a.prescription,
            a.tests_ordered
          FROM appointments a
          JOIN departments d ON d.department_id = a.department_id
          LEFT JOIN queue q ON q.appointment_id = a.appointment_id
          WHERE a.patient_id = ANY($1::int[])
          ORDER BY a.created_at DESC
        `,
        [patientIds]
      );

      historyByPatientId = historyResult.rows.reduce((acc, row) => {
        if (!acc[row.patient_id]) acc[row.patient_id] = [];
        if (acc[row.patient_id].length < 8) {
          acc[row.patient_id].push({
            appointmentId: row.appointment_id,
            appointmentStatus: row.appointment_status,
            departmentId: row.department_id,
            department: row.department_name,
            symptoms: row.symptoms,
            preferredSlot: row.preferred_slot,
            createdAt: row.appointment_created_at,
            queueId: row.queue_id,
            token: row.token_number,
            tokenLabel: formatTokenLabel({
              departmentName: row.department_name,
              departmentId: row.department_id,
              queueCreatedAt: row.queue_created_at || row.appointment_created_at,
              tokenNumber: row.token_number,
            }),
            queueStatus: row.queue_status,
            priorityLevel: row.priority_level,
            diagnosis: row.diagnosis,
            prescription: row.prescription,
            testsOrdered: row.tests_ordered,
          });
        }
        return acc;
      }, {});
    }

    const patients = result.rows.map((row) => ({
      patientId: row.patient_id,
      name: row.name,
      age: row.age,
      gender: row.gender,
      mobile: row.phone,
      email: row.email,
      address: row.address,
      emergencyContact: row.emergency_contact,
      latestVisit: row.appointment_id
        ? {
            appointmentId: row.appointment_id,
            appointmentStatus: row.appointment_status,
            departmentId: row.department_id,
            department: row.department_name,
            symptoms: row.symptoms,
            preferredSlot: row.preferred_slot,
            createdAt: row.appointment_created_at,
            queueId: row.queue_id,
            token: row.token_number,
            tokenLabel: formatTokenLabel({
              departmentName: row.department_name,
              departmentId: row.department_id,
              queueCreatedAt: row.queue_created_at || row.appointment_created_at,
              tokenNumber: row.token_number,
            }),
            queueStatus: row.queue_status,
            priorityLevel: row.priority_level,
            queuedAt: row.queue_created_at,
          }
        : null,
      hasActiveQueue: ["waiting", "in-progress"].includes(row.queue_status),
      visitHistory: historyByPatientId[row.patient_id] || [],
    }));

    res.json({
      query: rawQuery,
      count: patients.length,
      patients,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to search patient records right now." });
  }
};

// Export function
module.exports = { registerPatient, updatePatientProfile, updatePatientProfileById, lookupPatients };
