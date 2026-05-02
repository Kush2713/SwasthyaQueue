const express = require("express");
const router = express.Router();

const {
  signupPatient,
  createAssistedPatientAccount,
  requestPatientOtp,
  verifyPatientOtp,
  loginStaff,
  getCurrentSession,
} = require("../controllers/authController");
const {
  listStaff,
  updateStaffAssignments,
  resetStaffPassword,
} = require("../controllers/staffAdminController");
const { requireAuth, requirePatientAuth, requireRoles } = require("../middleware/authMiddleware");

router.post("/patient/signup", signupPatient);
router.post("/staff/login", loginStaff);
router.post("/staff/patient-account", requireRoles(["receptionist", "admin"]), createAssistedPatientAccount);
router.post("/patient/request-otp", requestPatientOtp);
router.post("/patient/verify-otp", verifyPatientOtp);
router.get("/me", requireAuth, getCurrentSession);
router.get("/admin/staff", requireRoles(["admin"]), listStaff);
router.put("/admin/staff/:staff_id/assignments", requireRoles(["admin"]), updateStaffAssignments);
router.put("/admin/staff/:staff_id/password", requireRoles(["admin"]), resetStaffPassword);

module.exports = router;
