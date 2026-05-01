const express = require("express");
const router = express.Router();

const {
  addDoctor,
  getDoctorsByDepartment
} = require("../controllers/doctorController");

// Add doctor
router.post("/add", addDoctor);

// Get doctors by department
router.get("/:department_id", getDoctorsByDepartment);

module.exports = router;