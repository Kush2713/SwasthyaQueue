/* eslint-disable no-console */
const pool = require("../db");

const DEPARTMENTS = {
  "General Medicine": 1,
  Cardiology: 2,
  Orthopedics: 3,
  Pediatrics: 4,
  Emergency: 5,
};

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function ensureDepartments(client) {
  const rows = [
    ["General Medicine", 15],
    ["Cardiology", 20],
    ["Orthopedics", 18],
    ["Pediatrics", 12],
    ["Emergency", 10],
  ];
  for (const [name, avg] of rows) {
    await client.query(
      "INSERT INTO departments (department_id, name, avg_consult_time) VALUES ($1,$2,$3) ON CONFLICT (department_id) DO UPDATE SET name=EXCLUDED.name, avg_consult_time=EXCLUDED.avg_consult_time",
      [DEPARTMENTS[name], name, avg]
    );
  }
}

async function maybeReset(client, shouldReset) {
  if (!shouldReset) return;
  await client.query("TRUNCATE TABLE workflow_events, queue, appointments, patient_accounts, patients RESTART IDENTITY CASCADE");
}

const patients = [
  { key: "gm_t1", name: "Test1 Arjun Rao", age: 29, gender: "Male", mobile: "9876501001", email: "test1.gm@tempmail.com", address: "Vijayawada" },
  { key: "gm_t2", name: "Test2 Neha Iyer", age: 34, gender: "Female", mobile: "9876501002", email: "test2.gm@tempmail.com", address: "Guntur" },
  { key: "gm_t3", name: "Test3 Ravi Kumar", age: 41, gender: "Male", mobile: null, email: "test3.gm@tempmail.com", address: "NTR District", assisted: true },
  { key: "gm_t4", name: "Test4 Priya Menon", age: 38, gender: "Female", mobile: "9876501004", email: "test4.gm@tempmail.com", address: "Tenali" },

  { key: "cd_t1", name: "Test1 Ajay Verma", age: 56, gender: "Male", mobile: "9876502001", email: "test1.cd@tempmail.com", address: "Vijayawada" },
  { key: "cd_t2", name: "Test2 Meera Nair", age: 49, gender: "Female", mobile: "9876502002", email: "test2.cd@tempmail.com", address: "Mangalagiri" },
  { key: "cd_t3", name: "Test3 Farhan Ali", age: 61, gender: "Male", mobile: null, email: "test3.cd@tempmail.com", address: "NTR District", assisted: true },
  { key: "cd_t4", name: "Test4 Sahana Reddy", age: 45, gender: "Female", mobile: "9876502004", email: "test4.cd@tempmail.com", address: "Guntur" },

  { key: "or_t1", name: "Test1 Nitin Das", age: 33, gender: "Male", mobile: "9876503001", email: "test1.or@tempmail.com", address: "Vijayawada" },
  { key: "or_t2", name: "Test2 Kavya Shah", age: 27, gender: "Female", mobile: "9876503002", email: "test2.or@tempmail.com", address: "Tenali" },
  { key: "or_t3", name: "Test3 Gauri Patil", age: 31, gender: "Female", mobile: null, email: "test3.or@tempmail.com", address: "NTR District", assisted: true },
  { key: "or_t4", name: "Test4 Harish Pillai", age: 44, gender: "Male", mobile: "9876503004", email: "test4.or@tempmail.com", address: "Guntur" },

  { key: "pd_t1", name: "Test1 Aarav Singh", age: 9, gender: "Male", mobile: "9876504001", email: "test1.pd@tempmail.com", address: "Vijayawada" },
  { key: "pd_t2", name: "Test2 Isha Kapoor", age: 7, gender: "Female", mobile: "9876504002", email: "test2.pd@tempmail.com", address: "Tenali" },
  { key: "pd_t3", name: "Test3 Omkar Das", age: 11, gender: "Male", mobile: null, email: "test3.pd@tempmail.com", address: "NTR District", assisted: true },
  { key: "pd_t4", name: "Test4 Naina Thomas", age: 8, gender: "Female", mobile: "9876504004", email: "test4.pd@tempmail.com", address: "Guntur" },

  { key: "em_t1", name: "Test1 Sana Begum", age: 28, gender: "Female", mobile: "9876505001", email: "test1.em@tempmail.com", address: "Vijayawada" },
  { key: "em_t2", name: "Test2 Suresh Reddy", age: 63, gender: "Male", mobile: "9876505002", email: "test2.em@tempmail.com", address: "Mangalagiri" },
  { key: "em_t3", name: "Test3 Anita Paul", age: 36, gender: "Female", mobile: null, email: "test3.em@tempmail.com", address: "NTR District", assisted: true },
  { key: "em_t4", name: "Test4 Dev Malhotra", age: 40, gender: "Male", mobile: "9876505004", email: "test4.em@tempmail.com", address: "Guntur" },
];

const visits = [
  // General Medicine
  { patientKey: "gm_t1", department: "General Medicine", symptoms: "Fever and fatigue", status: "queued", queueStatus: "waiting", priority: 3, token: 1, painScale: 3, createdAt: hoursAgo(1.8), mode: "normal" },
  { patientKey: "gm_t2", department: "General Medicine", symptoms: "Rush-case high fever and weakness", status: "in-progress", queueStatus: "in-progress", priority: 1, token: 2, painScale: 7, createdAt: hoursAgo(1.4), mode: "quick-intake", urgentReason: "Quick intake emergency lane", triage: { temp: 101.4, bp: "128/84", pulse: 102, spo2: 96, weight: 61.2, notes: "Quick intake triage started" } },
  { patientKey: "gm_t3", department: "General Medicine", symptoms: "Walk-in follow-up weakness", status: "queued", queueStatus: "waiting", priority: 3, token: 3, painScale: 2, createdAt: hoursAgo(1.2), mode: "staff-assisted" },
  { patientKey: "gm_t4", department: "General Medicine", symptoms: "Headache and fever follow-up", status: "completed", queueStatus: "completed", priority: 3, token: 4, painScale: 3, createdAt: hoursAgo(10), mode: "normal", triage: { temp: 99.8, bp: "118/78", pulse: 88, spo2: 98, weight: 58.3, notes: "Stable vitals" }, doctor: { diagnosis: "Viral febrile syndrome", prescription: "Paracetamol + hydration", tests: "CBC", notes: "Review if symptoms persist", doctorName: "Dr. S. Mehta" } },

  // Cardiology
  { patientKey: "cd_t1", department: "Cardiology", symptoms: "Mild chest discomfort on exertion", status: "queued", queueStatus: "waiting", priority: 3, token: 1, painScale: 4, createdAt: hoursAgo(1.9), mode: "normal" },
  { patientKey: "cd_t2", department: "Cardiology", symptoms: "Acute chest tightness from front desk", status: "ready-for-doctor", queueStatus: "in-progress", priority: 1, token: 2, painScale: 8, createdAt: hoursAgo(1.5), mode: "quick-intake", urgentReason: "Quick intake chest symptoms", triage: { temp: 98.9, bp: "152/96", pulse: 108, spo2: 95, weight: 70.4, notes: "Critical cardiology review needed" } },
  { patientKey: "cd_t3", department: "Cardiology", symptoms: "Staff-assisted palpitations case", status: "queued", queueStatus: "waiting", priority: 3, token: 3, painScale: 3, createdAt: hoursAgo(1.1), mode: "staff-assisted" },
  { patientKey: "cd_t4", department: "Cardiology", symptoms: "Hypertension review visit", status: "completed", queueStatus: "completed", priority: 3, token: 4, painScale: 2, createdAt: hoursAgo(8), mode: "normal", triage: { temp: 98.6, bp: "146/90", pulse: 92, spo2: 97, weight: 66.1, notes: "BP elevated" }, doctor: { diagnosis: "Stage 1 hypertension", prescription: "Amlodipine 5mg", tests: "ECG", notes: "Monitor BP daily", doctorName: "Dr. Priya Menon" } },

  // Orthopedics
  { patientKey: "or_t1", department: "Orthopedics", symptoms: "Knee pain while climbing stairs", status: "queued", queueStatus: "waiting", priority: 3, token: 1, painScale: 4, createdAt: hoursAgo(1.7), mode: "normal" },
  { patientKey: "or_t2", department: "Orthopedics", symptoms: "Severe ankle injury quick intake", status: "in-progress", queueStatus: "in-progress", priority: 1, token: 2, painScale: 8, createdAt: hoursAgo(1.3), mode: "quick-intake", urgentReason: "Quick intake injury escalation", triage: { temp: 98.7, bp: "124/82", pulse: 96, spo2: 99, weight: 63.9, notes: "Swelling and movement restriction" } },
  { patientKey: "or_t3", department: "Orthopedics", symptoms: "No-phone walk-in back pain", status: "queued", queueStatus: "waiting", priority: 3, token: 3, painScale: 5, createdAt: hoursAgo(1.0), mode: "staff-assisted" },
  { patientKey: "or_t4", department: "Orthopedics", symptoms: "Shoulder strain follow-up", status: "completed", queueStatus: "completed", priority: 3, token: 4, painScale: 3, createdAt: hoursAgo(7), mode: "normal", triage: { temp: 98.5, bp: "120/80", pulse: 82, spo2: 99, weight: 74.8, notes: "Pain reduced from previous visit" }, doctor: { diagnosis: "Rotator cuff strain", prescription: "Topical NSAID + exercise", tests: "X-ray shoulder", notes: "Review in 1 week", doctorName: "Dr. Vikram Singh" } },

  // Pediatrics
  { patientKey: "pd_t1", department: "Pediatrics", symptoms: "Low-grade child fever", status: "queued", queueStatus: "waiting", priority: 3, token: 1, painScale: 2, createdAt: hoursAgo(1.6), mode: "normal" },
  { patientKey: "pd_t2", department: "Pediatrics", symptoms: "Child dehydration risk quick intake", status: "ready-for-doctor", queueStatus: "in-progress", priority: 1, token: 2, painScale: 7, createdAt: hoursAgo(1.2), mode: "quick-intake", urgentReason: "Quick intake pediatric dehydration", triage: { temp: 100.8, bp: "102/68", pulse: 112, spo2: 97, weight: 23.5, notes: "Weakness and poor oral intake" } },
  { patientKey: "pd_t3", department: "Pediatrics", symptoms: "No-phone child cough walk-in", status: "queued", queueStatus: "waiting", priority: 3, token: 3, painScale: 2, createdAt: hoursAgo(0.9), mode: "staff-assisted" },
  { patientKey: "pd_t4", department: "Pediatrics", symptoms: "Pediatric follow-up fever resolved", status: "completed", queueStatus: "completed", priority: 3, token: 4, painScale: 1, createdAt: hoursAgo(6), mode: "normal", triage: { temp: 98.9, bp: "100/64", pulse: 94, spo2: 99, weight: 24.1, notes: "Improved hydration" }, doctor: { diagnosis: "Resolved viral fever", prescription: "Continue hydration", tests: "None", notes: "No red flags now", doctorName: "Dr. Ananya Rao" } },

  // Emergency
  { patientKey: "em_t1", department: "Emergency", symptoms: "Acute abdominal pain", status: "queued", queueStatus: "waiting", priority: 2, token: 1, painScale: 6, createdAt: hoursAgo(1.5), mode: "normal" },
  { patientKey: "em_t2", department: "Emergency", symptoms: "Breathlessness quick intake", status: "in-progress", queueStatus: "in-progress", priority: 1, token: 2, painScale: 9, createdAt: hoursAgo(1.1), mode: "quick-intake", urgentReason: "Quick intake severe breathlessness", triage: { temp: 99.1, bp: "148/94", pulse: 118, spo2: 90, weight: 68.6, notes: "Critical oxygen drop" } },
  { patientKey: "em_t3", department: "Emergency", symptoms: "No-phone dizziness walk-in", status: "queued", queueStatus: "waiting", priority: 2, token: 3, painScale: 5, createdAt: hoursAgo(0.8), mode: "staff-assisted" },
  { patientKey: "em_t4", department: "Emergency", symptoms: "Post-stabilization review", status: "completed", queueStatus: "completed", priority: 2, token: 4, painScale: 3, createdAt: hoursAgo(5), mode: "normal", triage: { temp: 98.8, bp: "132/84", pulse: 90, spo2: 97, weight: 72.2, notes: "Stable after observation" }, doctor: { diagnosis: "Acute gastritis episode", prescription: "PPI + diet advice", tests: "Blood sugar", notes: "Return if pain worsens", doctorName: "Dr. Farhan Ali" } },
];

function getTomorrowAt(hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const futureVisits = [
  { patientKey: "gm_t1", department: "General Medicine", symptoms: "Advance follow-up booking", status: "queued", queueStatus: "waiting", priority: 3, token: 11, painScale: 2, createdAt: hoursAgo(0.3), preferredSlot: getTomorrowAt(10, 0), mode: "advance-booking" },
  { patientKey: "cd_t1", department: "Cardiology", symptoms: "Advance cardiology review", status: "queued", queueStatus: "waiting", priority: 3, token: 11, painScale: 3, createdAt: hoursAgo(0.3), preferredSlot: getTomorrowAt(11, 0), mode: "advance-booking" },
  { patientKey: "or_t1", department: "Orthopedics", symptoms: "Advance ortho follow-up", status: "queued", queueStatus: "waiting", priority: 3, token: 11, painScale: 3, createdAt: hoursAgo(0.3), preferredSlot: getTomorrowAt(12, 0), mode: "advance-booking" },
  { patientKey: "pd_t1", department: "Pediatrics", symptoms: "Advance pediatric follow-up", status: "queued", queueStatus: "waiting", priority: 3, token: 11, painScale: 2, createdAt: hoursAgo(0.3), preferredSlot: getTomorrowAt(13, 0), mode: "advance-booking" },
  { patientKey: "em_t1", department: "Emergency", symptoms: "Advance emergency recheck", status: "queued", queueStatus: "waiting", priority: 2, token: 11, painScale: 4, createdAt: hoursAgo(0.3), preferredSlot: getTomorrowAt(14, 0), mode: "advance-booking" },
];

async function createPatient(client, p) {
  const result = await client.query(
    `INSERT INTO patients (name, age, gender, phone, email, address, emergency_contact, blood_group, allergies, chronic_conditions, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING patient_id`,
    [p.name, p.age, p.gender, p.mobile, p.email, p.address, p.mobile, "O+", null, null, hoursAgo(24)]
  );
  const patientId = result.rows[0].patient_id;
  await client.query(
    `INSERT INTO patient_accounts (patient_id, email, mobile, account_source, created_by_role, created_by_name, assisted_reference, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      patientId,
      p.email,
      p.mobile,
      p.assisted ? "staff-assisted" : "self",
      p.assisted ? "receptionist" : null,
      p.assisted ? "Anita Reddy" : null,
      p.assisted ? `ASST-SHOW-${patientId}` : null,
      hoursAgo(24),
      hoursAgo(24),
    ]
  );
  return patientId;
}

async function createVisit(client, patientIdByKey, visit) {
  const patientId = patientIdByKey[visit.patientKey];
  const departmentId = DEPARTMENTS[visit.department];
  const assessedAt = visit.triage ? new Date(visit.createdAt.getTime() + 20 * 60 * 1000) : null;
  const consultedAt = visit.doctor ? new Date(visit.createdAt.getTime() + 60 * 60 * 1000) : null;

  const appointmentResult = await client.query(
    `INSERT INTO appointments (
      patient_id, department_id, symptoms, pain_scale, preferred_slot,
      temperature_c, blood_pressure, pulse_rate, spo2, weight_kg, triage_notes, assessed_by_name, assessed_at,
      diagnosis, prescription, tests_ordered, doctor_notes, consulted_by_name, consulted_at,
      status, created_at, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    RETURNING appointment_id`,
    [
      patientId,
      departmentId,
      visit.symptoms,
      visit.painScale,
      visit.preferredSlot || null,
      visit.triage?.temp || null,
      visit.triage?.bp || null,
      visit.triage?.pulse || null,
      visit.triage?.spo2 || null,
      visit.triage?.weight || null,
      visit.triage?.notes || null,
      visit.triage ? "Sujatha Rao" : null,
      assessedAt,
      visit.doctor?.diagnosis || null,
      visit.doctor?.prescription || null,
      visit.doctor?.tests || null,
      visit.doctor?.notes || null,
      visit.doctor?.doctorName || null,
      consultedAt,
      visit.status,
      visit.createdAt,
      visit.createdAt,
    ]
  );

  const appointmentId = appointmentResult.rows[0].appointment_id;
  const isUrgent = visit.mode === "quick-intake";
  const queueResult = await client.query(
    `INSERT INTO queue (
      appointment_id, patient_id, department_id, priority_level, token_number, status,
      urgent_review_requested, urgent_review_reason, urgent_review_requested_by_role, urgent_review_requested_by_name, urgent_review_requested_at,
      escalated_at, escalated_by_role, escalated_by_name, escalation_note, created_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING queue_id`,
    [
      appointmentId,
      patientId,
      departmentId,
      visit.priority,
      visit.token,
      visit.queueStatus,
      isUrgent,
      isUrgent ? visit.urgentReason : null,
      isUrgent ? "receptionist" : null,
      isUrgent ? "Anita Reddy" : null,
      isUrgent ? new Date(visit.createdAt.getTime() + 3 * 60 * 1000) : null,
      isUrgent ? new Date(visit.createdAt.getTime() + 12 * 60 * 1000) : null,
      isUrgent ? "nurse" : null,
      isUrgent ? "Sujatha Rao" : null,
      isUrgent ? "Quick intake priority path" : null,
      new Date(visit.createdAt.getTime() + 3 * 60 * 1000),
    ]
  );

  const queueId = queueResult.rows[0].queue_id;
  await client.query("UPDATE appointments SET queue_id = $2 WHERE appointment_id = $1", [appointmentId, queueId]);

  const details = { mode: visit.mode, department: visit.department, symptoms: visit.symptoms };
  await client.query(
    `INSERT INTO workflow_events (actor_role, actor_name, action, entity_type, entity_id, patient_id, appointment_id, queue_id, details, created_at)
     VALUES ('receptionist', 'Anita Reddy', 'queue_entry_created', 'queue', $1, $2, $3, $4, $5::jsonb, $6)`,
    [String(queueId), patientId, appointmentId, queueId, JSON.stringify(details), visit.createdAt]
  );
}

async function run() {
  const reset = process.argv.includes("--reset");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureDepartments(client);
    await maybeReset(client, reset);

    const patientIdByKey = {};
    for (const p of patients) patientIdByKey[p.key] = await createPatient(client, p);
    for (const visit of [...visits, ...futureVisits]) await createVisit(client, patientIdByKey, visit);

    await client.query("COMMIT");
    console.log("✅ Showcase cases seeded successfully.");
    console.log("Patients: 20");
    console.log("Visits: 25");
    console.log("Per department: normal + quick-intake + staff-assisted + completed + future-date advance booking");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Showcase seed failed:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
