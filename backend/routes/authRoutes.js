const express = require("express");
const router = express.Router();

const {
  signupPatient,
  createAssistedPatientAccount,
  requestPatientOtp,
  verifyPatientOtp,
  getCurrentPatient,
} = require("../controllers/authController");
const { requirePatientAuth } = require("../middleware/authMiddleware");

router.post("/patient/signup", signupPatient);
router.post("/staff/patient-account", createAssistedPatientAccount);
router.post("/patient/request-otp", requestPatientOtp);
router.post("/patient/verify-otp", verifyPatientOtp);
router.get("/me", requirePatientAuth, getCurrentPatient);

module.exports = router;
