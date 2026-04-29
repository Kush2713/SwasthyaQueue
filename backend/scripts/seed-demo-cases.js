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
  const now = Date.now();
  return new Date(now - hours * 60 * 60 * 1000);
}

function daysAgo(days, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const patients = [
  { key: "gm1", name: "Neha Reddy", age: 32, gender: "Female", phone: "9000011111", email: "neha.reddy@example.com", bloodGroup: "A+", emergencyContact: "9000099991", address: "Vijayawada" },
  { key: "gm2", name: "Rahul Sharma", age: 45, gender: "Male", phone: "9000011112", email: "rahul.sharma@example.com", bloodGroup: "B+", emergencyContact: "9000099992", address: "Guntur" },
  { key: "cd1", name: "Anil Kumar", age: 54, gender: "Male", phone: "9000011113", email: "anil.kumar@example.com", bloodGroup: "O+", emergencyContact: "9000099993", address: "Vijayawada" },
  { key: "or1", name: "Ravi Naik", age: 39, gender: "Male", phone: null, email: null, bloodGroup: null, emergencyContact: null, address: "NTR District" },
  { key: "pd1", name: "Aarav Rao", age: 8, gender: "Male", phone: "9000011115", email: null, bloodGroup: "A+", emergencyContact: "9000099995", address: "Tenali" },
  { key: "em1", name: "Sana Begum", age: 27, gender: "Female", phone: "9000011116", email: "sana.begum@example.com", bloodGroup: "O-", emergencyContact: "9000099996", address: "Mangalagiri" },
];

const visits = [
  // General Medicine continuity (history + active queued)
  {
    patientKey: "gm1",
    department: "General Medicine",
    symptoms: "Fever, myalgia, fatigue",
    painScale: 3,
    status: "completed",
    queueStatus: "completed",
    priority: 3,
    tokenNumber: 1,
    createdAt: daysAgo(18, 11, 10),
    triage: { temperatureF: 100.2, bloodPressure: "118/78", pulseRate: 90, spo2: 98, weightKg: 57.8, notes: "Mild fever, hydrated" },
    doctor: { diagnosis: "Viral fever", prescription: "Paracetamol, fluids", tests: "CBC", notes: "Follow up if persistent" },
  },
  {
    patientKey: "gm1",
    department: "General Medicine",
    symptoms: "Fever since 2 days, headache",
    painScale: 4,
    status: "queued",
    queueStatus: "waiting",
    priority: 3,
    tokenNumber: 7,
    createdAt: hoursAgo(1.5),
  },

  // General Medicine second patient currently in-progress
  {
    patientKey: "gm2",
    department: "General Medicine",
    symptoms: "Dry cough, sore throat",
    painScale: 2,
    status: "in-progress",
    queueStatus: "in-progress",
    priority: 3,
    tokenNumber: 6,
    createdAt: hoursAgo(2.2),
    triage: { temperatureF: 99.4, bloodPressure: "120/82", pulseRate: 84, spo2: 98, weightKg: 72.4, notes: "Stable" },
  },

  // Cardiology urgent ready-for-doctor
  {
    patientKey: "cd1",
    department: "Cardiology",
    symptoms: "Chest discomfort with dizziness",
    painScale: 7,
    status: "ready-for-doctor",
    queueStatus: "in-progress",
    priority: 2,
    tokenNumber: 4,
    createdAt: hoursAgo(1.1),
    triage: { temperatureF: 98.7, bloodPressure: "150/95", pulseRate: 104, spo2: 96, weightKg: 78.0, notes: "Urgent cardiology review advised" },
  },

  // Orthopedics no-phone assisted profile completed history + new waiting
  {
    patientKey: "or1",
    department: "Orthopedics",
    symptoms: "Knee swelling and pain after work",
    painScale: 6,
    status: "completed",
    queueStatus: "completed",
    priority: 2,
    tokenNumber: 2,
    createdAt: daysAgo(7, 12, 0),
    triage: { temperatureF: 98.6, bloodPressure: "122/80", pulseRate: 88, spo2: 99, weightKg: 68.5, notes: "Mobility reduced" },
    doctor: { diagnosis: "Knee ligament strain", prescription: "Pain gel, rest, brace", tests: "X-ray knee", notes: "Review after 1 week" },
  },
  {
    patientKey: "or1",
    department: "Orthopedics",
    symptoms: "Back pain radiating to left leg",
    painScale: 5,
    status: "queued",
    queueStatus: "waiting",
    priority: 3,
    tokenNumber: 5,
    createdAt: hoursAgo(0.8),
  },

  // Pediatrics waiting
  {
    patientKey: "pd1",
    department: "Pediatrics",
    symptoms: "Child fever and cough",
    painScale: 3,
    status: "queued",
    queueStatus: "waiting",
    priority: 3,
    tokenNumber: 3,
    createdAt: hoursAgo(0.7),
  },

  // Emergency urgent in-progress
  {
    patientKey: "em1",
    department: "Emergency",
    symptoms: "Breathlessness and anxiety",
    painScale: 8,
    status: "in-progress",
    queueStatus: "in-progress",
    priority: 1,
    tokenNumber: 1,
    createdAt: hoursAgo(0.4),
    urgent: { reason: "Breathlessness at arrival", requestedByRole: "receptionist", requestedByName: "Anita Reddy", escalatedByRole: "nurse", escalatedByName: "Sujatha Rao", note: "Critical fast-track approved" },
    triage: { temperatureF: 99.1, bloodPressure: "140/92", pulseRate: 112, spo2: 91, weightKg: 59.4, notes: "Low SpO2, immediate doctor review" },
  },
];

const rushPatients = [
  { key: "rhgm1", name: "Rohan Mehta", age: 34, gender: "Male", phone: "9011010001", email: "rohan.mehta@example.com", bloodGroup: "B+", emergencyContact: "9099010001", address: "Vijayawada" },
  { key: "rhgm2", name: "Pooja Singh", age: 29, gender: "Female", phone: "9011010002", email: "pooja.singh@example.com", bloodGroup: "O+", emergencyContact: "9099010002", address: "Guntur" },
  { key: "rhgm3", name: "Sameer Khan", age: 41, gender: "Male", phone: "9011010003", email: "sameer.khan@example.com", bloodGroup: "A+", emergencyContact: "9099010003", address: "Tenali" },
  { key: "rhcd1", name: "Ajay Verma", age: 58, gender: "Male", phone: "9011020001", email: "ajay.verma@example.com", bloodGroup: "AB+", emergencyContact: "9099020001", address: "Mangalagiri" },
  { key: "rhcd2", name: "Meera Joshi", age: 46, gender: "Female", phone: "9011020002", email: "meera.joshi@example.com", bloodGroup: "A-", emergencyContact: "9099020002", address: "Vijayawada" },
  { key: "rhor1", name: "Vikram Rao", age: 38, gender: "Male", phone: "9011030001", email: "vikram.rao@example.com", bloodGroup: "B-", emergencyContact: "9099030001", address: "Guntur" },
  { key: "rhor2", name: "Kavita Das", age: 27, gender: "Female", phone: null, email: null, bloodGroup: null, emergencyContact: null, address: "NTR District" },
  { key: "rhpd1", name: "Ishaan Nair", age: 6, gender: "Male", phone: "9011040001", email: null, bloodGroup: "O+", emergencyContact: "9099040001", address: "Tenali" },
  { key: "rhem1", name: "Suresh Reddy", age: 67, gender: "Male", phone: "9011050001", email: "suresh.reddy@example.com", bloodGroup: "A+", emergencyContact: "9099050001", address: "Vijayawada" },
  { key: "rhem2", name: "Anita Paul", age: 33, gender: "Female", phone: "9011050002", email: "anita.paul@example.com", bloodGroup: "O-", emergencyContact: "9099050002", address: "Mangalagiri" },
];

const rushVisits = [
  { patientKey: "rhgm1", department: "General Medicine", symptoms: "Fever with body ache", painScale: 3, status: "queued", queueStatus: "waiting", priority: 3, tokenNumber: 8, createdAt: hoursAgo(0.45) },
  { patientKey: "rhgm2", department: "General Medicine", symptoms: "Dry cough and throat irritation", painScale: 2, status: "queued", queueStatus: "waiting", priority: 3, tokenNumber: 9, createdAt: hoursAgo(0.42) },
  { patientKey: "rhgm3", department: "General Medicine", symptoms: "Weakness and mild fever", painScale: 3, status: "queued", queueStatus: "waiting", priority: 3, tokenNumber: 10, createdAt: hoursAgo(0.40) },
  { patientKey: "rhcd1", department: "Cardiology", symptoms: "Chest discomfort with sweating", painScale: 8, status: "queued", queueStatus: "waiting", priority: 2, tokenNumber: 5, createdAt: hoursAgo(0.38), urgent: { reason: "Chest symptoms during rush hour", requestedByRole: "receptionist", requestedByName: "Anita Reddy", escalatedByRole: "nurse", escalatedByName: "Sujatha Rao", note: "High priority escalation" } },
  { patientKey: "rhcd2", department: "Cardiology", symptoms: "Intermittent palpitations", painScale: 4, status: "queued", queueStatus: "waiting", priority: 3, tokenNumber: 6, createdAt: hoursAgo(0.36) },
  { patientKey: "rhor1", department: "Orthopedics", symptoms: "Knee injury after fall", painScale: 6, status: "queued", queueStatus: "waiting", priority: 3, tokenNumber: 6, createdAt: hoursAgo(0.34) },
  { patientKey: "rhor2", department: "Orthopedics", symptoms: "Ankle twist and swelling", painScale: 5, status: "queued", queueStatus: "waiting", priority: 3, tokenNumber: 7, createdAt: hoursAgo(0.32) },
  { patientKey: "rhpd1", department: "Pediatrics", symptoms: "Child vomiting with fever", painScale: 6, status: "queued", queueStatus: "waiting", priority: 2, tokenNumber: 4, createdAt: hoursAgo(0.30), urgent: { reason: "Pediatric dehydration risk", requestedByRole: "receptionist", requestedByName: "Anita Reddy", escalatedByRole: "nurse", escalatedByName: "Sujatha Rao", note: "Urgent pediatric review" } },
  { patientKey: "rhem1", department: "Emergency", symptoms: "Severe breathlessness", painScale: 9, status: "in-progress", queueStatus: "in-progress", priority: 1, tokenNumber: 2, createdAt: hoursAgo(0.28), urgent: { reason: "Severe respiratory distress", requestedByRole: "receptionist", requestedByName: "Anita Reddy", escalatedByRole: "nurse", escalatedByName: "Sujatha Rao", note: "Critical fast-track" }, triage: { temperatureF: 99.0, bloodPressure: "150/96", pulseRate: 118, spo2: 89, weightKg: 66.0, notes: "Critical oxygen drop in rush hour" } },
  { patientKey: "rhem2", department: "Emergency", symptoms: "Acute dizziness and sweating", painScale: 8, status: "queued", queueStatus: "waiting", priority: 2, tokenNumber: 3, createdAt: hoursAgo(0.26), urgent: { reason: "Possible acute episode", requestedByRole: "receptionist", requestedByName: "Anita Reddy", escalatedByRole: "nurse", escalatedByName: "Sujatha Rao", note: "High priority emergency queue" } },
];

async function ensureDepartments(client) {
  const entries = [
    ["General Medicine", 15],
    ["Cardiology", 20],
    ["Orthopedics", 18],
    ["Pediatrics", 12],
    ["Emergency", 10],
  ];
  for (const [name, avg] of entries) {
    await client.query(
      "INSERT INTO departments (department_id, name, avg_consult_time) VALUES ($1, $2, $3) ON CONFLICT (department_id) DO UPDATE SET name = EXCLUDED.name, avg_consult_time = EXCLUDED.avg_consult_time",
      [DEPARTMENTS[name], name, avg]
    );
  }
}

async function maybeReset(client, shouldReset) {
  if (!shouldReset) return;
  await client.query("TRUNCATE TABLE workflow_events, queue, appointments, patient_accounts, patients RESTART IDENTITY CASCADE");
}

async function createPatient(client, data) {
  const result = await client.query(
    `INSERT INTO patients (name, age, gender, phone, email, address, emergency_contact, blood_group, allergies, chronic_conditions, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING patient_id`,
    [
      data.name,
      data.age,
      data.gender,
      data.phone,
      data.email,
      data.address,
      data.emergencyContact,
      data.bloodGroup,
      data.allergies || null,
      data.chronicConditions || null,
      daysAgo(30, 9, 0),
    ]
  );

  const patientId = result.rows[0].patient_id;
  await client.query(
    `INSERT INTO patient_accounts (patient_id, email, mobile, account_source, created_by_role, created_by_name, assisted_reference, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      patientId,
      data.email,
      data.phone,
      data.phone ? "self" : "staff-assisted",
      data.phone ? null : "receptionist",
      data.phone ? null : "Anita Reddy",
      data.phone ? null : `ASST-DEMO-${patientId}`,
      daysAgo(30, 9, 2),
      daysAgo(30, 9, 2),
    ]
  );

  return patientId;
}

async function createVisit(client, patientIdByKey, visit) {
  const patientId = patientIdByKey[visit.patientKey];
  const departmentId = DEPARTMENTS[visit.department];

  const triage = visit.triage || {};
  const doctor = visit.doctor || {};
  const assessedAt = visit.triage ? new Date(new Date(visit.createdAt).getTime() + 25 * 60 * 1000) : null;
  const consultedAt = visit.doctor ? new Date(new Date(visit.createdAt).getTime() + 60 * 60 * 1000) : null;

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
      null,
      triage.temperatureF || null,
      triage.bloodPressure || null,
      triage.pulseRate || null,
      triage.spo2 || null,
      triage.weightKg || null,
      triage.notes || null,
      triage.notes ? "Sujatha Rao" : null,
      assessedAt,
      doctor.diagnosis || null,
      doctor.prescription || null,
      doctor.tests || null,
      doctor.notes || null,
      doctor.notes ? "Dr. S. Mehta" : null,
      consultedAt,
      visit.status,
      visit.createdAt,
      visit.createdAt,
    ]
  );

  const appointmentId = appointmentResult.rows[0].appointment_id;
  const urgent = visit.urgent || null;
  const queueCreatedAt = new Date(new Date(visit.createdAt).getTime() + 5 * 60 * 1000);

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
      visit.tokenNumber,
      visit.queueStatus,
      Boolean(urgent),
      urgent?.reason || null,
      urgent?.requestedByRole || null,
      urgent?.requestedByName || null,
      urgent ? queueCreatedAt : null,
      urgent ? new Date(queueCreatedAt.getTime() + 15 * 60 * 1000) : null,
      urgent?.escalatedByRole || null,
      urgent?.escalatedByName || null,
      urgent?.note || null,
      queueCreatedAt,
    ]
  );

  const queueId = queueResult.rows[0].queue_id;

  await client.query(
    "UPDATE appointments SET queue_id = $2 WHERE appointment_id = $1",
    [appointmentId, queueId]
  );

  await client.query(
    `INSERT INTO workflow_events (actor_role, actor_name, action, entity_type, entity_id, patient_id, appointment_id, queue_id, details, created_at)
     VALUES
     ('patient', 'Demo Patient', 'appointment_created', 'appointment', $1, $2, $3, $4, $5::jsonb, $6),
     ('receptionist', 'Anita Reddy', 'queue_entry_created', 'queue', $7, $2, $3, $4, $8::jsonb, $9)`,
    [
      String(appointmentId),
      patientId,
      appointmentId,
      queueId,
      JSON.stringify({ department: visit.department, symptoms: visit.symptoms, status: visit.status }),
      visit.createdAt,
      String(queueId),
      JSON.stringify({ priority: visit.priority, queueStatus: visit.queueStatus }),
      queueCreatedAt,
    ]
  );

  if (visit.triage) {
    await client.query(
      `INSERT INTO workflow_events (actor_role, actor_name, action, entity_type, entity_id, patient_id, appointment_id, queue_id, details, created_at)
       VALUES ('nurse', 'Sujatha Rao', 'triage_saved', 'appointment', $1, $2, $3, $4, $5::jsonb, $6)`,
      [
        String(appointmentId),
        patientId,
        appointmentId,
        queueId,
        JSON.stringify({ notes: triage.notes || "", pulse: triage.pulseRate || null, spo2: triage.spo2 || null }),
        assessedAt || queueCreatedAt,
      ]
    );
  }

  if (visit.status === "ready-for-doctor") {
    await client.query(
      `INSERT INTO workflow_events (actor_role, actor_name, action, entity_type, entity_id, patient_id, appointment_id, queue_id, details, created_at)
       VALUES ('nurse', 'Sujatha Rao', 'marked_ready_for_doctor', 'appointment', $1, $2, $3, $4, '{}'::jsonb, $5)`,
      [String(appointmentId), patientId, appointmentId, queueId, assessedAt || queueCreatedAt]
    );
  }

  if (visit.doctor) {
    await client.query(
      `INSERT INTO workflow_events (actor_role, actor_name, action, entity_type, entity_id, patient_id, appointment_id, queue_id, details, created_at)
       VALUES ('doctor', 'Dr. S. Mehta', 'appointment_completed', 'appointment', $1, $2, $3, $4, $5::jsonb, $6)`,
      [
        String(appointmentId),
        patientId,
        appointmentId,
        queueId,
        JSON.stringify({ diagnosis: doctor.diagnosis || "", tests: doctor.tests || null }),
        consultedAt || queueCreatedAt,
      ]
    );
  }
}

async function run() {
  const reset = process.argv.includes("--reset");
  const withRush = process.argv.includes("--rush");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureDepartments(client);
    await maybeReset(client, reset);

    const patientIdByKey = {};
    const allPatients = withRush ? [...patients, ...rushPatients] : [...patients];
    for (const patient of allPatients) {
      patientIdByKey[patient.key] = await createPatient(client, patient);
    }

    const allVisits = withRush ? [...visits, ...rushVisits] : [...visits];
    for (const visit of allVisits) {
      await createVisit(client, patientIdByKey, visit);
    }

    await client.query("COMMIT");
    console.log(`✅ Demo cases seeded successfully (${withRush ? "baseline + rush" : "baseline only"}).`);
    console.log(`Patients: ${allPatients.length}`);
    console.log(`Visits: ${allVisits.length}`);
    if (withRush) {
      console.log("Rush add-on summary:");
      console.log("- General Medicine +3 waiting");
      console.log("- Cardiology +2 (1 high urgent)");
      console.log("- Orthopedics +2 (includes 1 no-phone)");
      console.log("- Pediatrics +1 urgent");
      console.log("- Emergency +2 (1 critical in-progress)");
    }
    console.log("Tip: run with --reset to clear old data before seeding.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Demo case seeding failed:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
