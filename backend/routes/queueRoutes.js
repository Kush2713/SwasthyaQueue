const express = require("express");
const router = express.Router();

const {
  addToQueue,
  getQueueByDepartment,
  checkTurn,
  callNextPatient,
  completePatient,
  getStats,
  getPosition,
  flagUrgentReview,
  approvePriorityOverride,
  recordNurseTriage,
  markReadyForDoctor,
} = require("../controllers/queueController");
const { requireRoles } = require("../middleware/authMiddleware");

router.get("/stats", requireRoles(["receptionist", "nurse", "doctor"]), getStats);
router.get("/position/:patient_id/:department_id", requireRoles(["patient", "receptionist", "nurse", "doctor"]), getPosition);

router.post("/add", requireRoles(["receptionist"]), addToQueue);
router.post("/check-turn", requireRoles(["patient", "receptionist", "nurse", "doctor"]), checkTurn);
router.post("/next", requireRoles(["receptionist"]), callNextPatient);
router.post("/complete", requireRoles(["doctor"]), completePatient);
router.post("/:queue_id/urgent-review", requireRoles(["receptionist"]), flagUrgentReview);
router.post("/:queue_id/override-priority", requireRoles(["nurse"]), approvePriorityOverride);
router.post("/:queue_id/triage", requireRoles(["nurse"]), recordNurseTriage);
router.post("/:queue_id/ready-for-doctor", requireRoles(["nurse"]), markReadyForDoctor);

router.get("/:department_id", requireRoles(["receptionist", "nurse", "doctor"]), getQueueByDepartment);

module.exports = router;
