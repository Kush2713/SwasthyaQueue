const express = require("express");
const router = express.Router();

const {
  registerPatient,
  updatePatientProfile,
  updatePatientProfileById,
  lookupPatients,
} = require("../controllers/patientController");
const { requirePatientAuth, requireRoles } = require("../middleware/authMiddleware");

// API route
router.get("/lookup", requireRoles(["receptionist", "nurse", "doctor"]), lookupPatients);
router.post("/register", requireRoles(["receptionist"]), registerPatient);
router.put("/me", requirePatientAuth, updatePatientProfile);
router.put("/:id/profile", requireRoles(["receptionist"]), updatePatientProfileById);

module.exports = router;
