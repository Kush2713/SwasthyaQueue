const pool = require("../db");
const { logWorkflowEvent } = require("../utils/audit");
const { getActorFromRequest } = require("../middleware/authMiddleware");
const { normalizeEmail, normalizeMobile, isValidIndianMobile } = require("../utils/auth");
const { formatTokenLabel } = require("../utils/token");
const HOSPITAL_TIMEZONE = process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata";

const ALLOWED_GENDERS = new Set(["male", "female", "other"]);

function isValidAge(value) {
  if (!Number.isFinite(Number(value))) return false;
  const age = Number(value);
  return age >= 0 && age <= 120;
}

function normalizeGender(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const lowered = text.toLowerCase();
  if (!ALLOWED_GENDERS.has(lowered)) return null;
  return lowered.charAt(0).toUpperCase() + lowered.slice(1);
}

function cleanOptionalText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeOptionalMobile(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!isValidIndianMobile(text)) return null;
  return normalizeMobile(text);
}

// Register Patient
const registerPatient = async (req, res) => {
  try {
    const { name, age, gender, phone } = req.body;
    const actor = getActorFromRequest(req, { role: "receptionist", name: "Front Desk" });
    const normalizedName = String(name || "").trim();
    const normalizedGender = normalizeGender(gender);
    const normalizedPhone = normalizeOptionalMobile(phone);

    if (!normalizedName) {
      return res.status(400).json({ error: "Full name is required." });
    }

    if (!isValidAge(age)) {
      return res.status(400).json({ error: "Please enter a valid age between 0 and 120." });
    }

    if (!normalizedGender) {
      return res.status(400).json({ error: "Gender must be Male, Female, or Other." });
    }

    if (String(phone || "").trim() && !normalizedPhone) {
      return res.status(400).json({ error: "Phone must be a valid 10-digit Indian mobile number." });
    }

    // Insert into DB
    const result = await pool.query(
      "INSERT INTO patients (name, age, gender, phone) VALUES ($1, $2, $3, $4) RETURNING *",
      [normalizedName, Number(age), normalizedGender, normalizedPhone]
    );

    await logWorkflowEvent(pool, {
      actor,
      action: "patient_registered",
      entityType: "patient",
      entityId: result.rows[0].patient_id,
      patientId: result.rows[0].patient_id,
      details: { phone: normalizedPhone || null },
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

// Patient lookup for front desk:
// 1) direct identifiers (patient_id / phone) first
// 2) same-day active token as fallback
// 3) broad text match (name/email/address)
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
          p.blood_group,
          p.allergies,
          p.chronic_conditions,
          latest.appointment_id,
          latest.appointment_status,
          latest.department_id,
          latest.department_name,
          latest.symptoms,
          latest.preferred_slot,
          latest.appointment_created_at,
          latest.queue_id,
          latest.token_number,
          latest.token_date,
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
            q.token_date,
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
          LOWER(p.name) LIKE $1
          OR LOWER(COALESCE(p.email, '')) LIKE $1
          OR LOWER(COALESCE(p.address, '')) LIKE $1
          OR ($2::bigint IS NOT NULL AND p.patient_id = $2::bigint)
          OR (
            $2::bigint IS NOT NULL
            AND latest.token_number = $2::bigint
            AND latest.token_date = (CURRENT_TIMESTAMP AT TIME ZONE $6)::date
            AND latest.queue_status IN ('waiting', 'in-progress')
          )
          OR ($3::text <> '' AND REGEXP_REPLACE(COALESCE(p.phone, ''), '\\D', '', 'g') LIKE $4)
          OR ($3::text <> '' AND REGEXP_REPLACE(COALESCE(p.emergency_contact, ''), '\\D', '', 'g') LIKE $4)
        ORDER BY
          -- Ranking keeps high-confidence identifier matches above fuzzy text matches.
          CASE
            WHEN $2::bigint IS NOT NULL AND p.patient_id = $2::bigint THEN 0
            WHEN REGEXP_REPLACE(COALESCE(p.phone, ''), '\\D', '', 'g') = $3 THEN 1
            WHEN REGEXP_REPLACE(COALESCE(p.emergency_contact, ''), '\\D', '', 'g') = $3 THEN 2
            WHEN (
              $2::bigint IS NOT NULL
              AND latest.token_number = $2::bigint
              AND latest.token_date = (CURRENT_TIMESTAMP AT TIME ZONE $6)::date
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

    const patients = result.rows.map((row) => ({
      patientId: row.patient_id,
      name: row.name,
      age: row.age,
      gender: row.gender,
      mobile: row.phone,
      email: row.email,
      address: row.address,
      emergencyContact: row.emergency_contact,
      bloodGroup: row.blood_group,
      allergies: row.allergies,
      chronicConditions: row.chronic_conditions,
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
            tokenDate: row.token_date,
            tokenLabel: formatTokenLabel({
              departmentName: row.department_name,
              tokenDate: row.token_date,
              tokenNumber: row.token_number,
            }),
            queueStatus: row.queue_status,
            priorityLevel: row.priority_level,
            queuedAt: row.queue_created_at,
          }
        : null,
      hasActiveQueue: ["waiting", "in-progress"].includes(row.queue_status),
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
    const normalizedName = String(name || "").trim();
    const normalizedGender = normalizeGender(gender);
    const normalizedMobile = normalizeOptionalMobile(mobile);
    const normalizedEmergencyContact = normalizeOptionalMobile(emergencyContact);
    const normalizedEmail = cleanOptionalText(email) ? normalizeEmail(email) : null;

    if (!normalizedName) {
      return res.status(400).json({ error: "Full name is required." });
    }

    if (!isValidAge(age)) {
      return res.status(400).json({ error: "Please enter a valid age between 0 and 120." });
    }

    if (!normalizedGender) {
      return res.status(400).json({ error: "Gender must be Male, Female, or Other." });
    }

    if (!normalizedMobile) {
      return res.status(400).json({ error: "A valid 10-digit Indian mobile number is required." });
    }

    if (cleanOptionalText(emergencyContact) && !normalizedEmergencyContact) {
      return res.status(400).json({ error: "Emergency contact must be a valid 10-digit Indian mobile number." });
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
        normalizedName,
        Number(age),
        normalizedGender,
        normalizedMobile,
        normalizedEmail,
        cleanOptionalText(address),
        normalizedEmergencyContact,
        cleanOptionalText(bloodGroup),
        cleanOptionalText(allergies),
        cleanOptionalText(chronicConditions),
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
      [patientId, normalizedEmail, normalizedMobile]
    );

    await logWorkflowEvent(pool, {
      actor,
      action: "patient_profile_updated",
      entityType: "patient",
      entityId: patientId,
      patientId,
      details: {
        mobile: normalizedMobile,
        email: normalizedEmail,
      },
    });

    res.json({
      message: "Patient profile updated successfully",
      patient: result.rows[0],
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "This mobile or email is already linked to another account." });
    }
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
    const normalizedName = String(name || "").trim();
    const normalizedGender = normalizeGender(gender);
    const normalizedMobile = normalizeOptionalMobile(mobile);
    const normalizedEmergencyContact = normalizeOptionalMobile(emergencyContact);
    const normalizedEmail = cleanOptionalText(email) ? normalizeEmail(email) : null;

    if (!Number.isFinite(patientId)) {
      return res.status(400).json({ error: "Invalid patient id." });
    }

    if (!normalizedName) {
      return res.status(400).json({ error: "Full name is required." });
    }

    if (!isValidAge(age)) {
      return res.status(400).json({ error: "Please enter a valid age between 0 and 120." });
    }

    if (!normalizedGender) {
      return res.status(400).json({ error: "Gender must be Male, Female, or Other." });
    }

    if (cleanOptionalText(mobile) && !normalizedMobile) {
      return res.status(400).json({ error: "Mobile must be a valid 10-digit Indian mobile number." });
    }

    if (cleanOptionalText(emergencyContact) && !normalizedEmergencyContact) {
      return res.status(400).json({ error: "Emergency contact must be a valid 10-digit Indian mobile number." });
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
        normalizedName,
        Number(age),
        normalizedGender,
        normalizedMobile,
        normalizedEmail,
        cleanOptionalText(address),
        normalizedEmergencyContact,
        cleanOptionalText(bloodGroup),
        cleanOptionalText(allergies),
        cleanOptionalText(chronicConditions),
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
      [patientId, normalizedEmail, normalizedMobile]
    );

    await logWorkflowEvent(pool, {
      actor,
      action: "patient_profile_updated_by_staff",
      entityType: "patient",
      entityId: patientId,
      patientId,
      details: {
        mobile: normalizedMobile,
        email: normalizedEmail,
      },
    });

    res.json({
      message: "Patient profile updated successfully.",
      patient: result.rows[0],
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "This mobile or email is already linked to another account." });
    }
    console.error(err);
    res.status(500).json({ error: "Unable to update patient profile." });
  }
};

// Export function
module.exports = { registerPatient, updatePatientProfile, updatePatientProfileById, lookupPatients };
