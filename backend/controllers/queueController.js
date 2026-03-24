const pool = require("../db");
const axios = require("axios");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:5001";


// ✅ Add patient to queue with ML + fallback logic
const addToQueue = async (req, res) => {
  try {
    const { patient_id, department_id, symptoms, pain_scale, age } = req.body;

    // 🔴 Validation
    if (!patient_id || !department_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let priority_level;

    // ============================
    // 🤖 STEP 1: CALL ML MODEL
    // ============================
    try {
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
        age: age || 30,
        pain_scale: pain_scale || 0,
        symptom_code: 2 // (static for now)
      });

      priority_level = mlResponse.data.priority;

    } catch (mlError) {
      console.log("⚠️ ML failed, using fallback logic");

      // ============================
      // 🔁 FALLBACK LOGIC (OLD LOGIC)
      // ============================
      priority_level = 3;

      if (
        symptoms?.toLowerCase().includes("chest pain") ||
        symptoms?.toLowerCase().includes("breathing") ||
        symptoms?.toLowerCase().includes("unconscious")
      ) {
        priority_level = 1;
      }
      else if (pain_scale >= 8) {
        priority_level = 1;
      }
      else if (pain_scale >= 5) {
        priority_level = 2;
      }

      if (age >= 60 || age <= 5) {
        priority_level = Math.min(priority_level, 2);
      }

      if (req.body.is_pregnant || req.body.is_disabled) {
        priority_level = 1;
      }
    }

    // ============================
    // 🔢 TOKEN GENERATION
    // ============================
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM queue WHERE department_id = $1",
      [department_id]
    );

    const token_number = parseInt(countResult.rows[0].count) + 1;

    // ============================
    // ✅ INSERT INTO DB
    // ============================
    const result = await pool.query(
      `INSERT INTO queue (patient_id, department_id, priority_level, token_number, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [patient_id, department_id, priority_level, token_number, "waiting"]
    );

    res.status(201).json({
      message: "Added to queue successfully",
      priority_used: priority_level,
      queue: result.rows[0],
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};



// ✅ Get queue + estimated wait time
const getQueueByDepartment = async (req, res) => {
  try {
    const { department_id } = req.params;

    const dept = await pool.query(
      "SELECT avg_consult_time FROM departments WHERE department_id = $1",
      [department_id]
    );

    const avgTime = dept.rows[0].avg_consult_time;

    const result = await pool.query(
      `SELECT q.*, p.name 
       FROM queue q
       JOIN patients p ON q.patient_id = p.patient_id
       WHERE q.department_id = $1
       ORDER BY priority_level ASC, token_number ASC`,
      [department_id]
    );

    let enhancedQueue = result.rows.map((patient, index) => ({
      ...patient,
      estimated_wait_time: index * avgTime
    }));

    res.json(enhancedQueue);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};



// 🔔 Check patient turn
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
      `SELECT q.*, p.name 
       FROM queue q
       JOIN patients p ON q.patient_id = p.patient_id
       WHERE q.department_id = $1
       ORDER BY priority_level ASC, token_number ASC`,
      [department_id]
    );

    let index = result.rows.findIndex(
      (p) => p.patient_id === patient_id
    );

    if (index === -1) {
      return res.status(404).json({ message: "Patient not in queue" });
    }

    let wait_time = index * avgTime;

    res.json({
      patient_id,
      estimated_wait_time: wait_time,
      alert_message: wait_time <= 10 ? "Your turn is coming soon" : "Please wait"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};



// 👨‍⚕️ Call next patient
const callNextPatient = async (req, res) => {
  try {
    const { department_id } = req.body;

    const result = await pool.query(
      `SELECT * FROM queue
       WHERE department_id = $1 AND status = 'waiting'
       ORDER BY priority_level ASC, token_number ASC
       LIMIT 1`,
      [department_id]
    );

    if (result.rows.length === 0) {
      return res.json({ message: "No patients in queue" });
    }

    const patient = result.rows[0];

    await pool.query(
      `UPDATE queue SET status = 'in-progress' WHERE queue_id = $1`,
      [patient.queue_id]
    );

    res.json({
      message: "Next patient called",
      patient
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};



// ✅ Complete patient
const completePatient = async (req, res) => {
  try {
    const { queue_id } = req.body;

    const result = await pool.query(
      `UPDATE queue
       SET status = 'completed'
       WHERE queue_id = $1
       RETURNING *`,
      [queue_id]
    );

    res.json({
      message: "Patient marked as completed",
      patient: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};



// 📊 Stats
const getStats = async (req, res) => {
  try {
    const total = await pool.query("SELECT COUNT(*) FROM queue");
    const waiting = await pool.query("SELECT COUNT(*) FROM queue WHERE status = 'waiting'");
    const completed = await pool.query("SELECT COUNT(*) FROM queue WHERE status = 'completed'");

    res.json({
      total_patients: parseInt(total.rows[0].count),
      waiting_patients: parseInt(waiting.rows[0].count),
      completed_patients: parseInt(completed.rows[0].count)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};



// 📍 Get Position
const getPosition = async (req, res) => {
  try {
    const { patient_id, department_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM queue
       WHERE department_id = $1
       ORDER BY priority_level ASC, token_number ASC`,
      [department_id]
    );

    const index = result.rows.findIndex(
      (p) => p.patient_id == patient_id
    );

    if (index === -1) {
      return res.status(404).json({ message: "Patient not in queue" });
    }

    res.json({ position: index + 1 });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};



// ✅ EXPORTS (VERY IMPORTANT)
module.exports = {
  addToQueue,
  getQueueByDepartment,
  checkTurn,
  callNextPatient,
  completePatient,
  getStats,
  getPosition
};
