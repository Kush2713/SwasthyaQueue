/* eslint-disable no-console */
const axios = require("axios");

const BASE_URL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5000";

function fail(message, meta) {
  if (meta) {
    console.error("❌", message, meta);
  } else {
    console.error("❌", message);
  }
  process.exit(1);
}

function assert(condition, message, meta) {
  if (!condition) {
    fail(message, meta);
  }
}

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    timeout: 10000,
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

async function main() {
  console.log("🚀 Running SwasthyaQueue E2E smoke test");
  console.log(`   Base URL: ${BASE_URL}`);

  const uid = Date.now();
  const mobile = `9${String(uid).slice(-9)}`;
  const email = `smoke${uid}@example.com`;

  console.log("\n1) Patient signup + OTP verify");
  const signup = await api("post", "/api/auth/patient/signup", {
    data: {
      name: `Smoke Patient ${String(uid).slice(-4)}`,
      age: 31,
      gender: "Male",
      mobile,
      email,
      address: "Smoke Test Address",
      emergencyContact: "9876543210",
      bloodGroup: "O+",
      allergies: "None",
      chronicConditions: "None",
    },
  });

  const otp = signup.devOtp;
  assert(otp, "devOtp missing. Set OTP_PREVIEW_ENABLED=true for local smoke tests.");

  const verify = await api("post", "/api/auth/patient/verify-otp", {
    data: {
      identifier: mobile,
      otp,
    },
  });
  const patientToken = verify?.user?.authToken;
  const patientId = verify?.user?.patientId;
  assert(patientToken, "Patient auth token not returned.");
  assert(patientId, "Patient ID not returned.");

  console.log("✅ Patient verified", { patientId, mobile });

  console.log("\n2) Patient creates appointment");
  const create = await api("post", "/api/appointments", {
    token: patientToken,
    data: {
      department_id: 1,
      symptoms: "Fever, headache, weakness",
      pain_scale: 3,
      preferred_slot: null,
    },
  });

  const appointment = create?.appointment;
  assert(appointment?.appointmentId, "Appointment not created.");
  assert(appointment?.queueId, "Queue entry not linked.");
  const queueId = appointment.queueId;
  console.log("✅ Appointment queued", {
    appointmentId: appointment.appointmentId,
    queueId,
    token: appointment.token,
  });

  console.log("\n3) Public queue/display endpoints");
  const stats = await api("get", "/api/queue/stats");
  assert(typeof stats.total_patients === "number", "Queue stats invalid.", stats);
  const deptQueue = await api("get", "/api/queue/1");
  assert(Array.isArray(deptQueue), "Department queue response invalid.");
  console.log("✅ Public queue endpoints reachable");

  console.log("\n4) Staff login");
  const receptionist = await api("post", "/api/auth/staff/login", {
    data: { userId: "receptionist01", password: "recept123" },
  });
  const nurse = await api("post", "/api/auth/staff/login", {
    data: { userId: "nurse01", password: "nurse123" },
  });
  const doctor = await api("post", "/api/auth/staff/login", {
    data: { userId: "doctor01", password: "doc123" },
  });
  const receptionistToken = receptionist?.user?.authToken;
  const nurseToken = nurse?.user?.authToken;
  const doctorToken = doctor?.user?.authToken;
  assert(receptionistToken && nurseToken && doctorToken, "One or more staff tokens missing.");
  console.log("✅ Staff sessions created");

  console.log("\n5) Reception calls next");
  let targetInProgress = false;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await api("post", "/api/queue/next", {
      token: receptionistToken,
      data: { department_id: 1 },
    });

    const deptQueueCheck = await api("get", "/api/queue/1");
    const target = (deptQueueCheck || []).find((row) => row.queue_id === queueId);
    if (target?.status === "in-progress") {
      targetInProgress = true;
      break;
    }
    await sleep(200);
  }
  assert(targetInProgress, "Could not bring smoke appointment to in-progress after repeated call-next.");
  console.log("✅ Reception call-next done");

  console.log("\n6) Nurse triage + ready-for-doctor");
  await api("post", `/api/queue/${queueId}/triage`, {
    token: nurseToken,
    data: {
      temperature_f: 99.4,
      blood_pressure: "120/80",
      pulse_rate: 84,
      spo2: 98,
      weight_kg: 64,
      triage_notes: "Mild fever, stable vitals",
    },
  });

  await api("post", `/api/queue/${queueId}/ready-for-doctor`, {
    token: nurseToken,
    data: {
      temperature_f: 99.4,
      blood_pressure: "120/80",
      pulse_rate: 84,
      spo2: 98,
      weight_kg: 64,
      triage_notes: "Ready for consultation",
    },
  });
  console.log("✅ Nurse handoff complete");

  console.log("\n7) Doctor saves consultation + completes visit");
  await api("post", `/api/appointments/${appointment.appointmentId}/doctor-update`, {
    token: doctorToken,
    data: {
      diagnosis: "Viral fever",
      prescription: "Paracetamol, hydration, rest",
      tests_ordered: "CBC",
      doctor_notes: "Review in 3 days if persistent",
      complete_visit: false,
    },
  });

  await api("post", `/api/appointments/${appointment.appointmentId}/doctor-update`, {
    token: doctorToken,
    data: {
      diagnosis: "Viral fever",
      prescription: "Paracetamol, hydration, rest",
      tests_ordered: "CBC",
      doctor_notes: "Consultation complete",
      complete_visit: true,
    },
  });
  console.log("✅ Doctor workflow complete");

  console.log("\n8) Patient history reflects completed visit");
  const history = await api("get", "/api/appointments/me/history", {
    token: patientToken,
  });
  const found = (history?.appointments || []).find((item) => item.appointmentId === appointment.appointmentId);
  assert(found, "Completed appointment missing from patient history.");
  assert(found.status === "completed", "Appointment is not completed in history.", found);
  console.log("✅ Patient history updated");

  console.log("\n🎉 E2E smoke test passed.");
  console.log("You can now open dashboards and validate UI with confidence.");
}

main().catch((error) => {
  fail("Unhandled smoke test error", { message: error.message });
});
