const pool = require("./db");
const queueRoutes = require("./routes/queueRoutes");
const express = require("express");
const cors = require("cors");
const path = require("path");
const patientRoutes = require("./routes/patientRoutes");
const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const { ensureSchema } = require("./bootstrap/ensureSchema");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/playground", express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/queue", queueRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("SwasthyaQueue Backend Running...");
});

app.get("/playground", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "api-playground.html"));
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

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to bootstrap schema", err);
    process.exit(1);
  });
