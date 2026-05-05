import { publishQueueUpdate } from "./realtimeSync";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000";
const AUTH_SESSION_KEY = "swasthyaqueue_session";

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

export function getStoredSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveSession(user) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}

export function getAuthToken() {
  return getStoredSession()?.authToken || "";
}

export function normalizePriority(priorityLevel) {
  if (priorityLevel === 1) return "critical";
  if (priorityLevel === 2) return "high";
  return "normal";
}

export function getDepartmentIdByName(name) {
  return DEPARTMENT_NAME_TO_ID[name] || 1;
}

export function getDepartmentNameById(id) {
  const match = Object.entries(DEPARTMENT_NAME_TO_ID).find(([, departmentId]) => departmentId === id);
  return match?.[0] || "General Medicine";
}

async function request(path, options = {}) {
  const authToken = options.authToken || getAuthToken();
  const response = await fetch(apiUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

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

export function signupPatientAccount(payload) {
  return request("/api/auth/patient/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createStaffAssistedPatientAccount(payload) {
  return request("/api/auth/staff/patient-account", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function requestPatientOtp(payload) {
  return request("/api/auth/patient/request-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyPatientOtp(payload) {
  return request("/api/auth/patient/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginPatientWithGoogle(payload) {
  return request("/api/auth/patient/google-login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function signupPatientWithGoogle(payload) {
  return request("/api/auth/patient/google-signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginStaff(payload) {
  return request("/api/auth/staff/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentSession() {
  return request("/api/auth/me");
}

export function updateMyPatientProfile(payload) {
  return request("/api/patients/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function createAppointment(payload) {
  return request("/api/appointments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createQuickIntake(payload) {
  return request("/api/appointments/quick-intake", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCaseByQueueId(queueId) {
  return request(`/api/appointments/case/queue/${queueId}`);
}

export function updatePatientProfileById(patientId, payload) {
  return request(`/api/patients/${patientId}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function lookupPatients(query) {
  const encoded = encodeURIComponent(String(query || "").trim());
  return request(`/api/patients/lookup?q=${encoded}`);
}

export function saveDoctorUpdate(appointmentId, payload) {
  return request(`/api/appointments/${appointmentId}/doctor-update`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMyActiveAppointment() {
  return request("/api/appointments/me/active");
}

export function getMyAppointmentHistory() {
  return request("/api/appointments/me/history");
}

export function cancelAppointment(appointmentId) {
  return request(`/api/appointments/${appointmentId}/cancel`, {
    method: "POST",
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
  }).then((response) => {
    publishQueueUpdate();
    return response;
  });
}

export function completePatient(payload) {
  return request("/api/queue/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function flagUrgentReview(queueId, payload) {
  return request(`/api/queue/${queueId}/urgent-review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function overrideQueuePriority(queueId, payload) {
  return request(`/api/queue/${queueId}/override-priority`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function confirmQueuePriority(queueId, payload) {
  return request(`/api/queue/${queueId}/confirm-priority`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export function recordNurseTriage(queueId, payload) {
  return request(`/api/queue/${queueId}/triage`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function markReadyForDoctor(queueId, payload) {
  return request(`/api/queue/${queueId}/ready-for-doctor`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getQueueByDepartment(departmentId, date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return request(`/api/queue/${departmentId}${query}`);
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
