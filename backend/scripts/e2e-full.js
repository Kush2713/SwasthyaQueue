/* eslint-disable no-console */
const axios = require("axios");
const pool = require("../db");

const BASE_URL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5000";
const RESET_BEFORE_RUN = String(process.env.FULL_E2E_RESET || "true").toLowerCase() !== "false";

const CASES = [
  {
    code: "GM-01",
    departmentId: 1,
    departmentName: "General Medicine",
    nurseUser: "nurse01",
    doctorUser: "doctor01",
    symptoms: "Fever, body ache, weakness",
    painScale: 3,
    triage: { temperature_f: 99.4, blood_pressure: "120/80", pulse_rate: 84, spo2: 98, weight_kg: 64 },
  },
  {
    code: "CD-01",
    departmentId: 2,
    departmentName: "Cardiology",
    nurseUser: "nurse01",
    doctorUser: "doctor_cardio01",
    symptoms: "Chest discomfort on exertion, mild sweating",
    painScale: 6,
    urgentReason: "Chest symptoms during waiting period",
    overridePriority: 2,
    triage: { temperature_f: 98.7, blood_pressure: "136/86", pulse_rate: 96, spo2: 97, weight_kg: 72 },
  },
  {
    code: "OR-01",
    departmentId: 3,
    departmentName: "Orthopedics",
    nurseUser: "nurse01",
    doctorUser: "doctor_ortho01",
    symptoms: "Knee swelling, pain while walking",
    painScale: 5,
    triage: { temperature_f: 98.6, blood_pressure: "124/82", pulse_rate: 82, spo2: 99, weight_kg: 70 },
  },
  {
    code: "PD-01",
    departmentId: 4,
    departmentName: "Pediatrics",
    nurseUser: "nurse01",
    doctorUser: "doctor_pedia01",
    symptoms: "Cough, fever, reduced appetite",
    painScale: 4,
    urgentReason: "Child looks dehydrated, fast reassessment requested",
    overridePriority: 2,
    triage: { temperature_f: 100.2, blood_pressure: "108/70", pulse_rate: 102, spo2: 98, weight_kg: 26 },
  },
  {
    code: "EM-01",
    departmentId: 5,
    departmentName: "Emergency",
    nurseUser: "nurse01",
    doctorUser: "doctor_emg01",
    symptoms: "Breathlessness, dizziness, near syncope",
    painScale: 8,
    urgentReason: "Possible acute episode",
    overridePriority: 1,
    triage: { temperature_f: 99.1, blood_pressure: "148/96", pulse_rate: 112, spo2: 94, weight_kg: 68 },
  },
];

function fail(message, meta) {
  if (meta) {
    console.error("❌", message, meta);
  } else {
    console.error("❌", message);
  }
  process.exit(1);
}

function assert(condition, message, meta) {
  if (!condition) fail(message, meta);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(method, path, { token, data } = {}) {
  const response = await axios({
    method,
    url: `${BASE_URL}${path}`,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    data,
    timeout: 15000,
    validateStatus: () => true,
  });

  if (response.status >= 400) {
    fail(`${method.toUpperCase()} ${path} failed`, {
      status: response.status,
      body: response.data,
    });
  }
  return response.data;
}

async function clearOperationalData() {
  if (!RESET_BEFORE_RUN) {
    console.log("ℹ️ FULL_E2E_RESET=false detected, skipping DB reset.");
    return;
  }

  await pool.query(
    "TRUNCATE TABLE workflow_events, queue, appointments, patient_accounts, patients RESTART IDENTITY CASCADE"
  );
  console.log("✅ Operational data reset completed.");
}

async function loginStaffUsers() {
  const receptionist = await api("post", "/api/auth/staff/login", {
    data: { userId: "receptionist01", password: "sqrecp123" },
  });
  const receptionistToken = receptionist?.user?.authToken;
  assert(receptionistToken, "Receptionist login failed: token missing.");

  const staffTokens = {
    receptionist: receptionistToken,
    nurse: {},
    doctor: {},
  };

  const uniqueNurses = Array.from(new Set(CASES.map((item) => item.nurseUser)));
  const uniqueDoctors = Array.from(new Set(CASES.map((item) => item.doctorUser)));

  for (const nurseUser of uniqueNurses) {
    const session = await api("post", "/api/auth/staff/login", {
      data: { userId: nurseUser, password: "sqnurse123" },
    });
    const token = session?.user?.authToken;
    assert(token, `Nurse login token missing for ${nurseUser}.`);
    staffTokens.nurse[nurseUser] = token;
  }

  for (const doctorUser of uniqueDoctors) {
    const session = await api("post", "/api/auth/staff/login", {
      data: { userId: doctorUser, password: "sqdoc123" },
    });
    const token = session?.user?.authToken;
    assert(token, `Doctor login token missing for ${doctorUser}.`);
    staffTokens.doctor[doctorUser] = token;
  }

  return staffTokens;
}

async function pushQueueToInProgress({ receptionistToken, departmentId, queueId }) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await api("post", "/api/queue/next", {
      token: receptionistToken,
      data: { department_id: departmentId },
    });

    const queueRows = await api("get", `/api/queue/${departmentId}`);
    const target = (queueRows || []).find((row) => row.queue_id === queueId);
    if (target?.status === "in-progress") return;
    await sleep(250);
  }
  fail("Could not move target queue item to in-progress after repeated call-next.", {
    departmentId,
    queueId,
  });
}

async function createAndVerifyPatient({ label, suffix }) {
  const mobile = `9${String(600000000 + suffix).slice(-9)}`;
  const email = `${label.toLowerCase()}_${suffix}@example.com`;

  const signup = await api("post", "/api/auth/patient/signup", {
    data: {
      name: `${label} Patient ${suffix}`,
      age: 30,
      gender: "Female",
      mobile,
      email,
      address: "Demo Address",
      bloodGroup: "O+",
      allergies: "None",
      chronicConditions: "None",
    },
  });

  const otp = signup?.devOtp;
  assert(otp, "devOtp missing. Ensure OTP_PREVIEW_ENABLED=true for test runs.");

  const verify = await api("post", "/api/auth/patient/verify-otp", {
    data: { identifier: mobile, otp },
  });

  const authToken = verify?.user?.authToken;
  const patientId = verify?.user?.patientId;
  assert(authToken && patientId, "Patient verify did not return auth token/patient id.");

  return { authToken, patientId, mobile };
}

async function runCase(caseConfig, staffTokens, index) {
  const suffix = Number(`${Date.now().toString().slice(-5)}${index}`);
  const patient = await createAndVerifyPatient({ label: caseConfig.code, suffix });

  const created = await api("post", "/api/appointments", {
    token: patient.authToken,
    data: {
      department_id: caseConfig.departmentId,
      symptoms: caseConfig.symptoms,
      pain_scale: caseConfig.painScale,
      preferred_slot: null,
    },
  });

  const appointment = created?.appointment;
  assert(appointment?.appointmentId && appointment?.queueId, "Appointment creation failed.", created);

  await pushQueueToInProgress({
    receptionistToken: staffTokens.receptionist,
    departmentId: caseConfig.departmentId,
    queueId: appointment.queueId,
  });

  if (caseConfig.urgentReason) {
    await api("post", `/api/queue/${appointment.queueId}/urgent-review`, {
      token: staffTokens.receptionist,
      data: { reason: caseConfig.urgentReason },
    });
    await api("post", `/api/queue/${appointment.queueId}/override-priority`, {
      token: staffTokens.nurse[caseConfig.nurseUser],
      data: {
        priority_level: caseConfig.overridePriority || 2,
        note: `Priority adjusted for ${caseConfig.code}`,
      },
    });
  }

  await api("post", `/api/queue/${appointment.queueId}/triage`, {
    token: staffTokens.nurse[caseConfig.nurseUser],
    data: {
      ...caseConfig.triage,
      triage_notes: `Triage captured for ${caseConfig.code}`,
    },
  });

  await api("post", `/api/queue/${appointment.queueId}/ready-for-doctor`, {
    token: staffTokens.nurse[caseConfig.nurseUser],
    data: {
      ...caseConfig.triage,
      triage_notes: `Ready for doctor - ${caseConfig.code}`,
    },
  });

  await api("post", `/api/appointments/${appointment.appointmentId}/doctor-update`, {
    token: staffTokens.doctor[caseConfig.doctorUser],
    data: {
      diagnosis: `${caseConfig.departmentName} provisional diagnosis`,
      prescription: "Hydration, rest, follow doctor advice",
      tests_ordered: "Basic panel",
      doctor_notes: `Consultation notes for ${caseConfig.code}`,
      complete_visit: true,
    },
  });

  const history = await api("get", "/api/appointments/me/history", { token: patient.authToken });
  const completed = (history?.appointments || []).find((item) => item.appointmentId === appointment.appointmentId);
  assert(completed, `Completed visit not found in patient history for ${caseConfig.code}.`);
  assert(completed.status === "completed", `Visit not marked completed for ${caseConfig.code}.`, completed);

  return {
    case: caseConfig.code,
    department: caseConfig.departmentName,
    appointmentId: appointment.appointmentId,
    queueId: appointment.queueId,
    token: appointment.token,
    patientId: patient.patientId,
    status: completed.status,
  };
}

async function main() {
  console.log("🚀 Running SwasthyaQueue FULL E2E department test");
  console.log(`   Base URL: ${BASE_URL}`);

  try {
    await clearOperationalData();
  } catch (error) {
    fail("Unable to reset database before full test.", { message: error.message });
  } finally {
    await pool.end();
  }

  const staffTokens = await loginStaffUsers();
  console.log("✅ Staff sessions created for reception + all department nurses/doctors.");

  const results = [];
  for (let index = 0; index < CASES.length; index += 1) {
    const item = CASES[index];
    console.log(`\n${index + 1}) ${item.code} - ${item.departmentName}`);
    const result = await runCase(item, staffTokens, index + 1);
    results.push(result);
    console.log(`✅ ${item.code} complete`, {
      appointmentId: result.appointmentId,
      queueId: result.queueId,
      token: result.token,
      status: result.status,
    });
  }

  console.log("\n🎉 Full department E2E test passed.");
  console.log("Summary:");
  console.table(results);
}

main().catch((error) => {
  fail("Unhandled full E2E test error", { message: error.message });
});
