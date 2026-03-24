const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000";

const DEPARTMENT_NAME_TO_ID = {
  "General Medicine": 1,
  Cardiology: 2,
  Orthopedics: 3,
  Orthopaedics: 3,
  Pediatrics: 4,
  Emergency: 5,
  "Gynecology & Obstetrics": 1,
  "General Surgery": 1,
  ENT: 1,
};

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export function normalizePriority(priorityLevel) {
  if (priorityLevel === 1) return "critical";
  if (priorityLevel === 2) return "high";
  return "normal";
}

export function getDepartmentIdByName(name) {
  return DEPARTMENT_NAME_TO_ID[name] || 1;
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
  }

  return data;
}

export function registerPatient(payload) {
  return request("/api/patients/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addToQueue(payload) {
  return request("/api/queue/add", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function checkTurn(payload) {
  return request("/api/queue/check-turn", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function callNextPatient(payload) {
  return request("/api/queue/next", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completePatient(payload) {
  return request("/api/queue/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getQueueByDepartment(departmentId) {
  return request(`/api/queue/${departmentId}`);
}

export function getQueuePosition(patientId, departmentId) {
  return request(`/api/queue/position/${patientId}/${departmentId}`);
}

export function getQueueStats() {
  return request("/api/queue/stats");
}

export function getDepartments() {
  return request("/test-db");
}
