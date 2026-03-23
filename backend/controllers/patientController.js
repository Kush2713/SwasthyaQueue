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

// Export function
module.exports = { registerPatient };