const pool = require("../db");

// Add Doctor
const addDoctor = async (req, res) => {
  try {
    const { name, department_id } = req.body;

    if (!name || !department_id) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const result = await pool.query(
      "INSERT INTO doctors (name, department_id) VALUES ($1, $2) RETURNING *",
      [name, department_id]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get doctors by department
const getDoctorsByDepartment = async (req, res) => {
  try {
    const { department_id } = req.params;

    const result = await pool.query(
      "SELECT * FROM doctors WHERE department_id = $1",
      [department_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// const getDoctorsByDepartment = async (req, res) => {
//   res.json([
//     { doctor_id: 1, name: "Dr. Sharma", department_id: 1 },
//     { doctor_id: 2, name: "Dr. Mehta", department_id: 1 },
//     { doctor_id: 3, name: "Dr. Rao", department_id: 1 }
//   ]);
// };

module.exports = {
  addDoctor,
  getDoctorsByDepartment
};