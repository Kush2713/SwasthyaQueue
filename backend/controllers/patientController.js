const pool = require("../db");

// Register Patient
const registerPatient = async (req, res) => {
  try {
    const { name, age, gender, phone } = req.body;

    // Insert into DB
    const result = await pool.query(
      "INSERT INTO patients (name, age, gender, phone) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, age, gender, phone]
    );

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

    res.json({
      message: "Patient profile updated successfully.",
      patient: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to update patient profile." });
  }
};

// Export function
module.exports = { registerPatient, updatePatientProfile, updatePatientProfileById };
