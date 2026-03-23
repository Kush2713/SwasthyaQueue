const express = require("express");
const router = express.Router();

const { registerPatient } = require("../controllers/patientController");

// API route
router.post("/register", registerPatient);

module.exports = router;