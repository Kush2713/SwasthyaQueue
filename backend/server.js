const pool = require("./db");
const queueRoutes = require("./routes/queueRoutes");
const express = require("express");
const cors = require("cors");
const patientRoutes = require("./routes/patientRoutes");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/patients", patientRoutes);
app.use("/api/queue", queueRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("SwasthyaQueue Backend Running...");
});

// DB Test Route
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM departments");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Error");
  }
});

// Server Start (LAST)
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});