const PROFILES = {
  1: {
    department: "General Medicine",
    required: ["temperature_f", "blood_pressure", "pulse_rate", "spo2"],
  },
  2: {
    department: "Cardiology",
    required: ["blood_pressure", "pulse_rate", "spo2"],
  },
  3: {
    department: "Orthopedics",
    required: ["blood_pressure", "pulse_rate"],
  },
  4: {
    department: "Pediatrics",
    required: ["temperature_f", "pulse_rate", "spo2", "weight_kg"],
  },
  5: {
    department: "Emergency",
    required: ["temperature_f", "blood_pressure", "pulse_rate", "spo2", "triage_notes"],
  },
};

const FIELD_LABELS = {
  temperature_f: "Temperature (F)",
  blood_pressure: "Blood Pressure",
  pulse_rate: "Pulse",
  spo2: "SpO2",
  weight_kg: "Weight (kg)",
  triage_notes: "Triage Notes",
};

function getClinicalProfile(departmentId) {
  return PROFILES[Number(departmentId)] || {
    department: "General Medicine",
    required: ["temperature_f", "blood_pressure", "pulse_rate", "spo2"],
  };
}

function isMissingValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function getMissingRequiredFields(profile, values) {
  return (profile.required || []).filter((field) => isMissingValue(values[field]));
}

function formatMissingFieldNames(fields) {
  return fields.map((field) => FIELD_LABELS[field] || field);
}

module.exports = {
  getClinicalProfile,
  getMissingRequiredFields,
  formatMissingFieldNames,
};

