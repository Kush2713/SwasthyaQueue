import { useMemo, useState } from "react";

const COLORS = {
  navyDark: "#002060",
  navy: "#003580",
  saffron: "#FF9933",
  green: "#138808",
  pageBg: "#EEF2F7",
  cardBg: "#FFFFFF",
  skyText: "#A8C8FF",
  inputBorder: "#CBD5E1",
  errorRed: "#DC2626",
};

const symptomDefs = [
  { key: "Chest Pain", score: 5, critical: true, department: "Cardiology" },
  { key: "Breathlessness", score: 6, critical: true, department: "General Medicine" },
  { key: "Heavy Bleeding", score: 6, critical: true, department: "General Surgery" },
  { key: "Unconsciousness", score: 7, critical: true, department: "General Medicine" },
  { key: "Severe Injury", score: 5, critical: true, department: "Orthopaedics" },
  { key: "Joint/Bone Pain", score: 3, critical: false, department: "Orthopaedics" },
  { key: "Pregnancy Issue", score: 4, critical: false, department: "Gynecology & Obstetrics" },
  { key: "Ear/Nose/Throat", score: 2, critical: false, department: "ENT" },
  { key: "Fever", score: 1, critical: false, department: "General Medicine" },
  { key: "Mild Cough", score: 1, critical: false, department: "General Medicine" },
  { key: "Headache", score: 2, critical: false, department: "General Medicine" },
  { key: "Skin Rash", score: 1, critical: false, department: "General Medicine" },
  { key: "Abdominal Pain", score: 2, critical: false, department: "General Surgery" },
  { key: "Eye Problem", score: 1, critical: false, department: "General Medicine" },
  { key: "Diabetes Check", score: 2, critical: false, department: "General Medicine" },
  { key: "Blood Pressure", score: 2, critical: false, department: "General Medicine" },
  { key: "Other", score: 1, critical: false, department: "General Medicine" },
];

const symptomMap = Object.fromEntries(symptomDefs.map((item) => [item.key, item]));
const departments = [
  "General Medicine",
  "Orthopaedics",
  "Gynecology & Obstetrics",
  "General Surgery",
  "Cardiology",
  "ENT",
];

const labelStyle = { fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6, display: "block" };
const inputStyle = {
  width: "100%",
  border: `1px solid ${COLORS.inputBorder}`,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

function normalizeIndianMobile(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) return digits.slice(-10);
  return digits.slice(0, 10);
}

function isValidIndianMobile(value = "") {
  return /^[6-9]\d{9}$/.test(normalizeIndianMobile(value));
}

function formatIndianMobile(value = "") {
  const normalized = normalizeIndianMobile(value);
  if (!normalized) return "+91";
  if (normalized.length <= 5) return `+91 ${normalized}`;
  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}

export default function PatientRegistration({ onBack, user, onRegistered }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    name: user?.name || "",
    mobile: "",
    age: "",
    gender: "",
    address: "",
    symptoms: [],
    otherSymptoms: "",
    painScale: 0,
    department: "Auto-detect from symptoms",
  });

  const risk = useMemo(
    () => computeRisk(form.symptoms, form.age, form.gender, Number(form.painScale)),
    [form.symptoms, form.age, form.gender, form.painScale]
  );

  const ageNum = Number(form.age);
  const ageNote =
    form.age === ""
      ? ""
      : ageNum >= 60
        ? "Senior citizen support will be arranged automatically if needed."
        : ageNum < 5
          ? "Child support will be arranged automatically if needed."
          : "";

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleSymptom = (key) =>
    setForm((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(key)
        ? prev.symptoms.filter((item) => item !== key)
        : [...prev.symptoms, key],
      otherSymptoms: key === "Other" && prev.symptoms.includes(key) ? "" : prev.otherSymptoms,
    }));

  const checkStep1 = () => {
    if (!form.name.trim()) return "Full name is required.";
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120) return "Please enter a valid age (0-120).";
    if (!form.gender) return "Please select gender.";
    if (!isValidIndianMobile(form.mobile)) return "Enter the correct mobile number.";
    return "";
  };

  const checkStep2 = () => {
    if (form.symptoms.length || form.otherSymptoms.trim()) return "";
    return "Please select at least 1 symptom or enter a short note.";
  };

  const next = () => {
    const message = step === 1 ? checkStep1() : checkStep2();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((current) => current + 1);
  };

  const confirm = async () => {
    setLoading(true);
    setError("");
    try {
      const { addToQueue, getDepartmentIdByName, getQueueByDepartment, getQueuePosition, registerPatient } = await import("../../lib/api");
      const department = form.department === "Auto-detect from symptoms" ? risk.suggestedDepartment : form.department;
      const departmentId = getDepartmentIdByName(department);
      const selectedSymptoms = form.symptoms.filter((item) => item !== "Other");
      const finalSymptoms = form.otherSymptoms.trim()
        ? [...selectedSymptoms, `Other: ${form.otherSymptoms.trim()}`]
        : selectedSymptoms;
      const symptomsText = finalSymptoms.join(", ") || "General checkup";

      const patientResponse = await registerPatient({
        name: form.name.trim(),
        age: Number(form.age),
        gender: form.gender,
        phone: normalizeIndianMobile(form.mobile),
      });

      const patientId = patientResponse?.patient?.patient_id;
      const queueResponse = await addToQueue({
        patient_id: patientId,
        department_id: departmentId,
        symptoms: symptomsText,
        pain_scale: Number(form.painScale),
        age: Number(form.age),
      });

      const [positionResponse, departmentQueue] = await Promise.all([
        getQueuePosition(patientId, departmentId),
        getQueueByDepartment(departmentId),
      ]);

      const queueItem = queueResponse?.queue;
      const currentPosition = positionResponse?.position || 1;
      const currentQueueItem = departmentQueue.find((item) => item.queue_id === queueItem.queue_id) || {};
      const registeredAt = queueItem?.created_at
        ? new Date(queueItem.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
        : new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

      const payload = {
        token: queueItem?.token_number,
        queueId: queueItem?.queue_id,
        patientId,
        departmentId,
        estimatedWait: currentQueueItem?.estimated_wait_time ?? Math.max((currentPosition - 1) * 10, 0),
        position: currentPosition,
        registeredAt,
        department,
        dept: department,
        priority: risk.priority,
        priorityLevel: queueItem?.priority_level,
        riskScore: risk.score,
        patientName: form.name,
        symptoms: finalSymptoms,
        painScale: Number(form.painScale),
        mobile: normalizeIndianMobile(form.mobile),
      };

      if (typeof onRegistered === "function") {
        setLoading(false);
        onRegistered(payload);
        return;
      }

      setSuccess(payload);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err.message || "Unable to register patient right now.");
    }
  };

  const reset = () => {
    setStep(1);
    setError("");
    setLoading(false);
    setSuccess(null);
    setForm({
      name: user?.name || "",
      mobile: "",
      age: "",
      gender: "",
      address: "",
      symptoms: [],
      otherSymptoms: "",
      painScale: 0,
      department: "Auto-detect from symptoms",
    });
  };

  const selectedSymptomsForReview = form.otherSymptoms.trim()
    ? [...form.symptoms.filter((item) => item !== "Other"), `Other: ${form.otherSymptoms.trim()}`]
    : form.symptoms.filter((item) => item !== "Other");

  return (
    <div style={{ minHeight: "100vh", background: COLORS.pageBg }}>
      <TricolorStrip />
      <GovHeader onBack={onBack} />
      <main style={{ maxWidth: 920, margin: "0 auto", padding: 14 }}>
        {!success ? (
          <>
            <StepBar step={step} />
            <FormCard title={`Step ${step} | ${step === 1 ? "Personal Details" : step === 2 ? "Symptoms" : "Review and Confirm"}`} subtitle="SwasthyaQueue Registration">
              {error ? <ErrorBanner message={error} /> : null}

              {step === 1 ? (
                <>
                  {ageNote ? <NoticeBox message={ageNote} /> : null}
                  <Row2Col>
                    <Field label="Full Name *"><Input value={form.name} onChange={(value) => setField("name", value)} placeholder="Enter full name" /></Field>
                    <Field label="Mobile Number *"><MobileInput value={form.mobile} onChange={(value) => setField("mobile", value)} /></Field>
                  </Row2Col>
                  <Row2Col>
                    <Field label="Age *"><Input value={form.age} onChange={(value) => setField("age", value.replace(/\D/g, "").slice(0, 3))} placeholder="0 to 120" /></Field>
                    <Field label="Gender *"><Select value={form.gender} onChange={(value) => setField("gender", value)} options={["", "Male", "Female", "Other"]} /></Field>
                  </Row2Col>
                  <Field label="Address / Village (optional)"><Input value={form.address} onChange={(value) => setField("address", value)} placeholder="Village / area / landmark" /></Field>
                  <NavRow><GhostBtn onClick={onBack} disabled={!onBack}>Back</GhostBtn><PrimaryBtn onClick={next}>Continue</PrimaryBtn></NavRow>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div style={{ border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155", borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13 }}>
                    Select the symptoms that best match the patient. Staff will review the details and guide the queue flow.
                  </div>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", marginBottom: 14 }}>
                    {symptomDefs.map((item) => {
                      const selected = form.symptoms.includes(item.key);
                      const stateStyle = selected ? { borderColor: COLORS.navy, background: "#EFF6FF", color: COLORS.navy } : {};

                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleSymptom(item.key)}
                          style={{
                            border: "1px solid #CBD5E1",
                            borderRadius: 10,
                            padding: 12,
                            textAlign: "left",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 700,
                            ...stateStyle,
                          }}
                        >
                          {item.key}
                        </button>
                      );
                    })}
                  </div>
                  {form.symptoms.includes("Other") ? <Field label="Other Symptoms / Details"><Input value={form.otherSymptoms} onChange={(value) => setField("otherSymptoms", value)} placeholder="Enter a short note for staff" /></Field> : null}
                  <Field label={`Pain Level: ${form.painScale}/10`}><input type="range" min={0} max={10} step={1} value={form.painScale} onChange={(event) => setField("painScale", Number(event.target.value))} style={{ width: "100%" }} /></Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", fontSize: 12, marginBottom: 12 }}><span style={{ color: "#64748B" }}>No pain (0)</span><span style={{ fontWeight: 700, color: form.painScale >= 7 ? "#DC2626" : form.painScale >= 5 ? "#D97706" : COLORS.navy }}>{risk.painSeverity}</span><span style={{ color: "#64748B", textAlign: "right" }}>Severe (10)</span></div>
                  <Field label="Department Preference"><Select value={form.department} onChange={(value) => setField("department", value)} options={["Auto-detect from symptoms", ...departments]} /></Field>
                  <NavRow><GhostBtn onClick={() => setStep(1)}>Back</GhostBtn><PrimaryBtn onClick={next}>Review</PrimaryBtn></NavRow>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <div style={{ border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden", background: "#F8FAFC", marginBottom: 12 }}>
                    <SummaryRow label="Full Name" value={form.name} />
                    <SummaryRow label="Age / Gender" value={`${form.age} / ${form.gender}`} />
                    <SummaryRow label="Mobile" value={formatIndianMobile(form.mobile)} />
                    <SummaryRow label="Department" value={form.department === "Auto-detect from symptoms" ? `Auto (${risk.suggestedDepartment})` : form.department} />
                    <SummaryRow label="Symptoms" value={selectedSymptomsForReview.join(", ") || "Not specified"} />
                    <SummaryRow label="Pain Level" value={`${form.painScale}/10`} noBorder />
                  </div>
                  <div style={{ border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155", borderRadius: 10, padding: 10, marginBottom: 10 }}>Your details will be reviewed by staff and the correct queue will be assigned.</div>
                  <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6 }}>By clicking Confirm and Register, you confirm all information is accurate. The triage score is AI-generated and must be verified by a nurse before any clinical decision is made.</p>
                  <NavRow><GhostBtn onClick={() => setStep(2)}>Edit</GhostBtn><PrimaryBtn onClick={confirm} disabled={loading}>{loading ? "Registering..." : "Confirm and Register"}</PrimaryBtn></NavRow>
                </>
              ) : null}
            </FormCard>
          </>
        ) : (
          <>
            <FormCard title="Registration Successful" subtitle="Token generated">
              <div style={{ border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ background: COLORS.navy, color: "#fff", padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{success.department}</strong><span style={{ background: COLORS.saffron, color: "#4A2500", borderRadius: 999, padding: "4px 10px", fontWeight: 800 }}>#{success.token}</span>
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{form.name}</div>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(120px,1fr))", marginTop: 12, marginBottom: 10 }}>
                    <InfoCell label="Estimated Wait" value={`${success.estimatedWait} min`} />
                    <InfoCell label="Position in Queue" value={success.position} />
                    <InfoCell label="Department" value={success.department} />
                    <InfoCell label="Registered At" value={success.registeredAt} />
                  </div>
                  <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10 }}>SMS alert will be sent to {formatIndianMobile(form.mobile)} when 3 patients are ahead.</div>
                  <NavRow><GhostBtn onClick={reset}>Register Another Patient</GhostBtn><PrimaryBtn onClick={() => window.print()}>Print Token</PrimaryBtn></NavRow>
                </div>
              </div>
            </FormCard>
            <div style={{ marginTop: 12, border: "1px solid #CBD5E1", borderRadius: 10, background: "#fff", padding: 12 }}>
              <h3 style={{ margin: "0 0 8px", color: COLORS.navy }}>Important Instructions</h3>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
                <li>Keep your token ready when called by OPD staff.</li>
                <li>Proceed to the {success.department} waiting area and follow staff instructions.</li>
                <li>Carry previous reports and prescriptions if available.</li>
                <li>Follow queue display and staff instructions.</li>
              </ol>
            </div>
          </>
        )}
      </main>
      <GovFooter />
    </div>
  );
}

function StepBar({ step }) {
  const labels = ["Personal Details", "Symptoms", "Review and Confirm"];
  return <div style={{ display: "flex", marginBottom: 12 }}>{labels.map((label, index) => { const number = index + 1; const done = number < step; const active = number === step; return <div key={label} style={{ flex: 1, textAlign: "center", position: "relative" }}>{index ? <div style={{ position: "absolute", top: 14, left: "-50%", width: "100%", height: 2, background: number <= step ? COLORS.navy : "#CBD5E1" }} /> : null}<div style={{ width: 28, height: 28, borderRadius: "50%", margin: "0 auto", background: done ? COLORS.green : active ? COLORS.navy : "#94A3B8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, position: "relative", zIndex: 1 }}>{done ? "OK" : number}</div><div style={{ fontSize: 12, marginTop: 6, color: "#334155", fontWeight: active ? 700 : 500 }}>{label}</div></div>; })}</div>;
}

function FormCard({ title, subtitle, children }) { return <section style={{ border: "1px solid #CBD5E1", borderRadius: 12, overflow: "hidden", background: COLORS.cardBg }}><div style={{ background: COLORS.navy, color: "#fff", padding: "10px 12px" }}><div style={{ fontWeight: 800 }}>{title}</div><div style={{ fontSize: 12, color: COLORS.skyText }}>{subtitle}</div></div><div style={{ padding: 12 }}>{children}</div></section>; }
function ErrorBanner({ message }) { return <div style={{ border: "1px solid #FCA5A5", background: "#FEF2F2", color: COLORS.errorRed, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13, fontWeight: 700 }}>{message}</div>; }
function NoticeBox({ message }) { return <div style={{ border: "1px solid #FCD34D", background: "#FFFBEB", borderRadius: 8, padding: 10, color: "#92400E", marginBottom: 12, fontSize: 13 }}>{message}</div>; }
function Field({ label, children }) { return <label style={{ display: "block", marginBottom: 12 }}><span style={labelStyle}>{label}</span>{children}</label>; }
function Input({ value, onChange, placeholder }) { return <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={inputStyle} />; }
function MobileInput({ value, onChange }) { const normalized = normalizeIndianMobile(value); return <div style={{ display: "flex", alignItems: "stretch" }}><div style={{ border: `1px solid ${COLORS.inputBorder}`, borderRight: "none", borderRadius: "8px 0 0 8px", background: "#F8FAFC", color: "#334155", padding: "10px 12px", fontSize: 14, fontWeight: 700 }}>+91</div><input value={normalized} onChange={(event) => onChange(normalizeIndianMobile(event.target.value))} placeholder="98765 43210" style={{ ...inputStyle, borderRadius: "0 8px 8px 0" }} /></div>; }
function Select({ value, onChange, options }) { return <select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle}>{options.map((option) => <option key={option} value={option}>{option || "Select gender"}</option>)}</select>; }
function Row2Col({ children }) { return <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))" }}>{children}</div>; }
function NavRow({ children }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>{children}</div>; }
function PrimaryBtn({ children, onClick, disabled }) { return <button type="button" onClick={onClick} disabled={disabled} style={{ border: "none", borderRadius: 8, background: disabled ? "#94A3B8" : COLORS.navy, color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer" }}>{children}</button>; }
function GhostBtn({ children, onClick, disabled }) { return <button type="button" onClick={onClick} disabled={disabled} style={{ border: "1px solid #CBD5E1", borderRadius: 8, background: "#fff", color: "#334155", padding: "10px 14px", fontWeight: 700, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>{children}</button>; }
function SummaryRow({ label, value, noBorder }) { return <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8, padding: "9px 10px", borderBottom: noBorder ? "none" : "1px solid #E2E8F0", fontSize: 13 }}><strong style={{ color: "#334155" }}>{label}</strong><span style={{ color: "#0F172A" }}>{value}</span></div>; }
function InfoCell({ label, value }) { return <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, background: "#F8FAFC", padding: 10 }}><div style={{ fontSize: 11, color: "#64748B" }}>{label}</div><div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{value}</div></div>; }
function TricolorStrip() { return <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, background: COLORS.saffron }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: COLORS.green }} /></div>; }
function GovHeader({ onBack }) { return <header style={{ background: COLORS.navyDark, color: "#fff", padding: 12 }}><div style={{ maxWidth: 920, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{onBack ? <button type="button" onClick={onBack} style={{ border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.08)", color: "#fff", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>Back</button> : null}<div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>SQ</div><div><div style={{ fontWeight: 800 }}>SwasthyaQueue</div><div style={{ fontSize: 12, color: COLORS.skyText }}>Smart OPD Queue and Registration</div></div></div><div style={{ fontSize: 12, color: COLORS.skyText, fontWeight: 700 }}>New OPD Registration</div></div></header>; }
function GovFooter() { return <footer style={{ background: COLORS.navyDark, color: COLORS.skyText, padding: 10, fontSize: 12, textAlign: "center" }}>Copyright 2026 SwasthyaQueue | Government Hospital OPD Digital Queue System</footer>; }

export function computeRisk(checkedSymptoms, age, gender, painScale) {
  const ageNum = Number(age);
  let score = 0;
  let critical = false;
  let department = "General Medicine";

  for (const symptom of checkedSymptoms) {
    const current = symptomMap[symptom];
    if (!current) continue;
    score += current.score;
    if (current.critical) critical = true;
    if (department === "General Medicine" && current.department !== "General Medicine") {
      department = current.department;
    }
  }

  if (ageNum >= 60) score += 2;
  if (ageNum >= 0 && ageNum < 5) score += 3;
  if (painScale >= 7) score += 2;
  else if (painScale >= 5) score += 1;

  const painSeverity = painScale <= 2 ? "None" : painScale <= 4 ? "Mild" : painScale <= 6 ? "Moderate" : "Severe";
  let priority = "Normal";

  if (critical || score >= 8) priority = "Critical";
  else if (score >= 4 || ageNum >= 60 || (ageNum >= 0 && ageNum < 5)) priority = "High";

  return { score, priority, suggestedDepartment: department, painSeverity, gender };
}
