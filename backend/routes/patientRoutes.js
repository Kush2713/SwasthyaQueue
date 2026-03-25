const express = require("express");
const router = express.Router();

const { registerPatient, updatePatientProfile, updatePatientProfileById } = require("../controllers/patientController");
const { requirePatientAuth } = require("../middleware/authMiddleware");

// API route
router.post("/register", registerPatient);
router.put("/me", requirePatientAuth, updatePatientProfile);
router.put("/:id/profile", updatePatientProfileById);

module.exports = router;
