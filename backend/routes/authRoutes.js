const express = require("express");
const router = express.Router();

const {
  signupPatient,
  createAssistedPatientAccount,
  requestPatientOtp,
  verifyPatientOtp,
  loginPatientWithGoogle,
  loginStaff,
  getCurrentSession,
} = require("../controllers/authController");
const { requireAuth, requirePatientAuth, requireRoles } = require("../middleware/authMiddleware");

router.post("/patient/signup", signupPatient);
router.post("/staff/login", loginStaff);
router.post("/staff/patient-account", requireRoles(["receptionist"]), createAssistedPatientAccount);
router.post("/patient/request-otp", requestPatientOtp);
router.post("/patient/verify-otp", verifyPatientOtp);
router.post("/patient/google-login", loginPatientWithGoogle);
router.get("/me", requireAuth, getCurrentSession);
module.exports = router;
