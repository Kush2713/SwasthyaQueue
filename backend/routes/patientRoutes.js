const express = require("express");
const router = express.Router();

const { registerPatient, updatePatientProfile, updatePatientProfileById, lookupPatients } = require("../controllers/patientController");
const { requirePatientAuth, requireRoles } = require("../middleware/authMiddleware");

// API route
router.post("/register", requireRoles(["receptionist"]), registerPatient);
router.put("/me", requirePatientAuth, updatePatientProfile);
router.put("/:id/profile", requireRoles(["receptionist"]), updatePatientProfileById);
router.get("/lookup", requireRoles(["receptionist", "nurse", "doctor"]), lookupPatients);

module.exports = router;
