const DEPARTMENT_CODES = {
  "General Medicine": "GEN",
  Cardiology: "CAR",
  Orthopedics: "ORT",
  Pediatrics: "PED",
  Emergency: "EMR",
};

// Accepts either a date string/timestamp and normalizes to YYYY-MM-DD for token labels.
function normalizeDatePart(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

// Uses mapped short codes for known departments, otherwise derives a safe 3-letter fallback.
function getDepartmentCode(name = "") {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) return "DEP";
  if (DEPARTMENT_CODES[normalizedName]) return DEPARTMENT_CODES[normalizedName];
  const letters = normalizedName.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (letters.length >= 3) return letters.slice(0, 3);
  if (letters.length > 0) return letters.padEnd(3, "X");
  return "DEP";
}

// Public formatter used across APIs/UI: DEPT-YYYY-MM-DD-###
function formatTokenLabel({ departmentName, tokenDate, tokenNumber }) {
  if (!Number.isFinite(Number(tokenNumber))) return null;
  const datePart = normalizeDatePart(tokenDate);
  if (!datePart) return null;
  const tokenPart = String(Number(tokenNumber)).padStart(3, "0");
  const dept = getDepartmentCode(departmentName);
  return `${dept}-${datePart}-${tokenPart}`;
}

module.exports = {
  getDepartmentCode,
  formatTokenLabel,
};
