import { useEffect, useMemo, useState } from "react";
import { getOpdHoursLabel, getOpdSlotOptions } from "../../lib/timing";

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
  { key: "Heavy Bleeding", score: 6, critical: true, department: "Emergency" },
  { key: "Unconsciousness", score: 7, critical: true, department: "Emergency" },
  { key: "Severe Injury", score: 5, critical: true, department: "Orthopedics" },
  { key: "Joint/Bone Pain", score: 3, critical: false, department: "Orthopedics" },
  { key: "Child Fever", score: 3, critical: false, department: "Pediatrics" },
  { key: "Ear/Nose/Throat", score: 2, critical: false, department: "General Medicine" },
  { key: "Fever", score: 1, critical: false, department: "General Medicine" },
  { key: "Mild Cough", score: 1, critical: false, department: "General Medicine" },
  { key: "Headache", score: 2, critical: false, department: "General Medicine" },
  { key: "Skin Rash", score: 1, critical: false, department: "General Medicine" },
  { key: "Abdominal Pain", score: 2, critical: false, department: "General Medicine" },
  { key: "Eye Problem", score: 1, critical: false, department: "General Medicine" },
  { key: "Diabetes Check", score: 2, critical: false, department: "General Medicine" },
  { key: "Blood Pressure", score: 2, critical: false, department: "General Medicine" },
  { key: "Other", score: 1, critical: false, department: "General Medicine" },
];

const symptomMap = Object.fromEntries(symptomDefs.map((item) => [item.key, item]));
const fallbackDepartments = ["General Medicine", "Cardiology", "Orthopedics", "Pediatrics", "Emergency"];
const slotTimeOptions = getOpdSlotOptions();
const OPD_HOURS_LABEL = getOpdHoursLabel();

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

function formatSlotTime(timeValue = "") {
  if (!timeValue) return "-";
  const [hourText, minuteText] = timeValue.split(":");
  const hours = Number(hourText);
  const minutes = Number(minuteText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return timeValue;
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatPreferredSlot(value) {
  if (!value) return "No preference";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function buildPreferredSlot(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  return new Date(`${dateValue}T${timeValue}:00`).toISOString();
}

function getTodayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export default function PatientRegistration({ onBack, user, onRegistered }) {
  const initialForm = {
    name: user?.name || "",
    mobile: user?.mobile || "",
    age: user?.age ? String(user.age) : "",
    gender: user?.gender || "",
    address: user?.address || "",
    bloodGroup: user?.bloodGroup || "",
    allergies: user?.allergies || "",
    chronicConditions: user?.chronicConditions || "",
    symptoms: [],
    otherSymptoms: "",
    painScale: 0,
    preferredDate: "",
    preferredTime: "",
    department: "Auto-detect from symptoms",
  };

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [departmentLoadError, setDepartmentLoadError] = useState("");

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

  useEffect(() => {
    let cancelled = false;

    async function loadDepartments() {
      try {
        const { getDepartments } = await import("../../lib/api");
        const response = await getDepartments();
        if (cancelled) return;

        const names = Array.isArray(response)
          ? response.map((department) => department?.name).filter(Boolean)
          : [];

        setAvailableDepartments(names.length ? names : fallbackDepartments);
        setDepartmentLoadError("");
      } catch (err) {
        if (cancelled) return;
        setAvailableDepartments(fallbackDepartments);
        setDepartmentLoadError(err.message || "Unable to load live departments. Fallback choices are being shown.");
      }
    }

    loadDepartments();
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!user?.patientId) return "Please sign in again before booking a visit.";
    if (!form.name.trim()) return "Patient profile is incomplete. Please update your profile.";
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120) return "Patient profile age is missing or invalid.";
    if (!form.gender) return "Patient profile gender is missing.";
    if (!isValidIndianMobile(form.mobile)) return "Patient mobile number is missing or invalid.";
    return "";
  };

  const checkStep2 = () => {
    if (!form.symptoms.length && !form.otherSymptoms.trim()) {
      return "Please select at least 1 symptom or enter a short note.";
    }
    if ((form.preferredDate && !form.preferredTime) || (!form.preferredDate && form.preferredTime)) {
      return "Select both preferred date and preferred time, or leave both empty.";
    }
    if (form.preferredDate && (risk.priority !== "Normal" || Number(form.painScale) >= 5)) {
      return "Emergency or high-priority cases cannot be advance booked. Please continue without preferred slot.";
    }
    if (form.preferredDate) {
      const today = getTodayDateValue();
      if (form.preferredDate < today) {
        return "Preferred appointment date cannot be in the past.";
      }
      if (form.preferredDate === today && form.preferredTime) {
        const [hourText, minuteText] = String(form.preferredTime).split(":");
        const slotMinutes = Number(hourText) * 60 + Number(minuteText);
        const nextHourStart = Math.ceil(getCurrentMinutes() / 60) * 60;
        if (slotMinutes < nextHourStart) {
          return "For today, choose a slot from the next hour onward.";
        }
      }
    }
    return "";
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
      const {
        createAppointment,
        getDepartmentIdByName,
        updateMyPatientProfile,
      } = await import("../../lib/api");

      const autoDepartment = availableDepartments.includes(risk.suggestedDepartment)
        ? risk.suggestedDepartment
        : "General Medicine";
      const department = form.department === "Auto-detect from symptoms" ? autoDepartment : form.department;
      const departmentId = getDepartmentIdByName(department);
      const selectedSymptoms = form.symptoms.filter((item) => item !== "Other");
      const finalSymptoms = form.otherSymptoms.trim()
        ? [...selectedSymptoms, `Other: ${form.otherSymptoms.trim()}`]
        : selectedSymptoms;
      const symptomsText = finalSymptoms.join(", ") || "General checkup";
      const preferredSlot = buildPreferredSlot(form.preferredDate, form.preferredTime);

      if (user?.patientId) {
        await updateMyPatientProfile({
          name: form.name.trim(),
          age: Number(form.age),
          gender: form.gender,
          mobile: normalizeIndianMobile(form.mobile),
          email: user?.email || null,
          address: form.address?.trim() || null,
          emergencyContact: normalizeIndianMobile(form.mobile),
          bloodGroup: form.bloodGroup?.trim() || null,
          allergies: form.allergies?.trim() || null,
          chronicConditions: form.chronicConditions?.trim() || null,
        });
      }

      const appointmentResponse = await createAppointment({
        department_id: departmentId,
        symptoms: symptomsText,
        pain_scale: Number(form.painScale),
        preferred_slot: preferredSlot,
      });

      const appointment = appointmentResponse?.appointment;
      const registeredAt = appointment?.createdAt
        ? new Date(appointment.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
        : new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

      const payload = {
        token: appointment?.token,
        queueId: appointment?.queueId,
        appointmentId: appointment?.appointmentId,
        patientId: user?.patientId,
        departmentId,
        estimatedWait: appointment?.estimatedWait ?? 0,
        position: appointment?.position || 1,
        registeredAt,
        preferredSlot: appointment?.preferredSlot,
        department,
        dept: department,
        priority: risk.priority,
        priorityLevel: appointment?.priorityLevel,
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

  const saveProfileEdits = async () => {
    const validationError = checkStep1();
    if (validationError && !validationError.includes("Emergency contact in the saved profile is invalid") && !validationError.includes("Patient mobile number is missing or invalid.") && !validationError.includes("Patient profile")) {
      setError(validationError);
      return;
    }

    if (!form.name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120) {
      setError("Please enter a valid age.");
      return;
    }
    if (!form.gender) {
      setError("Please select gender.");
      return;
    }
    if (!isValidIndianMobile(form.mobile)) {
      setError("Please enter a valid patient mobile number.");
      return;
    }
    setProfileSaving(true);
    setProfileNotice("");
    setError("");

    try {
      const { updateMyPatientProfile, saveSession, getStoredSession } = await import("../../lib/api");
      await updateMyPatientProfile({
        name: form.name.trim(),
        age: Number(form.age),
        gender: form.gender,
        mobile: normalizeIndianMobile(form.mobile),
        email: user?.email || null,
        address: form.address?.trim() || null,
        emergencyContact: normalizeIndianMobile(form.mobile),
        bloodGroup: form.bloodGroup?.trim() || null,
        allergies: form.allergies?.trim() || null,
        chronicConditions: form.chronicConditions?.trim() || null,
      });

      const existingSession = getStoredSession() || {};
      saveSession({
        ...existingSession,
        ...user,
        name: form.name.trim(),
        age: Number(form.age),
        gender: form.gender,
        mobile: normalizeIndianMobile(form.mobile),
        address: form.address?.trim() || null,
        emergencyContact: normalizeIndianMobile(form.mobile),
        bloodGroup: form.bloodGroup?.trim() || null,
        allergies: form.allergies?.trim() || null,
        chronicConditions: form.chronicConditions?.trim() || null,
      });

      setProfileNotice("Saved details updated for future visits.");
      setEditingProfile(false);
    } catch (err) {
      setError(err.message || "Unable to update saved profile right now.");
    } finally {
      setProfileSaving(false);
    }
  };

  const reset = () => {
    setStep(1);
    setError("");
    setLoading(false);
    setSuccess(null);
    setForm(initialForm);
  };

  const selectedSymptomsForReview = form.otherSymptoms.trim()
    ? [...form.symptoms.filter((item) => item !== "Other"), `Other: ${form.otherSymptoms.trim()}`]
    : form.symptoms.filter((item) => item !== "Other");

  const reviewDepartment = form.department === "Auto-detect from symptoms"
    ? `Auto (${availableDepartments.includes(risk.suggestedDepartment) ? risk.suggestedDepartment : "General Medicine"})`
    : form.department;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.pageBg }}>
      <TricolorStrip />
      <GovHeader onBack={onBack} />
      <main style={{ maxWidth: 920, margin: "0 auto", padding: 14 }}>
        {!success ? (
          <>
            <StepBar step={step} />
            <FormCard
              title={`Step ${step} | ${step === 1 ? "Profile Summary" : step === 2 ? "Symptoms" : "Review and Confirm"}`}
              subtitle="Book New OPD Visit"
              headerAction={step === 1 ? (
                <button
                  type="button"
                  onClick={() => { setEditingProfile((current) => !current); setProfileNotice(""); }}
                  style={{
                    border: "1px solid rgba(255,255,255,0.28)",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    padding: "8px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {editingProfile ? "Close Edit" : "Edit Details"}
                </button>
              ) : null}
            >
              {error ? <ErrorBanner message={error} /> : null}

              {step === 1 ? (
                <>
                  {ageNote ? <NoticeBox message={ageNote} /> : null}
                  {profileNotice ? <SuccessBanner message={profileNotice} /> : null}
                  <div style={{ border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden", background: "#F8FAFC", marginBottom: 12 }}>
                    {editingProfile ? (
                      <>
                        <EditableRow label="Full Name" noBorder={false}>
                          <input value={form.name} onChange={(event) => setField("name", event.target.value)} style={summaryInputStyle} />
                        </EditableRow>
                        <EditableSplitRow
                          label="Age / Gender"
                          noBorder={false}
                          left={<input value={form.age} onChange={(event) => setField("age", String(event.target.value).replace(/\D/g, "").slice(0, 3))} style={summaryInputStyle} />}
                          right={
                            <select value={form.gender} onChange={(event) => setField("gender", event.target.value)} style={summaryInputStyle}>
                              <option value="">Select</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          }
                        />
                        <EditableRow label="Mobile" noBorder={false}>
                          <input value={form.mobile} onChange={(event) => setField("mobile", normalizeIndianMobile(event.target.value))} style={summaryInputStyle} placeholder="9876543210" />
                        </EditableRow>
                        <EditableRow label="Blood Group" noBorder={false}>
                          <input value={form.bloodGroup} onChange={(event) => setField("bloodGroup", event.target.value)} style={summaryInputStyle} />
                        </EditableRow>
                        <EditableRow label="Address" noBorder={false}>
                          <input value={form.address} onChange={(event) => setField("address", event.target.value)} style={summaryInputStyle} />
                        </EditableRow>
                        <EditableRow label="Allergies" noBorder={false}>
                          <input value={form.allergies} onChange={(event) => setField("allergies", event.target.value)} style={summaryInputStyle} />
                        </EditableRow>
                        <EditableRow label="Conditions" noBorder>
                          <input value={form.chronicConditions} onChange={(event) => setField("chronicConditions", event.target.value)} style={summaryInputStyle} />
                        </EditableRow>
                      </>
                    ) : (
                      <>
                        <SummaryRow label="Full Name" value={form.name} />
                        <SummaryRow label="Age / Gender" value={`${form.age} / ${form.gender}`} />
                        <SummaryRow label="Mobile" value={formatIndianMobile(form.mobile)} />
                        <SummaryRow label="Blood Group" value={form.bloodGroup || "-"} />
                        <SummaryRow label="Address" value={form.address || "-"} />
                        <SummaryRow label="Allergies" value={form.allergies || "-"} />
                        <SummaryRow label="Conditions" value={form.chronicConditions || "-"} noBorder />
                      </>
                    )}
                  </div>
                  <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>
                    These details come from your registered patient account, so you do not need to fill them again for every visit.
                  </div>
                  {editingProfile ? <NavRow><div /><PrimaryBtn onClick={saveProfileEdits} disabled={profileSaving}>{profileSaving ? "Saving..." : "Save Saved Details"}</PrimaryBtn></NavRow> : null}
                  <NavRow><GhostBtn onClick={onBack} disabled={!onBack}>Back to Dashboard</GhostBtn><PrimaryBtn onClick={next}>Continue to Symptoms</PrimaryBtn></NavRow>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  {departmentLoadError ? <NoticeBox message={departmentLoadError} /> : null}
                  <div style={{ border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155", borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13 }}>
                    Select the symptoms that best match the patient. Hospital appointment hours are {OPD_HOURS_LABEL}.
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
                  <Field label="Department Preference"><Select value={form.department} onChange={(value) => setField("department", value)} options={["Auto-detect from symptoms", ...availableDepartments]} /></Field>
                  <Row2Col>
                    <Field label="Preferred Date (optional)">
                      <input type="date" min={getTodayDateValue()} value={form.preferredDate} onChange={(event) => setField("preferredDate", event.target.value)} style={inputStyle} />
                    </Field>
                    <Field label="Preferred Time (optional)">
                      <select value={form.preferredTime} onChange={(event) => setField("preferredTime", event.target.value)} style={inputStyle}>
                        <option value="">Select time</option>
                        {slotTimeOptions.map((timeValue) => (
                          <option key={timeValue} value={timeValue}>{formatSlotTime(timeValue)}</option>
                        ))}
                      </select>
                    </Field>
                  </Row2Col>
                  <div style={{ border: "1px solid #FCD34D", background: "#FFFBEB", color: "#92400E", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>
                    OPD appointment hours are {OPD_HOURS_LABEL}. Please choose a slot within hospital hours.
                  </div>
                  <NavRow><GhostBtn onClick={() => setStep(1)}>Back</GhostBtn><PrimaryBtn onClick={next}>Review</PrimaryBtn></NavRow>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <div style={{ border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden", background: "#F8FAFC", marginBottom: 12 }}>
                    <SummaryRow label="Full Name" value={form.name} />
                    <SummaryRow label="Age / Gender" value={`${form.age} / ${form.gender}`} />
                    <SummaryRow label="Mobile" value={formatIndianMobile(form.mobile)} />
                    <SummaryRow label="Department" value={reviewDepartment} />
                    <SummaryRow label="Symptoms" value={selectedSymptomsForReview.join(", ") || "Not specified"} />
                    <SummaryRow label="Preferred Slot" value={form.preferredDate && form.preferredTime ? `${form.preferredDate} | ${formatSlotTime(form.preferredTime)}` : "No preference"} />
                    <SummaryRow label="Pain Level" value={`${form.painScale}/10`} noBorder />
                  </div>
                  <div style={{ border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155", borderRadius: 10, padding: 10, marginBottom: 10 }}>Your details will be reviewed by staff and the correct queue will be assigned.</div>
                  <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6 }}>By clicking Confirm and Register, you confirm all information is accurate. Final queue handling is always reviewed by hospital staff.</p>
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
                  {success.preferredSlot ? <div style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#334155", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10 }}>Preferred slot noted: {formatPreferredSlot(success.preferredSlot)}</div> : null}
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
  const labels = ["Profile Summary", "Symptoms", "Review and Confirm"];
  return <div style={{ display: "flex", marginBottom: 12 }}>{labels.map((label, index) => { const number = index + 1; const done = number < step; const active = number === step; return <div key={label} style={{ flex: 1, textAlign: "center", position: "relative" }}>{index ? <div style={{ position: "absolute", top: 14, left: "-50%", width: "100%", height: 2, background: number <= step ? COLORS.navy : "#CBD5E1" }} /> : null}<div style={{ width: 28, height: 28, borderRadius: "50%", margin: "0 auto", background: done ? COLORS.green : active ? COLORS.navy : "#94A3B8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, position: "relative", zIndex: 1 }}>{done ? "OK" : number}</div><div style={{ fontSize: 12, marginTop: 6, color: "#334155", fontWeight: active ? 700 : 500 }}>{label}</div></div>; })}</div>;
}

function FormCard({ title, subtitle, headerAction, children }) {
  return (
    <section style={{ border: "1px solid #CBD5E1", borderRadius: 12, overflow: "hidden", background: COLORS.cardBg }}>
      <div style={{ background: COLORS.navy, color: "#fff", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: 12, color: COLORS.skyText }}>{subtitle}</div>
        </div>
        {headerAction ? <div>{headerAction}</div> : null}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </section>
  );
}
function ErrorBanner({ message }) { return <div style={{ border: "1px solid #FCA5A5", background: "#FEF2F2", color: COLORS.errorRed, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13, fontWeight: 700 }}>{message}</div>; }
function SuccessBanner({ message }) { return <div style={{ border: "1px solid #86EFAC", background: "#F0FDF4", color: "#166534", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13, fontWeight: 700 }}>{message}</div>; }
function NoticeBox({ message }) { return <div style={{ border: "1px solid #FCD34D", background: "#FFFBEB", borderRadius: 8, padding: 10, color: "#92400E", marginBottom: 12, fontSize: 13 }}>{message}</div>; }
function Field({ label, children }) { return <label style={{ display: "block", marginBottom: 12 }}><span style={labelStyle}>{label}</span>{children}</label>; }
function Input({ value, onChange, placeholder }) { return <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={inputStyle} />; }
function Select({ value, onChange, options }) { return <select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle}>{options.map((option) => <option key={option} value={option}>{option || "Select"}</option>)}</select>; }
function Row2Col({ children }) { return <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))" }}>{children}</div>; }
function NavRow({ children }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>{children}</div>; }
function PrimaryBtn({ children, onClick, disabled }) { return <button type="button" onClick={onClick} disabled={disabled} style={{ border: "none", borderRadius: 8, background: disabled ? "#94A3B8" : COLORS.navy, color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer" }}>{children}</button>; }
function GhostBtn({ children, onClick, disabled }) { return <button type="button" onClick={onClick} disabled={disabled} style={{ border: "1px solid #CBD5E1", borderRadius: 8, background: "#fff", color: "#334155", padding: "10px 14px", fontWeight: 700, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>{children}</button>; }
function SummaryRow({ label, value, noBorder }) { return <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8, padding: "9px 10px", borderBottom: noBorder ? "none" : "1px solid #E2E8F0", fontSize: 13 }}><strong style={{ color: "#334155" }}>{label}</strong><span style={{ color: "#0F172A" }}>{value}</span></div>; }
function EditableRow({ label, children, noBorder }) {
  return <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8, padding: "9px 10px", borderBottom: noBorder ? "none" : "1px solid #E2E8F0", fontSize: 13, alignItems: "center" }}><strong style={{ color: "#334155" }}>{label}</strong><div>{children}</div></div>;
}
function EditableSplitRow({ label, left, right, noBorder }) {
  return <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8, padding: "9px 10px", borderBottom: noBorder ? "none" : "1px solid #E2E8F0", fontSize: 13, alignItems: "center" }}><strong style={{ color: "#334155" }}>{label}</strong><div style={{ display: "grid", gridTemplateColumns: "110px minmax(130px, 160px)", gap: 8 }}>{left}{right}</div></div>;
}
function InfoCell({ label, value }) { return <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, background: "#F8FAFC", padding: 10 }}><div style={{ fontSize: 11, color: "#64748B" }}>{label}</div><div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{value}</div></div>; }
const summaryInputStyle = { width: "100%", border: "1px solid #CBD5E1", borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff" };
function TricolorStrip() { return <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, background: COLORS.saffron }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: COLORS.green }} /></div>; }
function GovHeader() { return <header style={{ background: COLORS.navyDark, color: "#fff", padding: 12 }}><div style={{ maxWidth: 920, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>SQ</div><div><div style={{ fontWeight: 800 }}>SwasthyaQueue</div><div style={{ fontSize: 12, color: COLORS.skyText }}>Smart OPD Queue and Registration</div></div></div><div style={{ fontSize: 12, color: COLORS.skyText, fontWeight: 700 }}>New OPD Registration</div></div></header>; }
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
