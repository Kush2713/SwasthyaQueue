import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TIMING } from "../../lib/timing";

const COLORS = {
  navyDark: "#002060",
  navy: "#003580",
  saffron: "#FF9933",
  green: "#138808",
  pageBg: "#EEF2F7",
  skyText: "#A8C8FF",
};

function clockText() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function priorityRank(priority) {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  return 2;
}

function statusLabel(status) {
  if (status === "in-progress") return "in-consultation";
  return status;
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildClinicalFlags({ temperatureF, pulseRate, spo2, painScale }) {
  const flags = [];
  if (spo2 !== null && spo2 < 94) flags.push({ label: "Low SpO2", tone: "critical" });
  if (pulseRate !== null && pulseRate > 110) flags.push({ label: "High Pulse", tone: "high" });
  if (temperatureF !== null && temperatureF >= 100.4) flags.push({ label: "Fever", tone: "high" });
  if (Number(painScale) >= 7) flags.push({ label: "High Pain", tone: "high" });
  return flags;
}

const TRIAGE_PROFILES = {
  "General Medicine": { required: ["temperature_f", "blood_pressure", "pulse_rate", "spo2"] },
  Cardiology: { required: ["blood_pressure", "pulse_rate", "spo2"] },
  Orthopedics: { required: ["blood_pressure", "pulse_rate"] },
  Pediatrics: { required: ["temperature_f", "pulse_rate", "spo2", "weight_kg"] },
  Emergency: { required: ["temperature_f", "blood_pressure", "pulse_rate", "spo2", "triage_notes"] },
};

const TRIAGE_LABELS = {
  temperature_f: "Temperature (F)",
  blood_pressure: "Blood Pressure",
  pulse_rate: "Pulse",
  spo2: "SpO2",
  weight_kg: "Weight",
  triage_notes: "Triage Notes",
};

function getTriageProfile(departmentName) {
  return TRIAGE_PROFILES[departmentName] || TRIAGE_PROFILES["General Medicine"];
}

function validateTriageDraft(draft, profile = TRIAGE_PROFILES["General Medicine"], departmentName = "General Medicine") {
  const toNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const temperatureF = toNumber(draft.temperature_c);
  const pulseRate = toNumber(draft.pulse_rate);
  const spo2 = toNumber(draft.spo2);
  const weightKg = toNumber(draft.weight_kg);
  const bloodPressure = String(draft.blood_pressure || "").trim();
  const triageNotes = String(draft.triage_notes || "").trim();

  if ([temperatureF, pulseRate, spo2, weightKg].some(Number.isNaN)) {
    return "Vitals must be numeric values.";
  }

  const missing = [];
  for (const field of profile.required || []) {
    if (field === "temperature_f" && temperatureF === null) missing.push(field);
    if (field === "blood_pressure" && !bloodPressure) missing.push(field);
    if (field === "pulse_rate" && pulseRate === null) missing.push(field);
    if (field === "spo2" && spo2 === null) missing.push(field);
    if (field === "weight_kg" && weightKg === null) missing.push(field);
    if (field === "triage_notes" && !triageNotes) missing.push(field);
  }

  if (missing.length) {
    return `${departmentName} requires: ${missing.map((field) => TRIAGE_LABELS[field] || field).join(", ")}.`;
  }

  if (temperatureF !== null && (temperatureF < 86 || temperatureF > 113)) {
    return "Temperature should be between 86 and 113 F.";
  }

  if (pulseRate !== null && (pulseRate < 20 || pulseRate > 240)) {
    return "Pulse should be between 20 and 240.";
  }

  if (spo2 !== null && (spo2 < 40 || spo2 > 100)) {
    return "SpO2 should be between 40 and 100.";
  }

  if (weightKg !== null && (weightKg < 1 || weightKg > 400)) {
    return "Weight should be between 1 and 400 kg.";
  }

  if (bloodPressure && !/^\d{2,3}\/\d{2,3}$/.test(bloodPressure)) {
    return "Blood pressure should be in 120/80 format.";
  }

  return "";
}

function getAllowedDepartmentIds(user) {
  const source = user?.assignedDepartmentIds ?? user?.assigned_department_ids ?? [];
  const ids = Array.isArray(source)
    ? source.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [];
  return Array.from(new Set(ids));
}

export default function StaffDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const isNurse = user?.role === "nurse";
  const isDoctor = user?.role === "doctor";
  const [patients, setPatients] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeTab, setActiveTab] = useState(isNurse ? "triage" : isDoctor ? "consult" : "overview");
  const [clock, setClock] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupSearched, setLookupSearched] = useState(false);
  const [toast, setToast] = useState("");
  const [screenState, setScreenState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [triageDrafts, setTriageDrafts] = useState({});
  const [doctorDrafts, setDoctorDrafts] = useState({});
  const [triageReadyMap, setTriageReadyMap] = useState({});
  const [doctorReadyMap, setDoctorReadyMap] = useState({});
  const [selectedTriageQueueId, setSelectedTriageQueueId] = useState(null);
  const [selectedDoctorQueueId, setSelectedDoctorQueueId] = useState(null);
  const [doctorCaseMap, setDoctorCaseMap] = useState({});
  const [doctorCaseLoading, setDoctorCaseLoading] = useState(false);
  const allowedDepartmentIds = useMemo(() => getAllowedDepartmentIds(user), [user]);

  const loadDashboardData = useCallback(async () => {
    setLoadError("");

    try {
      const { getDepartments, getQueueByDepartment, getQueueStats, normalizePriority } = await import("../../lib/api");
      const allDepartments = await getDepartments();
      const departmentRows = allowedDepartmentIds.length
        ? allDepartments.filter((department) => allowedDepartmentIds.includes(Number(department.department_id)))
        : allDepartments;
      const queueLists = await Promise.all(
        departmentRows.map(async (department) => ({
          department,
          queue: await getQueueByDepartment(department.department_id),
        }))
      );

      const flattenedPatients = queueLists.flatMap(({ department, queue }) =>
        queue.map((patient) => ({
          id: patient.queue_id,
          queueId: patient.queue_id,
          appointmentId: patient.appointment_id || null,
          token: patient.token_number,
          patientId: patient.patient_id || null,
          name: patient.name,
          age: patient.age ?? "-",
          mobile: patient.phone ?? "",
          department: department.name,
          departmentId: department.department_id,
          priority: normalizePriority(patient.priority_level),
          priorityLevel: patient.priority_level,
          priorityHumanConfirmed: Boolean(patient.priority_human_confirmed),
          appointmentStatus: patient.appointment_status || "queued",
          symptoms: patient.symptoms || "",
          waitMins: patient.estimated_wait_time ?? 0,
          status: statusLabel(patient.status),
          rawStatus: patient.status,
          urgentReviewRequested: Boolean(patient.urgent_review_requested),
          urgentReviewReason: patient.urgent_review_reason || "",
          urgentReviewRequestedByName: patient.urgent_review_requested_by_name || "",
          temperatureC: patient.temperature_c ?? "",
          bloodPressure: patient.blood_pressure || "",
          pulseRate: patient.pulse_rate ?? "",
          spo2: patient.spo2 ?? "",
          weightKg: patient.weight_kg ?? "",
          triageNotes: patient.triage_notes || "",
          assessedByName: patient.assessed_by_name || "",
          assessedAt: patient.assessed_at || null,
          diagnosis: patient.diagnosis || "",
          prescription: patient.prescription || "",
          testsOrdered: patient.tests_ordered || "",
          followUpDate: patient.follow_up_date || "",
          followUpNotes: patient.follow_up_notes || "",
          doctorNotes: patient.doctor_notes || "",
          consultedByName: patient.consulted_by_name || "",
          consultedAt: patient.consulted_at || null,
          registeredAt: patient.created_at
            ? new Date(patient.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
            : "--:--",
        }))
      );

      const stats = await getQueueStats();
      setDepartments(departmentRows.map((department) => ({
        ...department,
        waiting: flattenedPatients.filter((patient) => patient.departmentId === department.department_id && patient.rawStatus === "waiting").length,
        completed: flattenedPatients.filter((patient) => patient.departmentId === department.department_id && patient.rawStatus === "completed").length,
        total: flattenedPatients.filter((patient) => patient.departmentId === department.department_id).length,
      })));
      setPatients(flattenedPatients);
      setScreenState(stats.total_patients || flattenedPatients.length ? "ready" : "empty");
    } catch (error) {
      setLoadError(error.message || "Unable to load staff queue details right now.");
      setScreenState("error");
    }
  }, [allowedDepartmentIds]);

  useEffect(() => {
    setClock(clockText());
    const timer = setInterval(() => setClock(clockText()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setScreenState("loading");
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (screenState !== "ready") return;
    const timer = setInterval(() => {
      loadDashboardData();
    }, TIMING.staffPollMs);
    const onFocus = () => {
      loadDashboardData();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadDashboardData();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [screenState, loadDashboardData]);

  const kpis = useMemo(() => {
    const waiting = patients.filter((patient) => patient.rawStatus === "waiting").length;
    const inConsult = patients.filter((patient) => patient.rawStatus === "in-progress").length;
    const completed = patients.filter((patient) => patient.rawStatus === "completed").length;
    const criticalWait = patients.filter((patient) => patient.rawStatus === "waiting" && patient.priority === "critical").length;
    const avgWait = waiting ? Math.round(patients.filter((patient) => patient.rawStatus === "waiting").reduce((sum, patient) => sum + patient.waitMins, 0) / waiting) : 0;
    return { totalToday: patients.length, waiting, inConsult, completed, criticalWait, avgWait };
  }, [patients]);

  const alertsList = useMemo(
    () =>
      [...patients]
        .filter((patient) => patient.rawStatus === "waiting" && patient.priority !== "normal")
        .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.token - b.token),
    [patients]
  );

  const queueRows = useMemo(() => {
    let rows = [...patients];
    if (deptFilter !== "All") rows = rows.filter((patient) => patient.department === deptFilter);
    return rows.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.token - b.token);
  }, [patients, deptFilter]);

  const priorityBreakdown = useMemo(() => {
    const total = patients.length || 1;
    const critical = patients.filter((patient) => patient.priority === "critical").length;
    const high = patients.filter((patient) => patient.priority === "high").length;
    const normal = patients.filter((patient) => patient.priority === "normal").length;
    return [
      { label: "Critical", value: critical, pct: Math.round((critical / total) * 100), color: "#DC2626" },
      { label: "High", value: high, pct: Math.round((high / total) * 100), color: "#D97706" },
      { label: "Normal", value: normal, pct: Math.round((normal / total) * 100), color: COLORS.navy },
    ];
  }, [patients]);

  const urgentReviewPatients = useMemo(
    () =>
      patients
        .filter(
          (patient) =>
            patient.rawStatus === "waiting"
            && patient.urgentReviewRequested
            && !patient.priorityHumanConfirmed
        )
        .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.token - b.token),
    [patients]
  );

  const triagePatients = useMemo(
    () =>
      patients
        .filter(
          (patient) =>
            patient.rawStatus === "in-progress"
            && !["ready-for-doctor", "completed"].includes(patient.appointmentStatus)
        )
        .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.token - b.token),
    [patients]
  );

  const triageWorkspacePatients = useMemo(() => {
    const byQueueId = new Map();
    [...urgentReviewPatients, ...triagePatients].forEach((patient) => {
      if (!byQueueId.has(patient.queueId)) byQueueId.set(patient.queueId, patient);
    });
    return Array.from(byQueueId.values());
  }, [urgentReviewPatients, triagePatients]);

  const assessedTodayPatients = useMemo(
    () =>
      patients
        .filter((patient) => Boolean(patient.assessedAt) && patient.appointmentStatus === "ready-for-doctor")
        .sort((a, b) => (new Date(b.assessedAt).getTime() || 0) - (new Date(a.assessedAt).getTime() || 0)),
    [patients]
  );

  const nurseStats = useMemo(() => {
    const waitingTriage = triagePatients.filter((patient) => patient.rawStatus === "waiting").length;
    const assessed = assessedTodayPatients.length;
    const urgent = urgentReviewPatients.length;
    return { waitingTriage, assessed, urgent };
  }, [triagePatients, assessedTodayPatients, urgentReviewPatients]);

  useEffect(() => {
    if (!isNurse) return;
    if (!triageWorkspacePatients.length) {
      setSelectedTriageQueueId(null);
      return;
    }

    if (triageWorkspacePatients.some((patient) => patient.queueId === selectedTriageQueueId)) return;
    const nextPatient = urgentReviewPatients[0] || triagePatients[0] || triageWorkspacePatients[0];
    setSelectedTriageQueueId(nextPatient?.queueId || null);
  }, [isNurse, triageWorkspacePatients, triagePatients, urgentReviewPatients, selectedTriageQueueId]);

  const selectedTriagePatient = useMemo(
    () => triageWorkspacePatients.find((patient) => patient.queueId === selectedTriageQueueId) || null,
    [triageWorkspacePatients, selectedTriageQueueId]
  );

  const doctorPatients = useMemo(
    () =>
      patients
        .filter((patient) => patient.appointmentStatus === "ready-for-doctor" || patient.rawStatus === "in-progress")
        .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.token - b.token),
    [patients]
  );

  const doctorStats = useMemo(() => {
    const ready = doctorPatients.filter((patient) => patient.appointmentStatus === "ready-for-doctor").length;
    const inRoom = doctorPatients.filter((patient) => patient.rawStatus === "in-progress").length;
    return { ready, inRoom };
  }, [doctorPatients]);

  useEffect(() => {
    if (!isDoctor) return;
    if (!doctorPatients.length) {
      setSelectedDoctorQueueId(null);
      return;
    }

    if (doctorPatients.some((patient) => patient.queueId === selectedDoctorQueueId)) return;
    setSelectedDoctorQueueId(doctorPatients[0].queueId);
  }, [isDoctor, doctorPatients, selectedDoctorQueueId]);

  const selectedDoctorPatient = useMemo(
    () => doctorPatients.find((patient) => patient.queueId === selectedDoctorQueueId) || null,
    [doctorPatients, selectedDoctorQueueId]
  );

  useEffect(() => {
    if (!isDoctor || !selectedDoctorQueueId || doctorCaseMap[selectedDoctorQueueId]) return;
    let cancelled = false;
    setDoctorCaseLoading(true);
    (async () => {
      try {
        const { getCaseByQueueId } = await import("../../lib/api");
        const response = await getCaseByQueueId(selectedDoctorQueueId);
        if (cancelled) return;
        setDoctorCaseMap((prev) => ({ ...prev, [selectedDoctorQueueId]: response?.case || null }));
      } catch (_error) {
        if (!cancelled) {
          setDoctorCaseMap((prev) => ({ ...prev, [selectedDoctorQueueId]: null }));
        }
      } finally {
        if (!cancelled) setDoctorCaseLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDoctor, selectedDoctorQueueId, doctorCaseMap]);

  const pushToast = (message) => setToast(message);

  const getTriageDraft = useCallback(
    (patient) => {
      const existing = triageDrafts[patient.queueId];
      return {
        temperature_c: patient.temperatureC === "" ? "" : String(patient.temperatureC),
        blood_pressure: patient.bloodPressure || "",
        pulse_rate: patient.pulseRate === "" ? "" : String(patient.pulseRate),
        spo2: patient.spo2 === "" ? "" : String(patient.spo2),
        weight_kg: patient.weightKg === "" ? "" : String(patient.weightKg),
        triage_notes: patient.triageNotes || "",
        ...(existing || {}),
      };
    },
    [triageDrafts]
  );

  const getDoctorDraft = useCallback(
    (patient) => {
      const existing = doctorDrafts[patient.queueId];
      return {
        diagnosis: patient.diagnosis || "",
        prescription: patient.prescription || "",
        tests_ordered: patient.testsOrdered || "",
        follow_up_date: patient.followUpDate ? String(patient.followUpDate).slice(0, 16) : "",
        follow_up_notes: patient.followUpNotes || "",
        doctor_notes: patient.doctorNotes || "",
        ...(existing || {}),
      };
    },
    [doctorDrafts]
  );

  const updateTriageDraft = useCallback((queueId, field, value) => {
    setTriageReadyMap((current) => ({
      ...current,
      [queueId]: false,
    }));
    setTriageDrafts((current) => ({
      ...current,
      [queueId]: {
        ...(current[queueId] || {}),
        [field]: value,
      },
    }));
  }, []);

  const updateDoctorDraft = useCallback((queueId, field, value) => {
    setDoctorReadyMap((current) => ({
      ...current,
      [queueId]: false,
    }));
    setDoctorDrafts((current) => ({
      ...current,
      [queueId]: {
        ...(current[queueId] || {}),
        [field]: value,
      },
    }));
  }, []);

  const callIn = async (departmentId) => {
    try {
      const { callNextPatient } = await import("../../lib/api");
      const result = await callNextPatient({ department_id: departmentId });
      pushToast(result.message || "Next patient called.");
      await loadDashboardData();
    } catch (error) {
      pushToast(error.message || "Unable to call next patient.");
    }
  };

  const complete = async (queueId) => {
    try {
      const { completePatient } = await import("../../lib/api");
      const result = await completePatient({ queue_id: queueId });
      pushToast(result.message || "Patient marked as completed.");
      await loadDashboardData();
    } catch (error) {
      pushToast(error.message || "Unable to complete patient.");
    }
  };

  const approvePriority = async (queueId, priorityLevel) => {
    try {
      const { overrideQueuePriority } = await import("../../lib/api");
      const result = await overrideQueuePriority(queueId, {
        priority_level: priorityLevel,
        escalated_by_role: user?.role || "nurse",
        escalated_by_name: user?.name || "Nurse",
        note: `Approved by ${user?.designation || "nurse"} after urgent review`,
      });
      pushToast(result.message || "Priority updated.");
      await loadDashboardData();
    } catch (error) {
      pushToast(error.message || "Unable to update priority.");
    }
  };

  const saveTriage = async (patient) => {
    try {
      const { recordNurseTriage } = await import("../../lib/api");
      const draft = getTriageDraft(patient);
      const validationError = validateTriageDraft(draft, getTriageProfile(patient.department), patient.department);
      if (validationError) {
        pushToast(validationError);
        return;
      }
      const result = await recordNurseTriage(patient.queueId, {
        ...draft,
        assessed_by_name: user?.name || "Triage Nurse",
      });
      pushToast(result.message || "Nurse assessment saved.");
      setTriageDrafts((current) => {
        const next = { ...current };
        delete next[patient.queueId];
        return next;
      });
      setTriageReadyMap((current) => ({
        ...current,
        [patient.queueId]: true,
      }));
      await loadDashboardData();
    } catch (error) {
      pushToast(error.message || "Unable to save nurse assessment.");
    }
  };

  const markReady = async (patient) => {
    try {
      const { markReadyForDoctor } = await import("../../lib/api");
      const draft = getTriageDraft(patient);
      const validationError = validateTriageDraft(draft, getTriageProfile(patient.department), patient.department);
      if (validationError) {
        pushToast(validationError);
        return;
      }
      await markReadyForDoctor(patient.queueId, {
        ...draft,
        assessed_by_name: user?.name || "Triage Nurse",
      });
      pushToast("Patient marked ready for doctor.");
      setTriageReadyMap((current) => ({
        ...current,
        [patient.queueId]: false,
      }));
      await loadDashboardData();
    } catch (error) {
      pushToast(error.message || "Unable to mark patient ready for doctor.");
    }
  };

  const saveDoctorWork = async (patient, completeVisit = false) => {
    try {
      const { saveDoctorUpdate } = await import("../../lib/api");
      const draft = getDoctorDraft(patient);
      await saveDoctorUpdate(patient.appointmentId, {
        ...draft,
        consulted_by_name: user?.name || "Doctor",
        complete_visit: completeVisit,
      });
      pushToast(completeVisit ? "Visit completed." : "Doctor notes saved.");
      setDoctorDrafts((current) => {
        const next = { ...current };
        delete next[patient.queueId];
        return next;
      });
      setDoctorReadyMap((current) => ({
        ...current,
        [patient.queueId]: !completeVisit,
      }));
      await loadDashboardData();
    } catch (error) {
      pushToast(error.message || "Unable to save doctor notes.");
    }
  };

  const runLookup = async () => {
    const query = lookupQuery.trim();
    if (!query) {
      setLookupResult(null);
      setLookupSearched(false);
      return;
    }

    try {
      const { lookupPatients, normalizePriority } = await import("../../lib/api");
      const response = await lookupPatients(query);
      const first = response?.patients?.[0] || null;
      if (!first) {
        setLookupResult(null);
        setLookupSearched(true);
        pushToast("No matching patient found.");
        return;
      }

      const latestVisit = first.latestVisit || null;
      const mapped = {
        patientId: first.patientId,
        token: latestVisit?.token || "-",
        tokenLabel: latestVisit?.tokenLabel || "",
        name: first.name,
        department: latestVisit?.department || "-",
        departmentId: latestVisit?.departmentId || null,
        mobile: first.mobile || "",
        priority: normalizePriority(latestVisit?.priorityLevel || 3),
        queueId: latestVisit?.queueId || null,
        rawStatus: latestVisit?.queueStatus || "",
        status: latestVisit?.queueStatus || latestVisit?.appointmentStatus || "-",
        waitMins: 0,
        registeredAt: latestVisit?.createdAt
          ? new Date(latestVisit.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })
          : "-",
        visitHistory: first.visitHistory || [],
      };
      setLookupResult(mapped);
      setLookupSearched(true);
      pushToast(`Patient found: ${mapped.name}`);
    } catch (error) {
      setLookupSearched(true);
      pushToast(error.message || "Unable to run patient lookup.");
    }
  };

  const confirmPriority = async (patient) => {
    try {
      const { confirmQueuePriority } = await import("../../lib/api");
      const result = await confirmQueuePriority(patient.queueId, {
        priority_level: patient.priorityLevel || 3,
        note: `Confirmed by ${user?.name || "Nurse"}`,
      });
      pushToast(result.message || "Priority confirmed.");
      await loadDashboardData();
    } catch (error) {
      pushToast(error.message || "Unable to confirm priority.");
    }
  };

  if (screenState === "loading") return <PageShell name={user?.name || "Staff"} clock={clock} role={user?.role}><StateCard title="Loading staff console" description="Fetching queue status and patient records from the backend." /></PageShell>;
  if (screenState === "error") return <PageShell name={user?.name || "Staff"} clock={clock} role={user?.role}><StateCard title="Unable to load console" description={loadError} actionLabel="Try Again" onAction={loadDashboardData} /></PageShell>;
  if (screenState === "empty") return <PageShell name={user?.name || "Staff"} clock={clock} role={user?.role}><StateCard title="No patients in queue" description="Registrations and queue activity will appear here once patients are added." actionLabel="Refresh Data" onAction={loadDashboardData} /></PageShell>;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.pageBg }}>
      <TricolorStrip />
      <GovHeader name={user?.name || "Staff"} clock={clock} role={user?.role} />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "14px 12px 24px" }}>
        <section style={{ background: COLORS.navy, color: "#fff", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ color: COLORS.skyText, fontSize: 12 }}>{isNurse ? "Nurse Console" : isDoctor ? "Doctor Console" : "Staff Console"}</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{user?.name || (isNurse ? "Triage Nurse" : isDoctor ? "Consulting Doctor" : "Reception Staff")}</div>
              <div style={{ color: COLORS.skyText, fontSize: 12 }}>{clock}</div>
            </div>
            {isNurse ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(92px, 1fr))", gap: 8, minWidth: 300 }}>
                <MiniStat title="For Triage" value={nurseStats.waitingTriage} />
                <MiniStat title="Urgent" value={nurseStats.urgent} />
                <MiniStat title="Assessed" value={nurseStats.assessed} />
              </div>
            ) : isDoctor ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(92px, 1fr))", gap: 8, minWidth: 300 }}>
                <MiniStat title="Ready" value={doctorStats.ready} />
                <MiniStat title="In Room" value={doctorStats.inRoom} />
                <MiniStat title="Done" value={kpis.completed} />
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(78px, 1fr))", gap: 8, minWidth: 320 }}>
                <MiniStat title="Waiting" value={kpis.waiting} />
                <MiniStat title="Critical" value={kpis.criticalWait} />
                <MiniStat title="In Room" value={kpis.inConsult} />
                <MiniStat title="Done" value={kpis.completed} />
              </div>
            )}
          </div>
        </section>

        <TabsBar activeTab={activeTab} onChange={setActiveTab} userRole={user?.role} />

        {activeTab === "overview" && !isNurse ? (
          <section style={{ marginTop: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 8 }}>
              <KpiCard label="Total Today" value={kpis.totalToday} color={COLORS.navy} />
              <KpiCard label="Waiting" value={kpis.waiting} color="#D97706" />
              <KpiCard label="Critical" value={kpis.criticalWait} color="#DC2626" />
              <KpiCard label="In Consultation" value={kpis.inConsult} color={COLORS.green} />
              <KpiCard label="Completed" value={kpis.completed} color="#64748B" />
              <KpiCard label="Avg Wait (min)" value={kpis.avgWait} color={COLORS.saffron} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10, marginTop: 10 }}>
              <Card title="Priority Alerts" count={alertsList.length} countColor="#DC2626">
                {alertsList.length ? (
                  <div style={{ maxHeight: 268, overflowY: "auto", display: "grid", gap: 8 }}>
                    {alertsList.map((patient) => (
                      <div key={patient.id} style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: 9, background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 800 }}>#{patient.token} | {patient.name}</div>
                              <div style={{ fontSize: 12, color: "#64748B" }}>{patient.department} | wait {patient.waitMins} min</div>
                            </div>
                            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>Reception manages queue calling</div>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12 }}><PriorityPill priority={patient.priority} /></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <InlineEmpty title="No high-priority alerts right now" description="Only high and critical patients appear here for the clinical team." />
                  )}
                </Card>

              <Card title="Department Load">
                <div style={{ display: "grid", gap: 8 }}>
                  {departments.map((department) => {
                    const bar = department.waiting >= 6 ? "#DC2626" : department.waiting >= 3 ? "#D97706" : COLORS.navy;
                    const width = `${Math.min(100, department.waiting * 12)}%`;
                    return <div key={department.department_id}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}><span>{department.name}</span><strong>{department.waiting}</strong></div><div style={{ marginTop: 4, background: "#E2E8F0", height: 8, borderRadius: 999, overflow: "hidden" }}><div style={{ width, height: "100%", background: bar }} /></div></div>;
                  })}
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {activeTab === "queue" ? (
          <section style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {["All", ...departments.map((department) => department.name)].map((department) => <button key={department} type="button" onClick={() => setDeptFilter(department)} style={{ border: `1px solid ${deptFilter === department ? COLORS.navy : "#CBD5E1"}`, borderRadius: 999, padding: "6px 10px", background: deptFilter === department ? COLORS.navy : "#fff", color: deptFilter === department ? "#fff" : "#334155", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{department}</button>)}
            </div>

            <section style={{ border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
              <div style={{ display: "grid", gridTemplateColumns: "72px 1.8fr 1.2fr 1fr 1fr 1fr", padding: "9px 10px", fontSize: 12, fontWeight: 800, color: "#64748B", borderBottom: "1px solid #E2E8F0" }}><div>TOKEN</div><div>PATIENT</div><div>DEPARTMENT</div><div>PRIORITY</div><div>WAIT</div><div>ACTION</div></div>
              {queueRows.length ? queueRows.map((patient) => <QueueManagerRow key={patient.id} patient={patient} userRole={user?.role} onOpenCase={() => navigate(`/case/queue/${patient.queueId}`)} onCall={() => callIn(patient.departmentId)} onComplete={() => complete(patient.queueId)} />) : <InlineEmpty title="No patients in this department" description="Try a different filter or wait for new registrations." />}
            </section>
          </section>
        ) : null}

        {activeTab === "lookup" ? (
          <section style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={lookupQuery} onChange={(event) => setLookupQuery(event.target.value)} onKeyDown={(event) => (event.key === "Enter" ? runLookup() : null)} placeholder="Search by patient id, mobile, token, or name" style={{ flex: 1, border: "1px solid #CBD5E1", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none" }} />
              <button type="button" onClick={runLookup} style={{ border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", fontWeight: 700, padding: "10px 14px", cursor: "pointer" }}>Search</button>
            </div>

            {lookupResult ? (
              <section style={{ border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                <div style={{ background: COLORS.navy, color: "#fff", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{lookupResult.name}</strong>
                  <div style={{ color: COLORS.skyText, fontSize: 12 }}>{lookupResult.tokenLabel || `Token #${lookupResult.token}`} | {lookupResult.department}</div>
                  <PriorityPill priority={lookupResult.priority} />
                </div>
                <div style={{ padding: 10, display: "grid", gridTemplateColumns: "repeat(2, minmax(160px,1fr))", gap: 8 }}>
                  <InfoBox label="Patient ID" value={lookupResult.patientId || "-"} />
                  <InfoBox label="Queue ID" value={lookupResult.queueId} />
                  <InfoBox label="Department" value={lookupResult.department} />
                  <InfoBox label="Priority" value={lookupResult.priority} />
                  <InfoBox label="Status" value={lookupResult.status} />
                  <InfoBox label="Estimated Wait" value={`${lookupResult.waitMins} min`} />
                  <InfoBox label="Registered At" value={lookupResult.registeredAt} />
                </div>
                <div style={{ padding: "0 10px 10px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {lookupResult.queueId ? <button type="button" onClick={() => navigate(`/case/queue/${lookupResult.queueId}`)} style={btnGhost}>Open Current Case</button> : null}
                  {lookupResult.rawStatus === "waiting" ? <button type="button" onClick={() => callIn(lookupResult.departmentId)} style={btnPrimary}>Call Next In Department</button> : null}
                  {lookupResult.rawStatus === "in-progress" ? <button type="button" onClick={() => complete(lookupResult.queueId)} style={{ ...btnPrimary, background: COLORS.green }}>Complete</button> : null}
                </div>
                <div style={{ padding: "0 10px 10px" }}>
                  <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 10 }}>
                    <strong style={{ fontSize: 13, color: "#0F172A" }}>Visit History</strong>
                    {lookupResult.visitHistory?.length ? (
                      <div style={{ marginTop: 8, display: "grid", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                        {lookupResult.visitHistory.map((visit) => (
                          <div key={`lookup-visit-${visit.appointmentId}`} style={{ border: "1px solid #E2E8F0", borderRadius: 8, background: "#F8FAFC", padding: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                              <strong>{visit.department}</strong>
                              <span style={{ color: "#475569" }}>{visit.tokenLabel || "-"}</span>
                            </div>
                            <div style={{ marginTop: 4, fontSize: 12, color: "#64748B" }}>
                              {visit.createdAt ? new Date(visit.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "-"} | {visit.queueStatus || visit.appointmentStatus || "-"}
                            </div>
                            <div style={{ marginTop: 4, fontSize: 12, color: "#334155" }}>{visit.symptoms || "No symptoms recorded"}</div>
                            {visit.diagnosis ? <div style={{ marginTop: 4, fontSize: 12, color: "#0F172A" }}><strong>Dx:</strong> {visit.diagnosis}</div> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>No previous visits found for this patient.</div>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <InlineEmpty
                title={lookupSearched ? "No patient found" : "Search for a patient"}
                description={lookupSearched ? "Try full mobile number, token, or exact patient name." : "Use token number or patient name to find the patient record."}
              />
            )}
          </section>
        ) : null}

        {activeTab === "triage" ? (
          <section style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {user?.role === "nurse" ? (
              <>
                  <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 10, alignItems: "start" }}>
                    <div style={{ display: "grid", gap: 10 }}>
                    <Card title="Urgent Review" count={urgentReviewPatients.length} countColor="#DC2626">
                      {urgentReviewPatients.length ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {urgentReviewPatients.map((patient) => (
                            <button
                              key={patient.id}
                              type="button"
                              onClick={() => setSelectedTriageQueueId(patient.queueId)}
                              style={{
                                border: selectedTriageQueueId === patient.queueId ? `2px solid ${COLORS.navy}` : "1px solid #E2E8F0",
                                borderRadius: 10,
                                padding: 10,
                                background: "#F8FAFC",
                                display: "grid",
                                gap: 8,
                                textAlign: "left",
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                                <div>
                                  <div style={{ fontWeight: 800, color: "#0F172A" }}>#{patient.token} | {patient.name}</div>
                                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{patient.department} | wait {patient.waitMins} min</div>
                                </div>
                                <ReviewFlagPill />
                              </div>
                              <div style={{ fontSize: 12, color: "#334155" }}>{patient.urgentReviewReason || "Urgent review requested by reception."}</div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <InlineEmpty title="No urgent review requests" description="Reception flags will appear here for quick nurse approval." />
                      )}
                    </Card>

                    <Card title="Patient Queue" count={triagePatients.length}>
                      {triagePatients.length ? (
                        <div style={{ display: "grid", gap: 8, maxHeight: 420, overflowY: "auto" }}>
                          {triagePatients.map((patient) => (
                            <button
                              key={patient.queueId}
                              type="button"
                              onClick={() => setSelectedTriageQueueId(patient.queueId)}
                              style={{
                                border: selectedTriageQueueId === patient.queueId ? `2px solid ${COLORS.navy}` : "1px solid #E2E8F0",
                                borderRadius: 10,
                                padding: 10,
                                background: "#fff",
                                textAlign: "left",
                                cursor: "pointer",
                                display: "grid",
                                gap: 6,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                                <div>
                                  <div style={{ fontWeight: 800, color: COLORS.navy }}>#{patient.token} | {patient.name}</div>
                                  <div style={{ marginTop: 2, fontSize: 12, color: "#64748B" }}>{patient.department}</div>
                                </div>
                                <PriorityPill priority={patient.priority} />
                              </div>
                              <div style={{ fontSize: 12, color: "#64748B" }}>
                                {patient.rawStatus === "in-progress" ? "In consultation" : "Waiting"} | {patient.waitMins} min | {patient.mobile || "No phone"}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <InlineEmpty title="No patients waiting for triage" description="New quick-intake or booked patients will appear here." />
                      )}
                    </Card>

                    <Card title="Assessed Today" count={assessedTodayPatients.length}>
                      {assessedTodayPatients.length ? (
                        <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                          {assessedTodayPatients.map((patient) => (
                            <button
                              key={`assessed-${patient.queueId}`}
                              type="button"
                              onClick={() => setSelectedTriageQueueId(patient.queueId)}
                              style={{
                                border: "1px solid #E2E8F0",
                                borderRadius: 10,
                                padding: 10,
                                background: "#F8FAFC",
                                textAlign: "left",
                                cursor: "pointer",
                                display: "grid",
                                gap: 5,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <strong style={{ color: COLORS.navy }}>#{patient.token} | {patient.name}</strong>
                                <AppointmentStatusPill status={patient.appointmentStatus} />
                              </div>
                              <div style={{ fontSize: 12, color: "#64748B" }}>
                                {patient.department} | Assessed {new Date(patient.assessedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <InlineEmpty title="No assessed handoffs yet" description="Patients marked ready for doctor will appear here." />
                      )}
                    </Card>
                  </div>

                  <Card title={selectedTriagePatient ? "Triage Workspace" : "Triage Workspace"} count={selectedTriagePatient ? selectedTriagePatient.token : undefined}>
                    {selectedTriagePatient ? (
                      (() => {
                        const patient = selectedTriagePatient;
                        const draft = getTriageDraft(patient);
                        const triageReady = Boolean(triageReadyMap[patient.queueId] || patient.assessedAt);
                        const triageProfile = getTriageProfile(patient.department);
                        const isRequired = (field) => (triageProfile.required || []).includes(field);
                        return (
                          <section style={{ display: "grid", gap: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.navy }}>#{patient.token} | {patient.name}</div>
                                <div style={{ marginTop: 3, fontSize: 13, color: "#64748B" }}>
                                  {patient.department} | {patient.rawStatus === "in-progress" ? "in consultation" : "waiting"} | {patient.mobile || "No phone"}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <PriorityPill priority={patient.priority} />
                                <AppointmentStatusPill status={patient.appointmentStatus} />
                              </div>
                            </div>

                            {patient.urgentReviewRequested && !patient.priorityHumanConfirmed ? (
                              <div style={{ border: "1px solid #FCD34D", background: "#FFFBEB", color: "#92400E", borderRadius: 8, padding: "9px 10px", fontSize: 13 }}>
                                <strong>Urgent review:</strong> {patient.urgentReviewReason || "Reception requested immediate nurse review."}
                              </div>
                            ) : null}

                            <div style={{ fontSize: 12, color: "#334155", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "7px 10px" }}>
                              <strong>{patient.department} required:</strong>{" "}
                              {(triageProfile.required || []).map((field) => TRIAGE_LABELS[field] || field).join(", ")}
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(90px, 1fr))", gap: 8 }}>
                              <label style={fieldLabel}>
                                <span>Temp (F){isRequired("temperature_f") ? " *" : ""}</span>
                                <input value={draft.temperature_c ?? ""} onChange={(event) => updateTriageDraft(patient.queueId, "temperature_c", event.target.value)} placeholder="98.6" style={fieldInputCompact} />
                              </label>
                              <label style={fieldLabel}>
                                <span>BP{isRequired("blood_pressure") ? " *" : ""}</span>
                                <input value={draft.blood_pressure ?? ""} onChange={(event) => updateTriageDraft(patient.queueId, "blood_pressure", event.target.value)} placeholder="120/80" style={fieldInputCompact} />
                              </label>
                              <label style={fieldLabel}>
                                <span>Pulse{isRequired("pulse_rate") ? " *" : ""}</span>
                                <input value={draft.pulse_rate ?? ""} onChange={(event) => updateTriageDraft(patient.queueId, "pulse_rate", event.target.value)} placeholder="72" style={fieldInputCompact} />
                              </label>
                              <label style={fieldLabel}>
                                <span>SpO2{isRequired("spo2") ? " *" : ""}</span>
                                <input value={draft.spo2 ?? ""} onChange={(event) => updateTriageDraft(patient.queueId, "spo2", event.target.value)} placeholder="98" style={fieldInputCompact} />
                              </label>
                              <label style={fieldLabel}>
                                <span>Weight{isRequired("weight_kg") ? " *" : ""}</span>
                                <input value={draft.weight_kg ?? ""} onChange={(event) => updateTriageDraft(patient.queueId, "weight_kg", event.target.value)} placeholder="60" style={fieldInputCompact} />
                              </label>
                            </div>

                            <label style={fieldLabel}>
                              <span>Triage Notes{isRequired("triage_notes") ? " *" : ""}</span>
                              <textarea value={draft.triage_notes} onChange={(event) => updateTriageDraft(patient.queueId, "triage_notes", event.target.value)} rows={4} placeholder="Brief triage summary..." style={{ ...fieldInputCompact, resize: "vertical", minHeight: 100 }} />
                            </label>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              <button type="button" onClick={() => navigate(`/case/queue/${patient.queueId}`)} style={btnGhost}>Open Full Case</button>
                              {patient.urgentReviewRequested && !patient.priorityHumanConfirmed ? (
                                <button type="button" onClick={() => confirmPriority(patient)} style={{ ...btnGhost, borderColor: "#2563EB", color: "#1D4ED8" }}>
                                  Confirm Priority
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => (triageReady ? markReady(patient) : saveTriage(patient))}
                                style={{ ...btnPrimary, background: triageReady ? COLORS.green : COLORS.navy }}
                              >
                                {triageReady ? "Ready For Doctor" : "Save Triage"}
                              </button>
                              {patient.urgentReviewRequested && !patient.priorityHumanConfirmed ? (
                                <>
                                  <button type="button" onClick={() => approvePriority(patient.queueId, 2)} style={{ ...btnPrimary, background: "#D97706" }}>Mark High</button>
                                  <button type="button" onClick={() => approvePriority(patient.queueId, 1)} style={{ ...btnPrimary, background: "#DC2626" }}>Mark Critical</button>
                                </>
                              ) : null}
                            </div>

                            {patient.assessedAt ? (
                              <div style={{ fontSize: 12, color: "#166534", fontWeight: 700 }}>
                                Assessed {new Date(patient.assessedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                              </div>
                            ) : null}
                          </section>
                        );
                      })()
                    ) : (
                      <InlineEmpty title="Select a patient" description="Choose a patient from the queue or urgent review list to start triage." />
                    )}
                  </Card>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {activeTab === "consult" ? (
          <section style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {isDoctor ? (
              <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 10, alignItems: "start" }}>
                <Card title="Patients For Consultation" count={doctorPatients.length}>
                  {doctorPatients.length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {doctorPatients.map((patient) => (
                        <button
                          key={patient.queueId}
                          type="button"
                          onClick={() => setSelectedDoctorQueueId(patient.queueId)}
                          style={{
                            border: selectedDoctorQueueId === patient.queueId ? `2px solid ${COLORS.navy}` : "1px solid #E2E8F0",
                            borderRadius: 10,
                            padding: 10,
                            background: "#fff",
                            textAlign: "left",
                            cursor: "pointer",
                            display: "grid",
                            gap: 6,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontWeight: 800, color: COLORS.navy }}>#{patient.token} | {patient.name}</div>
                            <div style={{ marginTop: 2, fontSize: 12, color: "#64748B" }}>{patient.department}</div>
                          </div>
                          <PriorityPill priority={patient.priority} />
                        </div>
                          <div style={{ fontSize: 12, color: "#334155" }}>{patient.symptoms || "Consultation details available in case file."}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <AppointmentStatusPill status={patient.appointmentStatus} />
                            {patient.consultedAt ? <span style={{ fontSize: 12, color: "#166534", fontWeight: 700 }}>Updated</span> : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <InlineEmpty title="No patients ready for doctor" description="Nurse handoff and in-room patients will appear here." />
                  )}
                </Card>

                <Card title="Consultation Workspace" count={selectedDoctorPatient ? selectedDoctorPatient.token : undefined}>
                  {selectedDoctorPatient ? (
                    (() => {
                      const patient = selectedDoctorPatient;
                      const draft = getDoctorDraft(patient);
                      const doctorReady = Boolean(doctorReadyMap[patient.queueId] || patient.consultedAt);
                      const caseData = doctorCaseMap[patient.queueId] || null;
                      const patientProfile = caseData?.patient || null;
                      const previousVisit = Array.isArray(caseData?.visitHistory) ? caseData.visitHistory.find((visit) => visit.appointmentId !== patient.appointmentId) : null;
                      const flags = buildClinicalFlags({
                        temperatureF: toNullableNumber(patient.temperatureC),
                        pulseRate: toNullableNumber(patient.pulseRate),
                        spo2: toNullableNumber(patient.spo2),
                        painScale: patient.painScale,
                      });
                      const summaryText = [
                        `Patient: ${patient.name} (${patient.age}/${patientProfile?.gender || "-"})`,
                        `Token: #${patient.token} | Dept: ${patient.department}`,
                        `Symptoms: ${patient.symptoms || "-"}`,
                        `Current Vitals: Temp ${patient.temperatureC || "-"} F, BP ${patient.bloodPressure || "-"}, Pulse ${patient.pulseRate || "-"}, SpO2 ${patient.spo2 || "-"}, Weight ${patient.weightKg || "-"} kg`,
                        `Allergies: ${patientProfile?.allergies || "-"}`,
                        `Chronic Conditions: ${patientProfile?.chronicConditions || "-"}`,
                        `Previous Diagnosis: ${previousVisit?.doctor?.diagnosis || "-"}`,
                        `Previous Prescription: ${previousVisit?.doctor?.prescription || "-"}`,
                        `Previous Visit Date: ${previousVisit?.createdAt ? new Date(previousVisit.createdAt).toLocaleDateString("en-IN") : "-"}`,
                      ].join("\n");
                      return (
                        <section style={{ display: "grid", gap: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.navy }}>#{patient.token} | {patient.name}</div>
                              <div style={{ marginTop: 3, fontSize: 13, color: "#64748B" }}>
                                {patient.department} | {patient.rawStatus === "in-progress" ? "in consultation" : "ready for doctor"} | {patient.mobile || "No phone"}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              <PriorityPill priority={patient.priority} />
                              <AppointmentStatusPill status={patient.appointmentStatus} />
                            </div>
                          </div>

                          <section style={{ border: "1px solid #DBEAFE", background: "#EFF6FF", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <strong style={{ color: COLORS.navy }}>Clinical Snapshot</strong>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(summaryText);
                                    pushToast("Clinical summary copied.");
                                  } catch (_error) {
                                    pushToast("Unable to copy summary.");
                                  }
                                }}
                                style={{ ...btnGhost, padding: "6px 10px", fontSize: 12 }}
                              >
                                Copy Clinical Summary
                              </button>
                            </div>
                            {doctorCaseLoading ? <div style={{ fontSize: 12, color: "#475569" }}>Loading profile and history...</div> : null}
                            <div style={{ display: "grid", gap: 6, fontSize: 13, color: "#0F172A" }}>
                              <div><strong>Age / Gender:</strong> {patient.age} / {patientProfile?.gender || "-"}</div>
                              <div><strong>Allergies:</strong> {patientProfile?.allergies || "-"}</div>
                              <div><strong>Conditions:</strong> {patientProfile?.chronicConditions || "-"}</div>
                              <div><strong>Last Dx:</strong> {previousVisit?.doctor?.diagnosis || "-"}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {flags.length ? flags.map((flag) => <FlagPill key={flag.label} tone={flag.tone} label={flag.label} />) : <span style={{ fontSize: 12, color: "#166534", fontWeight: 700 }}>No immediate red flags from triage values.</span>}
                            </div>
                          </section>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(160px, 1fr))", gap: 8 }}>
                            <InfoBox label="Symptoms" value={patient.symptoms || "See full case for details"} />
                            <InfoBox label="Vitals" value={`${patient.temperatureC || "-"} F | BP ${patient.bloodPressure || "-"} | Pulse ${patient.pulseRate || "-"}`} />
                            <InfoBox label="Triage Notes" value={patient.triageNotes || "No nurse note yet"} />
                            <InfoBox label="History" value="Use Open Full Case for past consultations and profile history" />
                          </div>

                          <Field label="Diagnosis">
                            <textarea value={draft.diagnosis} onChange={(event) => updateDoctorDraft(patient.queueId, "diagnosis", event.target.value)} rows={3} style={{ ...fieldInputCompact, minHeight: 88, resize: "vertical" }} />
                          </Field>
                          <Field label="Prescription / Advice">
                            <textarea value={draft.prescription} onChange={(event) => updateDoctorDraft(patient.queueId, "prescription", event.target.value)} rows={3} style={{ ...fieldInputCompact, minHeight: 88, resize: "vertical" }} />
                          </Field>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <Field label="Tests / Investigations">
                              <textarea value={draft.tests_ordered} onChange={(event) => updateDoctorDraft(patient.queueId, "tests_ordered", event.target.value)} rows={3} style={{ ...fieldInputCompact, minHeight: 82, resize: "vertical" }} />
                            </Field>
                            <div style={{ display: "grid", gap: 8 }}>
                              <Field label="Follow-up Date">
                                <input type="datetime-local" value={draft.follow_up_date} onChange={(event) => updateDoctorDraft(patient.queueId, "follow_up_date", event.target.value)} style={fieldInputCompact} />
                              </Field>
                              <Field label="Follow-up Notes">
                                <textarea value={draft.follow_up_notes} onChange={(event) => updateDoctorDraft(patient.queueId, "follow_up_notes", event.target.value)} rows={2} style={{ ...fieldInputCompact, minHeight: 60, resize: "vertical" }} />
                              </Field>
                            </div>
                          </div>
                          <Field label="Doctor Notes">
                            <textarea value={draft.doctor_notes} onChange={(event) => updateDoctorDraft(patient.queueId, "doctor_notes", event.target.value)} rows={4} style={{ ...fieldInputCompact, minHeight: 110, resize: "vertical" }} />
                          </Field>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <button type="button" onClick={() => navigate(`/case/queue/${patient.queueId}`)} style={btnGhost}>Open Full Case</button>
                            <button
                              type="button"
                              onClick={() => (doctorReady ? saveDoctorWork(patient, true) : saveDoctorWork(patient, false))}
                              style={{ ...btnPrimary, background: doctorReady ? COLORS.green : COLORS.navy }}
                            >
                              {doctorReady ? "Complete Visit" : "Save Consultation"}
                            </button>
                          </div>

                          {patient.consultedAt ? (
                            <div style={{ fontSize: 12, color: "#166534", fontWeight: 700 }}>
                              Last updated {new Date(patient.consultedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                            </div>
                          ) : null}
                        </section>
                      );
                    })()
                  ) : (
                    <InlineEmpty title="Select a patient" description="Choose a patient from the consultation list to review symptoms, triage values, past case notes, and treatment details." />
                  )}
                </Card>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === "overrides" ? (
          <section style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {user?.role === "nurse" ? (
              urgentReviewPatients.length ? (
                <section style={{ border: "1px solid #CBD5E1", borderRadius: 10, background: "#fff", padding: 10 }}>
                  <h3 style={h3}>Urgent Review Requests</h3>
                  <div style={{ display: "grid", gap: 8 }}>
                    {urgentReviewPatients.map((patient) => (
                      <div key={patient.id} style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: 10, background: "#F8FAFC" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>#{patient.token} | {patient.name}</div>
                            <div style={{ fontSize: 12, color: "#64748B" }}>{patient.department} | requested by {patient.urgentReviewRequestedByName || "Reception"}</div>
                          </div>
                          <PriorityPill priority={patient.priority} />
                        </div>
                          <div style={{ marginTop: 6, fontSize: 13, color: "#334155" }}>{patient.urgentReviewReason}</div>
                          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => navigate(`/case/queue/${patient.queueId}`)} style={btnGhost}>Open Case</button>
                            <button type="button" onClick={() => approvePriority(patient.queueId, 2)} style={{ ...btnPrimary, background: "#D97706" }}>Approve High</button>
                            <button type="button" onClick={() => approvePriority(patient.queueId, 1)} style={{ ...btnPrimary, background: "#DC2626" }}>Approve Critical</button>
                            <button type="button" onClick={() => approvePriority(patient.queueId, patient.priorityLevel || 3)} style={btnGhost}>Clear Flag / Keep Order</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section style={{ border: "1px solid #CBD5E1", background: "#fff", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.6 }}>
                  No urgent review requests are waiting for nurse approval right now.
                </section>
              )
            ) : (
              <section style={{ border: "1px solid #FCD34D", background: "#FFFBEB", color: "#92400E", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.6 }}>
                Priority override is reserved for nurse review. Reception can only flag a patient for urgent review, and doctors should focus on consultation flow.
              </section>
            )}
          </section>
        ) : null}

        {activeTab === "analytics" ? (
          <section style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <section style={{ border: "1px solid #CBD5E1", borderRadius: 10, background: "#fff", padding: 10 }}>
              <h3 style={h3}>Priority Breakdown</h3>
              <div style={{ display: "grid", gap: 9 }}>
                {priorityBreakdown.map((item) => <div key={item.label}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}><span>{item.label}</span><strong>{item.value} ({item.pct}%)</strong></div><div style={{ marginTop: 4, background: "#E2E8F0", height: 10, borderRadius: 999 }}><div style={{ width: `${item.pct}%`, height: "100%", background: item.color, borderRadius: 999 }} /></div></div>)}
              </div>
            </section>

            <section style={{ border: "1px solid #CBD5E1", borderRadius: 10, background: "#fff", padding: 10 }}>
              <h3 style={h3}>Department Summary</h3>
              <div style={{ display: "grid", gap: 7 }}>
                {departments.map((department) => <div key={department.department_id} style={{ display: "grid", gridTemplateColumns: "1.3fr auto auto auto", gap: 8, fontSize: 12, alignItems: "center", borderBottom: "1px solid #E2E8F0", paddingBottom: 6 }}><span>{department.name}</span><strong style={{ color: "#B45309" }}>{department.waiting} wait</strong><strong style={{ color: "#166534" }}>{department.completed} done</strong><span style={{ color: "#64748B" }}>{department.total} total</span></div>)}
              </div>
            </section>
          </section>
        ) : null}

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button type="button" onClick={loadDashboardData} style={btnPrimary}>Refresh</button>
          <button type="button" onClick={onLogout} style={btnGhost}>Sign Out</button>
        </div>
      </main>

      <GovFooter />

      {toast ? <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: COLORS.navy, color: "#fff", padding: "10px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, boxShadow: "0 10px 24px rgba(15,23,42,0.28)", zIndex: 9999 }}>{toast}</div> : null}
    </div>
  );
}

const btnPrimary = { border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", fontWeight: 700, padding: "9px 12px", cursor: "pointer" };
const btnGhost = { border: "1px solid #CBD5E1", borderRadius: 8, background: "#fff", color: "#334155", fontWeight: 700, padding: "9px 12px", cursor: "pointer" };
const h3 = { margin: "0 0 8px", color: COLORS.navy, fontSize: 16 };

function PageShell({ name, clock, role, children }) {
  return <div style={{ minHeight: "100vh", background: COLORS.pageBg }}><TricolorStrip /><GovHeader name={name} clock={clock} role={role} /><main style={{ maxWidth: 880, margin: "0 auto", padding: "14px 12px 24px" }}>{children}</main><GovFooter /></div>;
}

function StateCard({ title, description, actionLabel, onAction }) {
  return <section style={{ border: "1px solid #CBD5E1", borderRadius: 12, background: "#fff", padding: 24, textAlign: "center" }}><div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E2E8F0", margin: "0 auto 12px" }} /><h2 style={{ margin: 0, fontSize: 22, color: "#0F172A" }}>{title}</h2><p style={{ margin: "8px 0 0", color: "#64748B", lineHeight: 1.6 }}>{description}</p>{actionLabel ? <button type="button" onClick={onAction} style={{ marginTop: 16, border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>{actionLabel}</button> : null}</section>;
}

function InlineEmpty({ title, description }) {
  return <div style={{ padding: 20, textAlign: "center", color: "#64748B" }}><div style={{ fontWeight: 800, color: "#0F172A" }}>{title}</div><div style={{ marginTop: 6, fontSize: 13 }}>{description}</div></div>;
}

function TabsBar({ activeTab, onChange, userRole }) {
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "consult", label: "Consultation" },
    { key: "queue", label: "Queue Manager" },
    { key: "lookup", label: "Patient Lookup" },
    { key: "triage", label: "Triage" },
    { key: "overrides", label: "Overrides" },
    { key: "analytics", label: "Analytics" },
  ];
  const visibleTabs = userRole === "nurse"
    ? tabs.filter((tab) => ["triage", "lookup", "overrides"].includes(tab.key))
    : userRole === "doctor"
      ? tabs.filter((tab) => ["consult", "lookup"].includes(tab.key))
    : tabs.filter((tab) => (tab.key === "triage" ? userRole === "nurse" : true));
  return <section style={{ display: "grid", gridTemplateColumns: `repeat(${visibleTabs.length},1fr)`, background: "#fff", border: "1px solid #CBD5E1", borderRadius: 999, padding: 4, gap: 2 }}>{visibleTabs.map((tab) => <button key={tab.key} type="button" onClick={() => onChange(tab.key)} style={{ border: "none", borderRadius: 999, padding: "8px 8px", cursor: "pointer", fontWeight: 700, fontSize: 12, background: activeTab === tab.key ? COLORS.navy : "transparent", color: activeTab === tab.key ? "#fff" : "#64748B" }}>{tab.label}</button>)}</section>;
}

function KpiCard({ value, label, color }) { return <div style={{ background: "#fff", border: "1px solid #CBD5E1", borderRadius: 10, padding: 10 }}><div style={{ fontFamily: "monospace", fontSize: 26, fontWeight: 900, color }}>{value}</div><div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{label}</div></div>; }
function Card({ title, count, countColor, children }) { return <section style={{ border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden", background: "#fff" }}><div style={{ background: COLORS.navy, color: "#fff", padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><strong>{title}</strong>{typeof count === "number" ? <span style={{ background: "#fff", color: countColor || COLORS.navy, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>{count}</span> : null}</div><div style={{ padding: 10 }}>{children}</div></section>; }
function MiniStat({ title, value }) { return <div style={{ border: "1px solid rgba(255,255,255,.25)", borderRadius: 8, padding: "8px 9px" }}><div style={{ fontSize: 11, color: COLORS.saffron }}>{title}</div><div style={{ fontSize: 14, fontWeight: 900, color: COLORS.skyText, marginTop: 2 }}>{value}</div></div>; }
function PriorityPill({ priority }) { const tone = priority === "critical" ? { bg: "#FEE2E2", color: "#B91C1C", label: "Critical" } : priority === "high" ? { bg: "#FEF3C7", color: "#B45309", label: "High" } : { bg: "#DCFCE7", color: "#166534", label: "Normal" }; return <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: "3px 8px", fontSize: 12, fontWeight: 700 }}>{tone.label}</span>; }
function FlagPill({ tone, label }) {
  const palette = tone === "critical"
    ? { bg: "#FEE2E2", color: "#B91C1C" }
    : { bg: "#FEF3C7", color: "#92400E" };
  return <span style={{ background: palette.bg, color: palette.color, borderRadius: 999, padding: "3px 8px", fontSize: 12, fontWeight: 800 }}>{label}</span>;
}
function ReviewFlagPill() { return <span style={{ background: "#FEF3C7", color: "#B45309", borderRadius: 999, padding: "3px 8px", fontSize: 12, fontWeight: 700 }}>Needs Review</span>; }
function AppointmentStatusPill({ status }) {
  const tone = status === "ready-for-doctor"
    ? { bg: "#DCFCE7", color: "#166534", label: "Ready" }
    : status === "in-progress"
      ? { bg: "#DBEAFE", color: "#1D4ED8", label: "In Room" }
      : { bg: "#E2E8F0", color: "#475569", label: "Queued" };
  return <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: "3px 8px", fontSize: 12, fontWeight: 700 }}>{tone.label}</span>;
}
function QueueManagerRow({ patient, userRole, onOpenCase, onCall, onComplete }) { const left = patient.priority === "critical" ? "#DC2626" : patient.priority === "high" ? "#D97706" : "transparent"; const rowBg = patient.status === "in-consultation" ? "#ECFDF5" : patient.status === "completed" ? "#F1F5F9" : "#FFFFFF"; return <div style={{ display: "grid", gridTemplateColumns: "72px 1.8fr 1.2fr 1fr 1fr 1fr", gap: 8, alignItems: "center", borderBottom: "1px solid #E2E8F0", borderLeft: `4px solid ${left}`, background: rowBg, padding: "9px 10px", fontSize: 12 }}><div style={{ fontFamily: "monospace", fontWeight: 800 }}>#{patient.token}</div><div><div style={{ fontWeight: 700 }}>{patient.name}</div><div style={{ color: "#64748B" }}>Queue #{patient.queueId}</div></div><div>{patient.department}</div><div><PriorityPill priority={patient.priority} /></div><div>{patient.waitMins} min</div><div style={{ display: "grid", gap: 6 }}>{patient.rawStatus === "waiting" ? (userRole === "nurse" ? <span style={{ color: "#64748B", fontWeight: 700 }}>Reception Calls</span> : <button type="button" onClick={onCall} style={{ ...btnPrimary, padding: "6px 9px", fontSize: 12 }}>Call Next</button>) : patient.rawStatus === "in-progress" ? <button type="button" onClick={onComplete} style={{ ...btnPrimary, background: COLORS.green, padding: "6px 9px", fontSize: 12 }}>Complete</button> : <span style={{ color: "#64748B", fontWeight: 700 }}>Done</span>}<button type="button" onClick={onOpenCase} style={{ ...btnGhost, padding: "6px 9px", fontSize: 12 }}>Open Case</button></div></div>; }
function InfoBox({ label, value }) { return <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, background: "#F8FAFC", padding: "8px 9px" }}><div style={{ fontSize: 11, color: "#64748B" }}>{label}</div><div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>{value}</div></div>; }
function Field({ label, children }) { return <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#334155" }}><span>{label}</span>{children}</label>; }
const fieldLabel = { display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#334155" };
const fieldInput = { border: "1px solid #CBD5E1", borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
const fieldInputCompact = { ...fieldInput, padding: "8px 9px", fontSize: 12 };
function TricolorStrip() { return <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, background: COLORS.saffron }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: COLORS.green }} /></div>; }
function GovHeader({ name, clock, role }) {
  const subtitle = role === "nurse" ? "Nurse Console" : role === "doctor" ? "Doctor Console" : "Staff Console";
  return <header style={{ background: COLORS.navyDark, color: "#fff", padding: "10px 12px" }}><div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>SQ</div><div><div style={{ fontWeight: 800, fontSize: 18 }}>SwasthyaQueue</div><div style={{ color: COLORS.skyText, fontSize: 12 }}>{subtitle}</div></div></div><div style={{ fontSize: 12, color: COLORS.skyText, fontWeight: 700 }}>{name} | {clock}</div></div></header>;
}
function GovFooter() { return <footer style={{ background: COLORS.navyDark, color: COLORS.skyText, fontSize: 12, padding: "10px 12px" }}><div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>Copyright 2026 SwasthyaQueue | Government Hospital OPD Digital Queue System</div></footer>; }
