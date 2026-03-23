const express = require("express");
const router = express.Router();

const { 
  addToQueue, 
  getQueueByDepartment, 
  checkTurn, 
  callNextPatient, 
  completePatient, 
  getStats,
  getPosition   // 🆕 NEW
} = require("../controllers/queueController");


// 🔥 IMPORTANT: Keep specific routes BEFORE dynamic ones

router.get("/stats", getStats);

router.get("/position/:patient_id/:department_id", getPosition); // 🆕 NEW

router.post("/add", addToQueue);

router.post("/check-turn", checkTurn);

router.post("/next", callNextPatient);

router.post("/complete", completePatient);

// ⚠️ Always keep this LAST (dynamic route)
router.get("/:department_id", getQueueByDepartment);


module.exports = router;