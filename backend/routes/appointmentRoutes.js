const express = require("express");
const router = express.Router();

const {
  createAppointment,
  createQuickIntake,
  getCaseByQueueId,
  getMyActiveAppointment,
  getMyAppointmentHistory,
  cancelAppointment,
  saveDoctorUpdate,
} = require("../controllers/appointmentController");
const { requirePatientAuth } = require("../middleware/authMiddleware");

router.get("/me/active", requirePatientAuth, getMyActiveAppointment);
router.get("/me/history", requirePatientAuth, getMyAppointmentHistory);
router.get("/case/queue/:queue_id", getCaseByQueueId);
router.post("/quick-intake", createQuickIntake);
router.post("/:id/doctor-update", saveDoctorUpdate);
router.post("/:id/cancel", requirePatientAuth, cancelAppointment);
router.post("/", requirePatientAuth, createAppointment);

module.exports = router;
