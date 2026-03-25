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

router.get("/stats", getStats);
router.get("/position/:patient_id/:department_id", getPosition);

router.post("/add", addToQueue);
router.post("/check-turn", checkTurn);
router.post("/next", callNextPatient);
router.post("/complete", completePatient);
router.post("/:queue_id/urgent-review", flagUrgentReview);
router.post("/:queue_id/override-priority", approvePriorityOverride);
router.post("/:queue_id/triage", recordNurseTriage);
router.post("/:queue_id/ready-for-doctor", markReadyForDoctor);

router.get("/:department_id", getQueueByDepartment);

module.exports = router;
