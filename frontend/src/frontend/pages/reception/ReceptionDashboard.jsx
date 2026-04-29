import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const COLORS = {
  navyDark: "#002060",
  navy: "#003580",
  saffron: "#FF9933",
  green: "#138808",
  pageBg: "#EEF2F7",
  skyText: "#A8C8FF",
};

const DEPARTMENT_COLORS = {
  "General Medicine": { accent: "#2563EB", soft: "#DBEAFE" },
  Cardiology: { accent: "#DC2626", soft: "#FEE2E2" },
  Orthopedics: { accent: "#EA580C", soft: "#FFEDD5" },
  Pediatrics: { accent: "#16A34A", soft: "#DCFCE7" },
  Emergency: { accent: "#7C3AED", soft: "#EDE9FE" },
};

function clockText() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function normalizeMobile(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) return digits.slice(-10);
  return digits.slice(0, 10);
}

function formatIndianMobile(value = "") {
  const normalized = normalizeMobile(value);
  if (!normalized) return "-";
  if (normalized.length <= 5) return `+91 ${normalized}`;
  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function priorityRank(priority) {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  return 2;
}

function normalizeStatus(status) {
  if (status === "in-progress") return "In Consultation";
  if (status === "waiting") return "Waiting";
  return status || "-";
}

export default function ReceptionDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [clock, setClock] = useState("");
  const [screenState, setScreenState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [departments, setDepartments] = useState([]);
  const [queueRows, setQueueRows] = useState([]);
  const [query, setQuery] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupMatches, setLookupMatches] = useState([]);
  const [activeDepartment, setActiveDepartment] = useState("All");
  const [urgentForm, setUrgentForm] = useState({ queueId: null, reason: "" });
  const [assistedForm, setAssistedForm] = useState({
    name: "",
    age: "",
    gender: "",
    mobile: "",
    email: "",
    emergencyContact: "",
    address: "",
  });
  const [assistedState, setAssistedState] = useState({ loading: false, error: "", success: null });
  const [activeOverlay, setActiveOverlay] = useState("");
  const [quickIntakeForm, setQuickIntakeForm] = useState({
    name: "",
    age: "",
    gender: "",
    mobile: "",
    departmentId: "",
    symptoms: "",
  });
  const [quickIntakeState, setQuickIntakeState] = useState({ loading: false, error: "", success: "" });

  const loadReceptionData = useCallback(async () => {
    setLoadError("");

    try {
      const { getDepartments, getQueueByDepartment, normalizePriority } = await import("../../lib/api");
      const departmentRows = await getDepartments();
      const queueByDepartment = await Promise.all(
        departmentRows.map(async (department) => ({
          department,
          queue: await getQueueByDepartment(department.department_id),
        }))
      );

      const flattenedQueue = queueByDepartment.flatMap(({ department, queue }) =>
        queue.map((patient, index) => ({
          id: patient.queue_id,
          queueId: patient.queue_id,
          token: patient.token_number,
          tokenLabel: patient.token_label || null,
          patientId: patient.patient_id,
          name: patient.name,
          age: patient.age ?? "-",
          mobile: patient.phone ?? "",
          department: department.name,
          departmentId: department.department_id,
          avgConsultTime: department.avg_consult_time,
          priority: normalizePriority(patient.priority_level),
          priorityLevel: patient.priority_level,
          waitMins: patient.estimated_wait_time ?? index * department.avg_consult_time,
          peopleAhead: patient.status === "in-progress" ? 0 : index,
          status: normalizeStatus(patient.status),
          rawStatus: patient.status,
          registeredAt: formatDateTime(patient.created_at),
          preferredSlot: patient.preferred_slot ? formatDateTime(patient.preferred_slot) : "-",
          urgentReviewRequested: Boolean(patient.urgent_review_requested),
          urgentReviewReason: patient.urgent_review_reason || "",
        }))
      );

      const summarizedDepartments = departmentRows.map((department) => {
        const rows = flattenedQueue.filter((patient) => patient.departmentId === department.department_id);
        const waiting = rows.filter((patient) => patient.rawStatus === "waiting").length;
        const active = rows.find((patient) => patient.rawStatus === "in-progress");
        const nowServing = active?.tokenLabel || (active?.token ? `#${active.token}` : null) || rows[0]?.tokenLabel || (rows[0]?.token ? `#${rows[0].token}` : "-");
        const etaForNewToken = waiting * department.avg_consult_time;
        return {
          ...department,
          waiting,
          nowServing,
          etaForNewToken,
          color: DEPARTMENT_COLORS[department.name] || { accent: COLORS.navy, soft: "#DBEAFE" },
        };
      });

      setDepartments(summarizedDepartments);
      setQueueRows(flattenedQueue.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.token - b.token));
      setScreenState(flattenedQueue.length || summarizedDepartments.length ? "ready" : "empty");
    } catch (err) {
      setLoadError(err.message || "Unable to load the receptionist console right now.");
      setScreenState("error");
    }
  }, []);

  useEffect(() => {
    setClock(clockText());
    const timer = setInterval(() => setClock(clockText()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setScreenState("loading");
    loadReceptionData();
  }, [loadReceptionData]);

  useEffect(() => {
    if (screenState !== "ready") return;
    const timer = setInterval(() => {
      loadReceptionData();
    }, 20000);
    const onFocus = () => {
      loadReceptionData();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [screenState, loadReceptionData]);

  const receptionistStats = useMemo(() => {
    const waiting = queueRows.filter((row) => row.rawStatus === "waiting").length;
    const inConsult = queueRows.filter((row) => row.rawStatus === "in-progress").length;
    const avgWait = waiting
      ? Math.round(queueRows.filter((row) => row.rawStatus === "waiting").reduce((sum, row) => sum + row.waitMins, 0) / waiting)
      : 0;
    return {
      waiting,
      inConsult,
      avgWait,
      patientsVisible: queueRows.length,
    };
  }, [queueRows]);

  const visibleQueueRows = useMemo(() => {
    if (activeDepartment === "All") return queueRows;
    return queueRows.filter((row) => row.department === activeDepartment);
  }, [queueRows, activeDepartment]);

  const runLookup = async () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setLookupResult(null);
      setLookupMatches([]);
      return;
    }

    try {
      const { lookupPatients, normalizePriority } = await import("../../lib/api");
      const response = await lookupPatients(normalizedQuery);
      const mappedMatches = (response?.patients || []).map((patient) => {
        const latestVisit = patient.latestVisit || null;
        const activeQueueRow = latestVisit?.queueId
          ? queueRows.find((row) => row.queueId === latestVisit.queueId)
          : null;

        return {
          queueId: latestVisit?.queueId || null,
          token: latestVisit?.token || "-",
          tokenLabel: activeQueueRow?.tokenLabel || null,
          patientId: patient.patientId,
          name: patient.name,
          age: patient.age ?? "-",
          mobile: patient.mobile ?? "",
          department: latestVisit?.department || "-",
          departmentId: latestVisit?.departmentId || null,
          priority: activeQueueRow ? activeQueueRow.priority : normalizePriority(latestVisit?.priorityLevel || 3),
          priorityLevel: latestVisit?.priorityLevel || null,
          waitMins: activeQueueRow?.waitMins ?? 0,
          peopleAhead: activeQueueRow?.peopleAhead ?? 0,
          status: activeQueueRow?.status || normalizeStatus(latestVisit?.queueStatus || latestVisit?.appointmentStatus || "No Active Queue"),
          rawStatus: activeQueueRow?.rawStatus || latestVisit?.queueStatus || "",
          registeredAt: latestVisit?.createdAt ? formatDateTime(latestVisit.createdAt) : "-",
          preferredSlot: latestVisit?.preferredSlot ? formatDateTime(latestVisit.preferredSlot) : "-",
          hasActiveQueue: Boolean(patient.hasActiveQueue),
        };
      });

      setLookupMatches(mappedMatches);
      setLookupResult(mappedMatches[0] || null);
    } catch (err) {
      setLoadError(err.message || "Unable to search patients right now.");
      setLookupMatches([]);
      setLookupResult(null);
    }
  };

  const submitUrgentReview = async (queueId) => {
    const reason = urgentForm.queueId === queueId ? urgentForm.reason.trim() : "";
    if (!reason) return;

    try {
      const { flagUrgentReview } = await import("../../lib/api");
      await flagUrgentReview(queueId, {
        reason,
        requested_by_role: user?.role || "receptionist",
        requested_by_name: user?.name || "Front Desk",
      });
      setUrgentForm({ queueId: null, reason: "" });
      await loadReceptionData();
    } catch (err) {
      setLoadError(err.message || "Unable to flag urgent review right now.");
    }
  };

  const callNextForDepartment = async (departmentId) => {
    try {
      const { callNextPatient } = await import("../../lib/api");
      await callNextPatient({ department_id: departmentId });
      await loadReceptionData();
    } catch (err) {
      setLoadError(err.message || "Unable to call the next patient right now.");
    }
  };

  const setAssistedField = (key, value) => {
    setAssistedForm((prev) => ({ ...prev, [key]: value }));
  };

  const setQuickIntakeField = (key, value) => {
    setQuickIntakeForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAssistedCreate = async (event) => {
    event.preventDefault();
    setAssistedState({ loading: true, error: "", success: null });

    try {
      const { createStaffAssistedPatientAccount } = await import("../../lib/api");
      const response = await createStaffAssistedPatientAccount({
        ...assistedForm,
        age: Number(assistedForm.age),
        mobile: normalizeMobile(assistedForm.mobile) || null,
        emergencyContact: normalizeMobile(assistedForm.emergencyContact) || null,
        createdByRole: user?.role || "receptionist",
        createdByName: user?.name || "Front Desk",
      });

      setAssistedState({
        loading: false,
        error: "",
        success: response,
      });
      setAssistedForm({
        name: "",
        age: "",
        gender: "",
        mobile: "",
        email: "",
        emergencyContact: "",
        address: "",
      });
    } catch (err) {
      setAssistedState({
        loading: false,
        error: err.message || "Unable to create assisted patient account.",
        success: null,
      });
    }
  };

  const handleQuickIntake = async (event) => {
    event.preventDefault();
    setQuickIntakeState({ loading: true, error: "", success: "" });

    try {
      const { createQuickIntake } = await import("../../lib/api");
      const response = await createQuickIntake({
        name: quickIntakeForm.name,
        age: Number(quickIntakeForm.age) || 0,
        gender: quickIntakeForm.gender,
        mobile: normalizeMobile(quickIntakeForm.mobile) || null,
        department_id: Number(quickIntakeForm.departmentId),
        symptoms: quickIntakeForm.symptoms || "Quick intake by reception",
        created_by_name: user?.name || "Front Desk",
      });

      setQuickIntakeState({
        loading: false,
        error: "",
        success: `Patient added with token #${response.case.currentVisit.token} in ${response.case.currentVisit.department}. Use Open Case only if profile or clinical details need follow-up.`,
      });
      setQuickIntakeForm({
        name: "",
        age: "",
        gender: "",
        mobile: "",
        departmentId: "",
        symptoms: "",
      });
      await loadReceptionData();
      setActiveOverlay("");
    } catch (err) {
      setQuickIntakeState({
        loading: false,
        error: err.message || "Unable to complete quick intake.",
        success: "",
      });
    }
  };

  if (screenState === "loading") {
    return <PageShell name={user?.name || "Receptionist"} clock={clock}><StateCard title="Loading receptionist console" description="Fetching department queues, current tokens, and lookup data." /></PageShell>;
  }

  if (screenState === "error") {
    return <PageShell name={user?.name || "Receptionist"} clock={clock}><StateCard title="Unable to load receptionist console" description={loadError} actionLabel="Try Again" onAction={loadReceptionData} /></PageShell>;
  }

  if (screenState === "empty") {
    return <PageShell name={user?.name || "Receptionist"} clock={clock}><StateCard title="No active queue yet" description="New bookings will appear here once OPD registrations begin." actionLabel="Refresh" onAction={loadReceptionData} /></PageShell>;
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.pageBg }}>
      <TricolorStrip />
      <GovHeader name={user?.name || "Receptionist"} clock={clock} designation={user?.designation} />

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 12px 24px", display: "grid", gap: 12 }}>
        <section style={{ background: COLORS.navy, color: "#fff", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: COLORS.skyText, fontSize: 12 }}>Receptionist Console</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{user?.name || "Receptionist"}</div>
              <div style={{ color: COLORS.skyText, fontSize: 12 }}>Search patients, answer wait questions, and manage the lobby view.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(90px, 1fr))", gap: 8, minWidth: 360 }}>
              <MiniStat title="Waiting" value={receptionistStats.waiting} />
              <MiniStat title="In Room" value={receptionistStats.inConsult} />
              <MiniStat title="Avg Wait" value={`${receptionistStats.avgWait}m`} />
              <MiniStat title="Visible" value={receptionistStats.patientsVisible} />
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(320px, 1fr))", gap: 12 }}>
          <section style={{ background: "#fff", border: "1px solid #CBD5E1", borderRadius: 12, padding: 14, minHeight: 220, display: "flex", flexDirection: "column" }}>
            <SectionTitle title="Patient Lookup" subtitle="Search by token, patient name, or mobile number" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => (event.key === "Enter" ? runLookup() : null)}
                placeholder="e.g. 12, Ram, 9876543210"
                style={{ flex: 1, minWidth: 260, border: "1px solid #CBD5E1", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none" }}
              />
              <button type="button" onClick={runLookup} style={btnPrimary}>Search</button>
            </div>

            <div style={{ marginTop: 12 }}>
              {lookupMatches.length > 1 ? (
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>
                  {lookupMatches.length} matches found. Showing top-ranked patient.
                </div>
              ) : null}
              {lookupResult ? (
                <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, background: "#F8FAFC", padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>{lookupResult.name}</div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>{lookupResult.tokenLabel || `Token #${lookupResult.token}`} | Patient ID {lookupResult.patientId}</div>
                    </div>
                    <PriorityPill priority={lookupResult.priority} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(160px, 1fr))", gap: 8, marginTop: 10 }}>
                    <InfoBox label="Department" value={lookupResult.department} />
                    <InfoBox label="Status" value={lookupResult.status} />
                    <InfoBox label="Patients Ahead" value={lookupResult.peopleAhead} />
                    <InfoBox label="Estimated Wait" value={`${lookupResult.waitMins} min`} />
                    <InfoBox label="Mobile" value={formatIndianMobile(lookupResult.mobile)} />
                    <InfoBox label="Preferred Slot" value={lookupResult.preferredSlot} />
                  </div>
                  <div style={{ marginTop: 10, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                    Front desk answer: {lookupResult.tokenLabel || `Token #${lookupResult.token}`} in {lookupResult.department} currently has about {lookupResult.waitMins} minute(s) to go.
                  </div>
                  {lookupResult.rawStatus === "waiting" ? (
                    <div style={{ marginTop: 10 }}>
                      <button type="button" onClick={() => callNextForDepartment(lookupResult.departmentId)} style={btnPrimary}>
                        Call Next For {lookupResult.department}
                      </button>
                    </div>
                  ) : null}
                  {lookupResult.queueId ? (
                    <div style={{ marginTop: 10 }}>
                      <button type="button" onClick={() => navigate(`/case/queue/${lookupResult.queueId}`)} style={btnGhost}>
                        Open Patient Case
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <InlineEmpty title="No patient selected" description="Use token, name, or mobile to answer lobby questions quickly." />
                </div>
              )}
            </div>
          </section>

          <section style={{ background: "#fff", border: "1px solid #CBD5E1", borderRadius: 12, padding: 14, minHeight: 220, display: "flex", flexDirection: "column" }}>
            <SectionTitle title="Desk Summary" subtitle="Live front-desk operational snapshot" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(120px, 1fr))", gap: 8, marginTop: 4 }}>
              <InfoBox label="Visible Queue" value={receptionistStats.patientsVisible} />
              <InfoBox label="Waiting" value={receptionistStats.waiting} />
              <InfoBox label="In Consultation" value={receptionistStats.inConsult} />
              <InfoBox label="Avg Wait" value={`${receptionistStats.avgWait} min`} />
            </div>
          </section>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(320px, 1fr))", gap: 12 }}>
          <ActionCard
            title="Quick Intake"
            subtitle="Rush-case path: add the patient to the queue first and complete full registration later"
            onOpen={() => setActiveOverlay("quick-intake")}
          />

          <ActionCard
            title="Staff-Assisted Patient Account"
            subtitle="Use this for walk-ins, patients without phones, or patients who need help at the front desk"
            onOpen={() => setActiveOverlay("assisted-account")}
          />
        </section>

        <section style={{ background: "#fff", border: "1px solid #CBD5E1", borderRadius: 12, padding: 14 }}>
          <SectionTitle title="Department Queue Board" subtitle="Color-coded view for quick lobby explanations" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {departments.map((department) => (
              <DepartmentCard key={department.department_id} department={department} active={activeDepartment === department.name} onSelect={() => setActiveDepartment((current) => current === department.name ? "All" : department.name)} onCallNext={() => callNextForDepartment(department.department_id)} />
            ))}
          </div>
        </section>

        <section style={{ background: "#fff", border: "1px solid #CBD5E1", borderRadius: 12, padding: 14 }}>
          <SectionTitle title="Live Queue Table" subtitle={activeDepartment === "All" ? "Current visible queue for receptionist assistance" : `${activeDepartment} department queue`} />
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setActiveDepartment("All")} style={{ ...chipStyle, ...(activeDepartment === "All" ? activeChipStyle : {}) }}>All Departments</button>
            {departments.map((department) => (
              <button key={department.department_id} type="button" onClick={() => setActiveDepartment(department.name)} style={{ ...chipStyle, ...(activeDepartment === department.name ? activeChipStyle : {}) }}>
                {department.name}
              </button>
            ))}
          </div>
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1.5fr 1.1fr 1fr 1fr 1fr 1.4fr", padding: "10px 12px", fontSize: 12, fontWeight: 800, color: "#64748B", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <div>TOKEN</div>
              <div>PATIENT</div>
              <div>MOBILE</div>
              <div>DEPARTMENT</div>
              <div>STATUS</div>
              <div>AHEAD</div>
              <div>WAIT / ACTION</div>
            </div>
            {visibleQueueRows.map((row) => (
              <QueueRow key={row.id} row={row} urgentForm={urgentForm} setUrgentForm={setUrgentForm} onUrgentReview={submitUrgentReview} onCallNext={callNextForDepartment} onOpenCase={(queueId) => navigate(`/case/queue/${queueId}`)} />
            ))}
          </div>
        </section>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={loadReceptionData} style={btnPrimary}>Refresh</button>
          <button type="button" onClick={onLogout} style={btnGhost}>Sign Out</button>
        </div>
      </main>

      {activeOverlay === "quick-intake" ? (
        <OverlayModal title="Quick Intake" subtitle="Add the patient to the queue first and complete full registration later" onClose={() => setActiveOverlay("")}>
          {quickIntakeState.error ? <Notice tone="warn" text={quickIntakeState.error} /> : null}
          {quickIntakeState.success ? <Notice tone="info" text={quickIntakeState.success} /> : null}
          <form onSubmit={handleQuickIntake}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 10 }}>
              <Field label="Patient Name *">
                <input value={quickIntakeForm.name} onChange={(event) => setQuickIntakeField("name", event.target.value)} style={inputStyle} />
              </Field>
              <Field label="Age">
                <input value={quickIntakeForm.age} onChange={(event) => setQuickIntakeField("age", event.target.value.replace(/\D/g, "").slice(0, 3))} style={inputStyle} />
              </Field>
              <Field label="Gender">
                <select value={quickIntakeForm.gender} onChange={(event) => setQuickIntakeField("gender", event.target.value)} style={inputStyle}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Mobile (optional)">
                <input value={quickIntakeForm.mobile} onChange={(event) => setQuickIntakeField("mobile", normalizeMobile(event.target.value))} style={inputStyle} />
              </Field>
                <Field label="Department *">
                  <select value={quickIntakeForm.departmentId} onChange={(event) => setQuickIntakeField("departmentId", event.target.value)} style={inputStyle}>
                    <option value="">Select Department</option>
                    {departments.map((department) => <option key={department.department_id} value={department.department_id}>{department.name}</option>)}
                  </select>
                </Field>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Symptoms / Quick Note">
                    <input value={quickIntakeForm.symptoms} onChange={(event) => setQuickIntakeField("symptoms", event.target.value)} placeholder="Short symptom note for immediate triage" style={inputStyle} />
                  </Field>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <Notice tone="neutral" text="Quick Intake is treated as an expedited manual intake. Nurse triage can refine urgency after assessment." />
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="submit" disabled={quickIntakeState.loading} style={{ ...btnPrimary, opacity: quickIntakeState.loading ? 0.7 : 1, cursor: quickIntakeState.loading ? "not-allowed" : "pointer" }}>
                  {quickIntakeState.loading ? "Creating..." : "Quick Intake"}
                </button>
              </div>
            </form>
        </OverlayModal>
      ) : null}

      {activeOverlay === "assisted-account" ? (
        <OverlayModal title="Staff-Assisted Patient Account" subtitle="Create an account for walk-ins or patients who need help at the front desk" onClose={() => setActiveOverlay("")}>
          {assistedState.error ? <Notice tone="warn" text={assistedState.error} /> : null}
          {assistedState.success ? (
            <Notice
              tone="info"
              text={`Created patient ID ${assistedState.success.patient.patient_id} with assisted reference ${assistedState.success.account.assistedReference}. If the patient has no phone, use this reference at the desk.`}
            />
          ) : null}
          <form onSubmit={handleAssistedCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 10 }}>
              <Field label="Full Name *">
                <input value={assistedForm.name} onChange={(event) => setAssistedField("name", event.target.value)} style={inputStyle} />
              </Field>
              <Field label="Age *">
                <input value={assistedForm.age} onChange={(event) => setAssistedField("age", event.target.value.replace(/\D/g, "").slice(0, 3))} style={inputStyle} />
              </Field>
              <Field label="Gender *">
                <select value={assistedForm.gender} onChange={(event) => setAssistedField("gender", event.target.value)} style={inputStyle}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Mobile (optional)">
                <input value={assistedForm.mobile} onChange={(event) => setAssistedField("mobile", normalizeMobile(event.target.value))} placeholder="If patient has a number" style={inputStyle} />
              </Field>
              <Field label="Email (optional)">
                <input value={assistedForm.email} onChange={(event) => setAssistedField("email", event.target.value)} style={inputStyle} />
              </Field>
              <Field label="Emergency Contact">
                <input value={assistedForm.emergencyContact} onChange={(event) => setAssistedField("emergencyContact", normalizeMobile(event.target.value))} style={inputStyle} />
              </Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Address">
                  <textarea value={assistedForm.address} onChange={(event) => setAssistedField("address", event.target.value)} style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} />
                </Field>
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button type="submit" disabled={assistedState.loading} style={{ ...btnPrimary, opacity: assistedState.loading ? 0.7 : 1, cursor: assistedState.loading ? "not-allowed" : "pointer" }}>
                {assistedState.loading ? "Creating..." : "Create Assisted Account"}
              </button>
              </div>
            </form>
        </OverlayModal>
      ) : null}

      <GovFooter />
    </div>
  );
}

function PageShell({ name, clock, children }) {
  return <div style={{ minHeight: "100vh", background: COLORS.pageBg }}><TricolorStrip /><GovHeader name={name} clock={clock} /><main style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 12px 24px" }}>{children}</main><GovFooter /></div>;
}

function StateCard({ title, description, actionLabel, onAction }) {
  return <section style={{ border: "1px solid #CBD5E1", borderRadius: 12, background: "#fff", padding: 24, textAlign: "center" }}><div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E2E8F0", margin: "0 auto 12px" }} /><h2 style={{ margin: 0, fontSize: 22, color: "#0F172A" }}>{title}</h2><p style={{ margin: "8px 0 0", color: "#64748B", lineHeight: 1.6 }}>{description}</p>{actionLabel ? <button type="button" onClick={onAction} style={{ marginTop: 16, border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>{actionLabel}</button> : null}</section>;
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{title}</div>
      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

function ActionCard({ title, subtitle, onOpen }) {
  return (
    <section style={{ background: "#FDFEFF", border: "1px solid #CBD5E1", borderRadius: 14, padding: "18px 18px", minHeight: 104, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div style={{ flex: "1 1 auto", minWidth: 0, maxWidth: "calc(100% - 72px)" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", lineHeight: 1.25 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#64748B", marginTop: 6, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{subtitle}</div>
      </div>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button type="button" onClick={onOpen} aria-label={`Open ${title}`} title={`Open ${title}`} style={{ width: 42, height: 42, borderRadius: 999, border: "none", background: COLORS.navy, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, boxShadow: "0 8px 18px rgba(0,53,128,0.18)" }}>
          <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, marginTop: -2 }}>+</span>
        </button>
      </div>
    </section>
  );
}

function OverlayModal({ title, subtitle, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 9999 }}>
      <div style={{ width: "min(760px, 100%)", background: "#fff", borderRadius: 16, border: "1px solid #CBD5E1", boxShadow: "0 20px 60px rgba(15,23,42,0.22)", overflow: "hidden" }}>
        <div style={{ background: COLORS.navy, color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 12, color: COLORS.skyText, marginTop: 2 }}>{subtitle}</div>
          </div>
          <button type="button" onClick={onClose} style={{ border: "1px solid rgba(255,255,255,0.25)", background: "transparent", color: "#fff", borderRadius: 8, padding: "8px 10px", fontWeight: 700, cursor: "pointer" }}>
            Close
          </button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

function Notice({ tone, text }) {
  const palette =
    tone === "warn"
      ? { border: "#FCD34D", background: "#FFFBEB", text: "#92400E" }
      : tone === "info"
        ? { border: "#BFDBFE", background: "#EFF6FF", text: "#1D4ED8" }
        : { border: "#CBD5E1", background: "#F8FAFC", text: "#334155" };

  return (
    <div style={{ border: `1px solid ${palette.border}`, background: palette.background, color: palette.text, borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
      {text}
    </div>
  );
}

function DepartmentCard({ department, active, onSelect, onCallNext }) {
  return (
      <section
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        style={{ border: `1px solid ${department.color.accent}`, background: department.color.soft, borderRadius: 12, padding: 12, textAlign: "left", cursor: "pointer", boxShadow: active ? `0 0 0 2px ${department.color.accent}55` : "none", minHeight: 210, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
      >
        <div style={{ minHeight: 66, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <div style={{ fontWeight: 800, color: department.color.accent, fontSize: 13, lineHeight: 1.3, maxWidth: "62%" }}>{department.name}</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#334155", minWidth: 54, textAlign: "right", lineHeight: 1.3 }}>Now {department.nowServing}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(80px, 1fr))", gap: 8 }}>
          <InfoBox label="Waiting" value={department.waiting} />
          <InfoBox label="Avg Wait" value={`${department.etaForNewToken} min`} />
          </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" onClick={(event) => { event.stopPropagation(); onCallNext(); }} style={{ ...btnPrimary, padding: "8px 10px", fontSize: 12, width: "100%", opacity: department.waiting ? 1 : 0.65, cursor: department.waiting ? "pointer" : "not-allowed" }} disabled={!department.waiting}>
            Call Next
          </button>
        </div>
      </section>
  );
}

function QueueRow({ row, urgentForm, setUrgentForm, onUrgentReview, onCallNext, onOpenCase }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "80px 1.5fr 1.1fr 1fr 1fr 1fr 1.4fr", padding: "10px 12px", fontSize: 12, color: "#334155", borderBottom: "1px solid #E2E8F0", alignItems: "center" }}>
      <div style={{ fontFamily: "monospace", fontWeight: 800 }}>#{row.token}</div>
      <div>
        <div style={{ fontWeight: 700 }}>{row.name}</div>
        <div style={{ fontSize: 11, color: "#64748B" }}>ID {row.patientId}</div>
      </div>
      <div>{formatIndianMobile(row.mobile)}</div>
      <div>{row.department}</div>
      <div>{row.status}</div>
        <div>{row.peopleAhead}</div>
        <div>
          <div>{row.waitMins} min</div>
          <div style={{ marginTop: 6, display: "grid", gap: 6, justifyItems: "start" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {row.rawStatus === "waiting" ? (
                <button type="button" onClick={() => onCallNext(row.departmentId)} style={{ ...btnPrimary, padding: "6px 10px", fontSize: 12 }}>
                  Call Next
                </button>
              ) : null}
              <button type="button" onClick={() => onOpenCase(row.queueId)} style={{ ...btnGhost, padding: "6px 10px", fontSize: 12 }}>
                Open Case
              </button>
            </div>
            {row.urgentReviewRequested ? (
              <div style={{ color: "#B45309", fontWeight: 700 }}>Urgent review flagged</div>
            ) : (
              <div>
              {urgentForm.queueId === row.queueId ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <input
                  value={urgentForm.reason}
                  onChange={(event) => setUrgentForm({ queueId: row.queueId, reason: event.target.value })}
                  placeholder="Reason for urgent review"
                  style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }}
                />
                <button type="button" onClick={() => onUrgentReview(row.queueId)} style={{ ...btnPrimary, padding: "6px 9px", fontSize: 12 }}>
                  Flag Review
                </button>
                </div>
              ) : (
                <button type="button" onClick={() => setUrgentForm({ queueId: row.queueId, reason: "" })} style={{ ...btnGhost, padding: "6px 10px", fontSize: 12 }}>
                  Flag Urgent Review
                </button>
              )}
              </div>
            )}
          </div>
          {row.urgentReviewReason ? <div style={{ marginTop: 4, color: "#64748B" }}>{row.urgentReviewReason}</div> : null}
        </div>
      </div>
  );
}

function InfoBox({ label, value }) {
  return <div style={{ border: "1px solid rgba(148,163,184,0.35)", borderRadius: 8, background: "#fff", padding: "8px 10px" }}><div style={{ fontSize: 11, color: "#64748B" }}>{label}</div><div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{value}</div></div>;
}

function InlineEmpty({ title, description }) {
  return <div style={{ padding: 18, textAlign: "center", color: "#64748B", width: "100%" }}><div style={{ color: "#0F172A", fontWeight: 800 }}>{title}</div><div style={{ marginTop: 6, fontSize: 13 }}>{description}</div></div>;
}

function PriorityPill({ priority }) {
  const tone = priority === "critical"
    ? { bg: "#FEE2E2", color: "#B91C1C", label: "Critical" }
    : priority === "high"
      ? { bg: "#FEF3C7", color: "#B45309", label: "High" }
      : { bg: "#DCFCE7", color: "#166534", label: "Normal" };
  return <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: "4px 9px", fontSize: 12, fontWeight: 700 }}>{tone.label}</span>;
}

function MiniStat({ title, value }) {
  return <div style={{ border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "8px 9px" }}><div style={{ fontSize: 11, color: COLORS.saffron }}>{title}</div><div style={{ fontSize: 15, fontWeight: 900, color: COLORS.skyText, marginTop: 2 }}>{value}</div></div>;
}

const btnPrimary = { border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", fontWeight: 700, padding: "10px 14px", cursor: "pointer" };
const btnGhost = { border: "1px solid #CBD5E1", borderRadius: 8, background: "#fff", color: "#334155", fontWeight: 700, padding: "10px 14px", cursor: "pointer" };
const inputStyle = { width: "100%", border: "1px solid #CBD5E1", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" };
const chipStyle = { border: "1px solid #CBD5E1", borderRadius: 999, background: "#fff", color: "#334155", fontWeight: 700, padding: "6px 10px", cursor: "pointer", fontSize: 12 };
const activeChipStyle = { background: COLORS.navy, color: "#fff", border: `1px solid ${COLORS.navy}` };

function Field({ label, children }) {
  return <label style={{ display: "block" }}><span style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: "#334155" }}>{label}</span>{children}</label>;
}

function TricolorStrip() { return <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, background: COLORS.saffron }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: COLORS.green }} /></div>; }
function GovHeader({ name, clock, designation }) { return <header style={{ background: COLORS.navyDark, color: "#fff", padding: "10px 12px" }}><div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>SQ</div><div><div style={{ fontWeight: 800, fontSize: 18 }}>SwasthyaQueue</div><div style={{ color: COLORS.skyText, fontSize: 12 }}>{designation || "Receptionist Console"}</div></div></div><div style={{ fontSize: 12, color: COLORS.skyText, fontWeight: 700 }}>{name} | {clock}</div></div></header>; }
function GovFooter() { return <footer style={{ background: COLORS.navyDark, color: COLORS.skyText, fontSize: 12, padding: "10px 12px" }}><div style={{ maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>Copyright 2026 SwasthyaQueue | Government Hospital OPD Digital Queue System</div></footer>; }
