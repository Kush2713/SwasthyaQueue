import { useEffect, useState } from "react";

const COLORS = {
  navyDark: "#002060",
  navy: "#003580",
  saffron: "#FF9933",
  green: "#138808",
  pageBg: "#EEF2F7",
  skyText: "#A8C8FF",
};

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPriority(priorityLevel) {
  if (priorityLevel === 1) return "Critical";
  if (priorityLevel === 2) return "High";
  return "Normal";
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function buildProfileDraft(patient) {
  return {
    name: patient.name || "",
    age: patient.age ?? "",
    gender: patient.gender || "",
    mobile: patient.phone || "",
    email: patient.email || "",
    address: patient.address || "",
    emergencyContact: patient.emergencyContact || "",
    bloodGroup: patient.bloodGroup || "",
    allergies: patient.allergies || "",
    chronicConditions: patient.chronicConditions || "",
  };
}

function buildTriageDraft(currentVisit) {
  return {
    temperature_c: currentVisit.triage.temperatureC ?? "",
    blood_pressure: currentVisit.triage.bloodPressure || "",
    pulse_rate: currentVisit.triage.pulseRate ?? "",
    spo2: currentVisit.triage.spo2 ?? "",
    weight_kg: currentVisit.triage.weightKg ?? "",
    triage_notes: currentVisit.triage.notes || "",
  };
}

function buildDoctorDraft(currentVisit) {
  return {
    diagnosis: currentVisit.doctor?.diagnosis || "",
    prescription: currentVisit.doctor?.prescription || "",
    doctor_notes: currentVisit.doctor?.notes || "",
  };
}

export default function PatientCasePage({ queueId, user, onBack }) {
  const [screenState, setScreenState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [caseData, setCaseData] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [triageDraft, setTriageDraft] = useState(null);
  const [doctorDraft, setDoctorDraft] = useState(null);
  const [profileState, setProfileState] = useState({ saving: false, message: "", error: "" });
  const [triageState, setTriageState] = useState({ saving: false, message: "", error: "" });
  const [doctorState, setDoctorState] = useState({ saving: false, message: "", error: "" });

  const isReception = user?.role === "receptionist";
  const isNurse = user?.role === "nurse";
  const isDoctor = user?.role === "doctor" || user?.role === "staff";

  async function loadCase() {
    setScreenState("loading");
    setLoadError("");

    try {
      const { getCaseByQueueId } = await import("../../lib/api");
      const response = await getCaseByQueueId(queueId);
      setCaseData(response.case);
      setProfileDraft(buildProfileDraft(response.case.patient));
      setTriageDraft(buildTriageDraft(response.case.currentVisit));
      setDoctorDraft(buildDoctorDraft(response.case.currentVisit));
      setScreenState("ready");
    } catch (error) {
      setLoadError(error.message || "Unable to load patient case.");
      setScreenState("error");
    }
  }

  useEffect(() => {
    loadCase();
  }, [queueId]);

  async function handleProfileSave(event) {
    event.preventDefault();
    setProfileState({ saving: true, message: "", error: "" });

    try {
      const { updatePatientProfileById } = await import("../../lib/api");
      await updatePatientProfileById(caseData.patient.patientId, {
        ...profileDraft,
        age: Number(profileDraft.age) || 0,
        mobile: normalizePhone(profileDraft.mobile) || null,
        emergencyContact: normalizePhone(profileDraft.emergencyContact) || null,
      });
      setProfileState({ saving: false, message: "Patient profile saved.", error: "" });
      await loadCase();
    } catch (error) {
      setProfileState({ saving: false, message: "", error: error.message || "Unable to save profile." });
    }
  }

  async function handleTriageSave(event) {
    event.preventDefault();
    setTriageState({ saving: true, message: "", error: "" });

    try {
      const { recordNurseTriage } = await import("../../lib/api");
      await recordNurseTriage(caseData.currentVisit.queueId, {
        ...triageDraft,
        assessed_by_name: user?.name || "Triage Nurse",
      });
      setTriageState({ saving: false, message: "Triage assessment saved.", error: "" });
      await loadCase();
    } catch (error) {
      setTriageState({ saving: false, message: "", error: error.message || "Unable to save triage." });
    }
  }

  async function handleDoctorSave(event, completeVisit) {
    event.preventDefault();
    setDoctorState({ saving: true, message: "", error: "" });

    try {
      const { saveDoctorUpdate } = await import("../../lib/api");
      await saveDoctorUpdate(caseData.currentVisit.appointmentId, {
        ...doctorDraft,
        consulted_by_name: user?.name || "Doctor",
        complete_visit: completeVisit,
      });
      setDoctorState({
        saving: false,
        message: completeVisit ? "Doctor notes saved and visit completed." : "Doctor notes saved.",
        error: "",
      });
      await loadCase();
    } catch (error) {
      setDoctorState({ saving: false, message: "", error: error.message || "Unable to save doctor notes." });
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.pageBg }}>
      <TricolorStrip />
      <GovHeader name={user?.name || "Clinical User"} subtitle={user?.designation || "Patient Case"} />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 12px 24px", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={onBack} style={btnGhost}>Back</button>
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
            {isReception ? "Reception: profile follow-up and case visibility" : isNurse ? "Nurse: vitals, triage, and escalation support" : "Doctor: diagnosis, prescription, and visit completion"}
          </div>
        </div>

        {screenState === "loading" ? <StateCard title="Loading patient case" description="Fetching profile, current visit, and visit history." /> : null}
        {screenState === "error" ? <StateCard title="Unable to load patient case" description={loadError} actionLabel="Go Back" onAction={onBack} /> : null}

        {screenState === "ready" && caseData ? (
          <>
            <section style={{ background: COLORS.navy, color: "#fff", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <div style={{ color: COLORS.skyText, fontSize: 12 }}>Patient Case</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{caseData.patient.name}</div>
                  <div style={{ color: COLORS.skyText, fontSize: 12 }}>
                    Patient ID {caseData.patient.patientId} | Token #{caseData.currentVisit.token} | {caseData.currentVisit.department}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(100px, 1fr))", gap: 8, minWidth: 320 }}>
                  <MiniStat title="Queue Status" value={caseData.currentVisit.queueStatus || "-"} />
                  <MiniStat title="Priority" value={formatPriority(caseData.currentVisit.priorityLevel)} />
                  <MiniStat title="Pain Scale" value={String(caseData.currentVisit.painScale ?? 0)} />
                </div>
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 12 }}>
              <Card title="Patient Profile">
                {isReception ? (
                  <form onSubmit={handleProfileSave} style={{ display: "grid", gap: 10 }}>
                    {profileState.error ? <Notice tone="warn" text={profileState.error} /> : null}
                    {profileState.message ? <Notice tone="info" text={profileState.message} /> : null}
                    <FormGrid>
                      <Field label="Full Name">
                        <input value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} style={fieldInput} />
                      </Field>
                      <Field label="Age">
                        <input value={profileDraft.age} onChange={(event) => setProfileDraft((current) => ({ ...current, age: event.target.value }))} style={fieldInput} />
                      </Field>
                      <Field label="Gender">
                        <input value={profileDraft.gender} onChange={(event) => setProfileDraft((current) => ({ ...current, gender: event.target.value }))} style={fieldInput} />
                      </Field>
                      <Field label="Phone">
                        <input value={profileDraft.mobile} onChange={(event) => setProfileDraft((current) => ({ ...current, mobile: event.target.value }))} style={fieldInput} />
                      </Field>
                      <Field label="Email">
                        <input value={profileDraft.email} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} style={fieldInput} />
                      </Field>
                      <Field label="Emergency Contact">
                        <input value={profileDraft.emergencyContact} onChange={(event) => setProfileDraft((current) => ({ ...current, emergencyContact: event.target.value }))} style={fieldInput} />
                      </Field>
                      <Field label="Blood Group">
                        <input value={profileDraft.bloodGroup} onChange={(event) => setProfileDraft((current) => ({ ...current, bloodGroup: event.target.value }))} style={fieldInput} />
                      </Field>
                      <Field label="Address">
                        <input value={profileDraft.address} onChange={(event) => setProfileDraft((current) => ({ ...current, address: event.target.value }))} style={fieldInput} />
                      </Field>
                    </FormGrid>
                    <Field label="Allergies">
                      <textarea value={profileDraft.allergies} onChange={(event) => setProfileDraft((current) => ({ ...current, allergies: event.target.value }))} style={{ ...fieldInput, minHeight: 72, resize: "vertical" }} />
                    </Field>
                    <Field label="Chronic Conditions">
                      <textarea value={profileDraft.chronicConditions} onChange={(event) => setProfileDraft((current) => ({ ...current, chronicConditions: event.target.value }))} style={{ ...fieldInput, minHeight: 72, resize: "vertical" }} />
                    </Field>
                    <div>
                      <button type="submit" disabled={profileState.saving} style={{ ...btnPrimary, opacity: profileState.saving ? 0.7 : 1 }}>
                        {profileState.saving ? "Saving..." : "Save Profile"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <DetailGrid
                    items={[
                      ["Age", caseData.patient.age ?? "-"],
                      ["Gender", caseData.patient.gender || "-"],
                      ["Phone", caseData.patient.phone || "-"],
                      ["Email", caseData.patient.email || "-"],
                      ["Blood Group", caseData.patient.bloodGroup || "-"],
                      ["Emergency Contact", caseData.patient.emergencyContact || "-"],
                      ["Address", caseData.patient.address || "-"],
                      ["Allergies", caseData.patient.allergies || "-"],
                      ["Chronic Conditions", caseData.patient.chronicConditions || "-"],
                    ]}
                  />
                )}
              </Card>

              <Card title="Current Visit">
                <DetailGrid
                  items={[
                    ["Symptoms", caseData.currentVisit.symptoms || "-"],
                    ["Preferred Slot", formatDateTime(caseData.currentVisit.preferredSlot)],
                    ["Queued At", formatDateTime(caseData.currentVisit.queuedAt)],
                    ["Urgent Review", caseData.currentVisit.urgentReviewRequested ? caseData.currentVisit.urgentReviewReason || "Flagged" : "No"],
                    ["Escalation", caseData.currentVisit.escalatedByName ? `${caseData.currentVisit.escalatedByName} | ${caseData.currentVisit.escalationNote || "Priority updated"}` : "-"],
                  ]}
                />
              </Card>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Card title="Nurse Triage">
                {isNurse ? (
                  <form onSubmit={handleTriageSave} style={{ display: "grid", gap: 10 }}>
                    {triageState.error ? <Notice tone="warn" text={triageState.error} /> : null}
                    {triageState.message ? <Notice tone="info" text={triageState.message} /> : null}
                    <FormGrid>
                      <Field label="Temperature (C)">
                        <input value={triageDraft.temperature_c} onChange={(event) => setTriageDraft((current) => ({ ...current, temperature_c: event.target.value }))} style={fieldInput} />
                      </Field>
                      <Field label="Blood Pressure">
                        <input value={triageDraft.blood_pressure} onChange={(event) => setTriageDraft((current) => ({ ...current, blood_pressure: event.target.value }))} style={fieldInput} />
                      </Field>
                      <Field label="Pulse">
                        <input value={triageDraft.pulse_rate} onChange={(event) => setTriageDraft((current) => ({ ...current, pulse_rate: event.target.value }))} style={fieldInput} />
                      </Field>
                      <Field label="SpO2">
                        <input value={triageDraft.spo2} onChange={(event) => setTriageDraft((current) => ({ ...current, spo2: event.target.value }))} style={fieldInput} />
                      </Field>
                      <Field label="Weight (kg)">
                        <input value={triageDraft.weight_kg} onChange={(event) => setTriageDraft((current) => ({ ...current, weight_kg: event.target.value }))} style={fieldInput} />
                      </Field>
                    </FormGrid>
                    <Field label="Triage Notes">
                      <textarea value={triageDraft.triage_notes} onChange={(event) => setTriageDraft((current) => ({ ...current, triage_notes: event.target.value }))} style={{ ...fieldInput, minHeight: 96, resize: "vertical" }} />
                    </Field>
                    <div>
                      <button type="submit" disabled={triageState.saving} style={{ ...btnPrimary, opacity: triageState.saving ? 0.7 : 1 }}>
                        {triageState.saving ? "Saving..." : "Save Triage"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <DetailGrid
                    items={[
                      ["Temperature", caseData.currentVisit.triage.temperatureC ? `${caseData.currentVisit.triage.temperatureC} C` : "-"],
                      ["Blood Pressure", caseData.currentVisit.triage.bloodPressure || "-"],
                      ["Pulse", caseData.currentVisit.triage.pulseRate || "-"],
                      ["SpO2", caseData.currentVisit.triage.spo2 || "-"],
                      ["Weight", caseData.currentVisit.triage.weightKg ? `${caseData.currentVisit.triage.weightKg} kg` : "-"],
                      ["Assessed By", caseData.currentVisit.triage.assessedByName || "-"],
                      ["Assessed At", formatDateTime(caseData.currentVisit.triage.assessedAt)],
                      ["Triage Notes", caseData.currentVisit.triage.notes || "-"],
                    ]}
                  />
                )}
              </Card>

              <Card title="Doctor Notes">
                {isDoctor ? (
                  <form onSubmit={(event) => handleDoctorSave(event, false)} style={{ display: "grid", gap: 10 }}>
                    {doctorState.error ? <Notice tone="warn" text={doctorState.error} /> : null}
                    {doctorState.message ? <Notice tone="info" text={doctorState.message} /> : null}
                    <Field label="Diagnosis">
                      <textarea value={doctorDraft.diagnosis} onChange={(event) => setDoctorDraft((current) => ({ ...current, diagnosis: event.target.value }))} style={{ ...fieldInput, minHeight: 80, resize: "vertical" }} />
                    </Field>
                    <Field label="Prescription / Advice">
                      <textarea value={doctorDraft.prescription} onChange={(event) => setDoctorDraft((current) => ({ ...current, prescription: event.target.value }))} style={{ ...fieldInput, minHeight: 80, resize: "vertical" }} />
                    </Field>
                    <Field label="Doctor Notes">
                      <textarea value={doctorDraft.doctor_notes} onChange={(event) => setDoctorDraft((current) => ({ ...current, doctor_notes: event.target.value }))} style={{ ...fieldInput, minHeight: 96, resize: "vertical" }} />
                    </Field>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="submit" disabled={doctorState.saving} style={{ ...btnPrimary, opacity: doctorState.saving ? 0.7 : 1 }}>
                        {doctorState.saving ? "Saving..." : "Save Doctor Notes"}
                      </button>
                      <button type="button" onClick={(event) => handleDoctorSave(event, true)} disabled={doctorState.saving} style={{ ...btnGhost, opacity: doctorState.saving ? 0.7 : 1 }}>
                        Complete Visit
                      </button>
                    </div>
                  </form>
                ) : (
                  <DetailGrid
                    items={[
                      ["Diagnosis", caseData.currentVisit.doctor?.diagnosis || "-"],
                      ["Prescription", caseData.currentVisit.doctor?.prescription || "-"],
                      ["Doctor Notes", caseData.currentVisit.doctor?.notes || "-"],
                      ["Consulted By", caseData.currentVisit.doctor?.consultedByName || "-"],
                      ["Consulted At", formatDateTime(caseData.currentVisit.doctor?.consultedAt)],
                    ]}
                  />
                )}
              </Card>
            </section>

            <Card title="Recent Visit History">
              <div style={{ display: "grid", gap: 8 }}>
                {caseData.visitHistory.length ? caseData.visitHistory.map((visit) => (
                  <div key={visit.appointmentId} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 10, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800 }}>
                        {visit.department} {visit.token ? `| Token #${visit.token}` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>{formatDateTime(visit.createdAt)}</div>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "#334155" }}>
                      Status: {visit.status || "-"} | Priority: {formatPriority(visit.priorityLevel)} | Symptoms: {visit.symptoms || "-"}
                    </div>
                    {visit.triage.notes ? <div style={{ marginTop: 4, fontSize: 13, color: "#475569" }}>Triage: {visit.triage.notes}</div> : null}
                    {visit.doctor?.diagnosis ? <div style={{ marginTop: 4, fontSize: 13, color: "#334155" }}>Diagnosis: {visit.doctor.diagnosis}</div> : null}
                  </div>
                )) : <InlineEmpty title="No visit history yet" description="Past visits will appear here as the patient continues using the system." />}
              </div>
            </Card>
          </>
        ) : null}
      </main>

      <GovFooter />
    </div>
  );
}

function DetailGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(150px, 1fr))", gap: 8 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ border: "1px solid #E2E8F0", borderRadius: 8, background: "#F8FAFC", padding: "8px 10px" }}>
          <div style={{ fontSize: 11, color: "#64748B" }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 2, whiteSpace: "pre-wrap" }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function FormGrid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 10 }}>{children}</div>;
}

function Field({ label, children }) {
  return <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "#334155" }}><span>{label}</span>{children}</label>;
}

function StateCard({ title, description, actionLabel, onAction }) {
  return <section style={{ border: "1px solid #CBD5E1", borderRadius: 12, background: "#fff", padding: 24, textAlign: "center" }}><div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E2E8F0", margin: "0 auto 12px" }} /><h2 style={{ margin: 0, fontSize: 22, color: "#0F172A" }}>{title}</h2><p style={{ margin: "8px 0 0", color: "#64748B", lineHeight: 1.6 }}>{description}</p>{actionLabel ? <button type="button" onClick={onAction} style={{ marginTop: 16, border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>{actionLabel}</button> : null}</section>;
}

function Notice({ text, tone = "neutral" }) {
  const palette =
    tone === "warn"
      ? { border: "#FCD34D", background: "#FFFBEB", text: "#92400E" }
      : tone === "info"
        ? { border: "#BFDBFE", background: "#EFF6FF", text: "#1D4ED8" }
        : { border: "#CBD5E1", background: "#F8FAFC", text: "#334155" };
  return <div style={{ border: `1px solid ${palette.border}`, background: palette.background, color: palette.text, borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.6 }}>{text}</div>;
}

function InlineEmpty({ title, description }) {
  return <div style={{ padding: 18, textAlign: "center", color: "#64748B" }}><div style={{ color: "#0F172A", fontWeight: 800 }}>{title}</div><div style={{ marginTop: 6, fontSize: 13 }}>{description}</div></div>;
}

function Card({ title, children }) {
  return <section style={{ border: "1px solid #CBD5E1", borderRadius: 12, background: "#fff", padding: 14 }}><div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginBottom: 10 }}>{title}</div>{children}</section>;
}

function MiniStat({ title, value }) {
  return <div style={{ border: "1px solid rgba(255,255,255,.25)", borderRadius: 8, padding: "8px 9px" }}><div style={{ fontSize: 11, color: COLORS.saffron }}>{title}</div><div style={{ fontSize: 15, fontWeight: 900, color: COLORS.skyText, marginTop: 2 }}>{value}</div></div>;
}

const btnGhost = { border: "1px solid #CBD5E1", borderRadius: 8, background: "#fff", color: "#334155", fontWeight: 700, padding: "10px 14px", cursor: "pointer" };
const btnPrimary = { border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", fontWeight: 700, padding: "10px 14px", cursor: "pointer" };
const fieldInput = { border: "1px solid #CBD5E1", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };

function TricolorStrip() { return <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, background: COLORS.saffron }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: COLORS.green }} /></div>; }
function GovHeader({ name, subtitle }) { return <header style={{ background: COLORS.navyDark, color: "#fff", padding: "10px 12px" }}><div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>SQ</div><div><div style={{ fontWeight: 800, fontSize: 18 }}>SwasthyaQueue</div><div style={{ color: COLORS.skyText, fontSize: 12 }}>{subtitle}</div></div></div><div style={{ fontSize: 12, color: COLORS.skyText, fontWeight: 700 }}>{name}</div></div></header>; }
function GovFooter() { return <footer style={{ background: COLORS.navyDark, color: COLORS.skyText, fontSize: 12, padding: "10px 12px" }}><div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>Copyright 2026 SwasthyaQueue | Government Hospital OPD Digital Queue System</div></footer>; }
