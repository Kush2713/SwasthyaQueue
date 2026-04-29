const DEPARTMENT_CODE = {
  "General Medicine": "GEN",
  Cardiology: "CAR",
  Orthopedics: "ORT",
  Pediatrics: "PED",
  Emergency: "EMR",
};

function formatDatePart(dateLike) {
  const date = new Date(dateLike || Date.now());
  if (Number.isNaN(date.getTime())) return "0000-00-00";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveDepartmentCode(departmentName, fallbackDepartmentId) {
  if (departmentName && DEPARTMENT_CODE[departmentName]) return DEPARTMENT_CODE[departmentName];
  const numericId = Number(fallbackDepartmentId);
  if (numericId === 1) return "GEN";
  if (numericId === 2) return "CAR";
  if (numericId === 3) return "ORT";
  if (numericId === 4) return "PED";
  if (numericId === 5) return "EMR";
  return "OPD";
}

function formatTokenLabel({ departmentName, departmentId, queueCreatedAt, tokenNumber }) {
  const n = Number(tokenNumber);
  if (!Number.isFinite(n) || n <= 0) return null;
  const code = resolveDepartmentCode(departmentName, departmentId);
  const datePart = formatDatePart(queueCreatedAt || Date.now());
  return `${code}-${datePart}-${String(n).padStart(3, "0")}`;
}

module.exports = {
  formatTokenLabel,
};

