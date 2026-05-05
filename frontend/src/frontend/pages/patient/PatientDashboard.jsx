import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TIMING } from "../../lib/timing";
import { subscribeQueueUpdates } from "../../lib/realtimeSync";

const COLORS = {
  navyDark: "#002060",
  navy: "#003580",
  saffron: "#FF9933",
  green: "#138808",
  pageBg: "#EEF2F7",
  skyText: "#A8C8FF",
};

function formatIndianMobile(value = "") {
  const digits = String(value).replace(/\D/g, "");
  const normalized = digits.startsWith("91") && digits.length > 10 ? digits.slice(-10) : digits.slice(0, 10);
  if (!normalized) return "+91";
  if (normalized.length <= 5) return `+91 ${normalized}`;
  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}

function nowHHMM() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function queueStatusLabel(status) {
  if (status === "in-progress") return "In Consultation";
  if (status === "waiting") return "Waiting";
  if (status === "completed") return "Completed";
  return status || "Booked";
}

export default function PatientDashboard({ user, tokenData: latestToken, onLogout, onRegister }) {
  const [clock, setClock] = useState(nowHHMM());
  const [screenState, setScreenState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [queueNotice, setQueueNotice] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [activeAppointment, setActiveAppointment] = useState(null);
  const [appointmentHistory, setAppointmentHistory] = useState([]);
  const previousActiveRef = useRef(null);

  const loadDashboardData = useCallback(async () => {
    setScreenState("loading");
    setLoadError("");

    try {
      const { getMyActiveAppointment, getMyAppointmentHistory } = await import("../../lib/api");
      const [activeResponse, historyResponse] = await Promise.all([
        getMyActiveAppointment(),
        getMyAppointmentHistory(),
      ]);

      const active = activeResponse?.appointment || null;
      const history = historyResponse?.appointments || [];

      setActiveAppointment(active);
      setAppointmentHistory(history);
      setScreenState("ready");
    } catch (err) {
      setLoadError(err.message || "Unable to load dashboard right now.");
      setScreenState("error");
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(nowHHMM()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, latestToken]);

  useEffect(() => {
    if (screenState !== "ready") return;
    const refreshId = setInterval(() => {
      loadDashboardData();
    }, TIMING.patientPollMs);
    return () => clearInterval(refreshId);
  }, [screenState, loadDashboardData]);

  useEffect(() => {
    return subscribeQueueUpdates(() => {
      loadDashboardData();
    });
  }, [loadDashboardData]);

  useEffect(() => {
    if (screenState !== "ready") return;

    if (!activeAppointment?.appointmentId) {
      previousActiveRef.current = null;
      return;
    }

    const current = {
      appointmentId: activeAppointment.appointmentId,
      position: Number.isFinite(Number(activeAppointment.position)) ? Number(activeAppointment.position) : null,
      status: activeAppointment.queueStatus || activeAppointment.status || "",
    };
    const previous = previousActiveRef.current;

    if (!previous || previous.appointmentId !== current.appointmentId) {
      previousActiveRef.current = current;
      return;
    }

    let notice = "";
    if (previous.status !== current.status) {
      if (current.status === "in-progress") notice = "Called to Consultation";
      else if (current.status === "ready-for-doctor") notice = "Called to Triage";
      else if (current.status === "completed") notice = "Visit Completed";
      else if (current.status === "queued") notice = "Your token is active in queue.";
    } else if (
      current.position !== null &&
      previous.position !== null &&
      current.position !== previous.position
    ) {
      notice = current.position < previous.position
        ? `Queue update: your position moved from ${previous.position} to ${current.position}.`
        : `Queue update: your current position is ${current.position}.`;
    }

    if (notice) setQueueNotice(notice);
    previousActiveRef.current = current;
  }, [activeAppointment, screenState]);

  useEffect(() => {
    if (!queueNotice) return;
    const timer = setTimeout(() => setQueueNotice(""), TIMING.patientNoticeMs);
    return () => clearTimeout(timer);
  }, [queueNotice]);

  const handleCancelAppointment = async () => {
    if (!activeAppointment?.appointmentId || canceling) return;

    setCanceling(true);
    setActionMessage("");
    try {
      const { cancelAppointment } = await import("../../lib/api");
      await cancelAppointment(activeAppointment.appointmentId);
      setActionMessage("Your active visit was cancelled. You can book a fresh OPD visit now.");
      await loadDashboardData();
    } catch (err) {
      setActionMessage(err.message || "Unable to cancel the active visit right now.");
    } finally {
      setCanceling(false);
    }
  };

  const activeCard = useMemo(() => {
    if (!activeAppointment) return null;
    return {
      token: activeAppointment.token || "-",
      department: activeAppointment.department || "-",
      position: activeAppointment.position || "-",
      estimatedWait: activeAppointment.estimatedWait == null ? "-" : `${activeAppointment.estimatedWait} min`,
      status: queueStatusLabel(activeAppointment.queueStatus || activeAppointment.status),
      bookedAt: formatDateTime(activeAppointment.createdAt),
      preferredSlot: formatDateTime(activeAppointment.preferredSlot),
    };
  }, [activeAppointment]);

  const hasActiveAppointment = Boolean(activeAppointment);

  if (screenState === "loading") {
    return <PageShell name={user?.name || "Patient"} clock={clock}><StateCard title="Loading dashboard" description="Fetching your profile, active token, and appointment history." /></PageShell>;
  }

  if (screenState === "error") {
    return <PageShell name={user?.name || "Patient"} clock={clock}><StateCard title="Unable to load dashboard" description={loadError} actionLabel="Try Again" onAction={loadDashboardData} /></PageShell>;
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.pageBg }}>
      <TricolorStrip />
      <GovHeader name={user?.name || "Patient"} clock={clock} />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "16px 12px 24px", display: "grid", gap: 12 }}>
        <section style={{ backgroundColor: COLORS.navy, color: "white", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: COLORS.skyText, fontSize: 12 }}>Patient Dashboard</div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>{user?.name || "Patient"}</div>
              <div style={{ color: COLORS.skyText, fontSize: 12 }}>
                {formatIndianMobile(user?.mobile)} | {clock}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={onRegister}
                disabled={hasActiveAppointment}
                style={{
                  border: "none",
                  borderRadius: 8,
                  background: hasActiveAppointment ? "#94A3B8" : COLORS.saffron,
                  color: hasActiveAppointment ? "#F8FAFC" : "#4A2500",
                  padding: "10px 14px",
                  fontWeight: 800,
                  cursor: hasActiveAppointment ? "not-allowed" : "pointer",
                }}
              >
                {hasActiveAppointment ? "Active Visit in Progress" : "Book New Visit"}
              </button>
              <button type="button" onClick={onRegister} style={ghostBtn}>Edit Profile / Book</button>
              <button type="button" onClick={loadDashboardData} style={ghostBtn}>Refresh</button>
              <button type="button" onClick={onLogout} style={ghostBtn}>Logout</button>
            </div>
          </div>
        </section>

        {actionMessage ? (
          <section style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 12, padding: "10px 12px", fontSize: 13 }}>
            {actionMessage}
          </section>
        ) : null}

        {queueNotice ? (
          <section style={{ border: "1px solid #FCD34D", background: "#FFFBEB", color: "#92400E", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>
            {queueNotice}
          </section>
        ) : null}

        <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
          <div style={sectionCard}>
            <SectionTitle title="Active Appointment" subtitle="Your live token and queue status" />
            {activeCard ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(120px,1fr))", gap: 10 }}>
                  <InfoCell label="Token" value={`#${activeCard.token}`} emphasis />
                  <InfoCell label="Department" value={activeCard.department} />
                  <InfoCell label="Position" value={activeCard.position} />
                  <InfoCell label="Estimated Wait" value={activeCard.estimatedWait} />
                  <InfoCell label="Status" value={activeCard.status} />
                  <InfoCell label="Booked At" value={activeCard.bookedAt} />
                  <InfoCell label="Preferred Slot" value={activeCard.preferredSlot} />
                </div>
                <div style={{ marginTop: 10, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                  Keep your token ready. Queue position may change if higher-priority patients are moved ahead by staff.
                </div>
                {["booked", "queued"].includes(activeAppointment.status) ? (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={handleCancelAppointment}
                      disabled={canceling}
                      style={{
                        border: "1px solid #FCA5A5",
                        borderRadius: 8,
                        background: canceling ? "#F8FAFC" : "#FEF2F2",
                        color: "#B91C1C",
                        padding: "10px 14px",
                        fontWeight: 700,
                        cursor: canceling ? "not-allowed" : "pointer",
                      }}
                    >
                      {canceling ? "Cancelling..." : "Cancel Active Visit"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <InlineEmpty title="No active appointment" description="Book a new visit to generate a token and track your queue live." />
            )}
          </div>

          <div style={sectionCard}>
            <SectionTitle title="Profile Summary" subtitle="Saved account details" />
            <SummaryRow label="Name" value={user?.name || "-"} />
            <SummaryRow label="Mobile" value={formatIndianMobile(user?.mobile)} />
            <SummaryRow label="Age / Gender" value={`${user?.age || "-"} / ${user?.gender || "-"}`} />
            <SummaryRow label="Blood Group" value={user?.bloodGroup || "-"} />
            <SummaryRow label="Email" value={user?.email || "-"} />
            <SummaryRow label="Allergies" value={user?.allergies || "-"} />
            <SummaryRow label="Conditions" value={user?.chronicConditions || "-"} noBorder />
          </div>
        </section>

        <section style={sectionCard}>
          <SectionTitle title="Past Appointments" subtitle="Recent OPD visit history" />
          {appointmentHistory.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {appointmentHistory.map((appointment) => (
                <div key={appointment.appointmentId} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 12px", background: appointment.status === "queued" || appointment.status === "in-progress" ? "#FFF7ED" : "#F8FAFC" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800, color: "#0F172A" }}>{appointment.department}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{formatDateTime(appointment.createdAt)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "monospace", fontWeight: 900, color: "#003580" }}>#{appointment.token || "-"}</div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>{queueStatusLabel(appointment.queueStatus || appointment.status)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>{appointment.symptoms}</div>
                  {appointment.preferredSlot ? <div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>Preferred slot: {formatDateTime(appointment.preferredSlot)}</div> : null}
                  {appointment.triage?.temperatureC || appointment.triage?.bloodPressure || appointment.triage?.pulseRate || appointment.triage?.spo2 || appointment.triage?.weightKg ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#334155" }}>
                      Triage: Temp {appointment.triage?.temperatureC || "-"} F | BP {appointment.triage?.bloodPressure || "-"} | Pulse {appointment.triage?.pulseRate || "-"} | SpO2 {appointment.triage?.spo2 || "-"} | Weight {appointment.triage?.weightKg || "-"} kg
                    </div>
                  ) : null}
                  {appointment.triage?.notes ? <div style={{ marginTop: 4, fontSize: 12, color: "#475569" }}>Nurse note: {appointment.triage.notes}</div> : null}
                  {appointment.doctor?.diagnosis ? <div style={{ marginTop: 6, fontSize: 13, color: "#334155" }}>Diagnosis: {appointment.doctor.diagnosis}</div> : null}
                  {appointment.doctor?.prescription ? <div style={{ marginTop: 4, fontSize: 13, color: "#334155" }}>Prescription / Advice: {appointment.doctor.prescription}</div> : null}
                  {appointment.doctor?.testsOrdered ? <div style={{ marginTop: 4, fontSize: 13, color: "#334155" }}>Tests: {appointment.doctor.testsOrdered}</div> : null}
                  {appointment.doctor?.notes ? <div style={{ marginTop: 4, fontSize: 12, color: "#475569" }}>Doctor notes: {appointment.doctor.notes}</div> : null}
                  {appointment.doctor?.followUpDate ? <div style={{ marginTop: 4, fontSize: 12, color: "#64748B" }}>Follow-up: {formatDateTime(appointment.doctor.followUpDate)}</div> : null}
                  {appointment.doctor?.followUpNotes ? <div style={{ marginTop: 4, fontSize: 12, color: "#64748B" }}>Follow-up advice: {appointment.doctor.followUpNotes}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <InlineEmpty title="No appointment history yet" description="Your past OPD visits will appear here once you start using the system." />
          )}
        </section>
      </main>

      <GovFooter />
    </div>
  );
}

function PageShell({ name, clock, children }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.pageBg }}>
      <TricolorStrip />
      <GovHeader name={name} clock={clock} />
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "16px 12px 24px" }}>{children}</main>
      <GovFooter />
    </div>
  );
}

function StateCard({ title, description, actionLabel, onAction }) {
  return (
    <section style={{ border: "1px solid #CBD5E1", borderRadius: 12, background: "#fff", padding: 24, textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E2E8F0", margin: "0 auto 12px" }} />
      <h2 style={{ margin: 0, fontSize: 22, color: "#0F172A" }}>{title}</h2>
      <p style={{ margin: "8px 0 0", color: "#64748B", lineHeight: 1.6 }}>{description}</p>
      {actionLabel ? (
        <button type="button" onClick={onAction} style={{ marginTop: 16, border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 800, color: "#0F172A", fontSize: 18 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

function InlineEmpty({ title, description }) {
  return (
    <div style={{ padding: 12, border: "1px dashed #CBD5E1", borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontWeight: 800, color: "#0F172A" }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: "#64748B" }}>{description}</div>
    </div>
  );
}

function InfoCell({ label, value, emphasis }) {
  return (
    <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, background: emphasis ? "#EFF6FF" : "#F8FAFC", padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "#64748B" }}>{label}</div>
      <div style={{ marginTop: 2, fontWeight: 800, fontSize: 15, color: emphasis ? "#1D4ED8" : "#0F172A" }}>{value}</div>
    </div>
  );
}

function SummaryRow({ label, value, noBorder }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, padding: "8px 0", borderBottom: noBorder ? "none" : "1px solid #E2E8F0", fontSize: 13 }}>
      <strong style={{ color: "#334155" }}>{label}</strong>
      <span style={{ color: "#0F172A" }}>{value}</span>
    </div>
  );
}

const sectionCard = {
  background: "#fff",
  border: "1px solid #CBD5E1",
  borderRadius: 12,
  padding: 14,
};

const ghostBtn = {
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

function TricolorStrip() {
  return <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, backgroundColor: COLORS.saffron }} /><div style={{ flex: 1, backgroundColor: "#FFFFFF" }} /><div style={{ flex: 1, backgroundColor: COLORS.green }} /></div>;
}

function GovHeader({ name, clock }) {
  return (
    <header style={{ backgroundColor: COLORS.navyDark, color: "white", padding: "10px 12px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>SQ</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>SwasthyaQueue</div>
            <div style={{ fontSize: 12, color: COLORS.skyText }}>Patient Dashboard</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: COLORS.skyText, fontWeight: 700 }}>{name} | {clock}</div>
      </div>
    </header>
  );
}

function GovFooter() {
  return (
    <footer style={{ backgroundColor: COLORS.navyDark, color: COLORS.skyText, padding: "10px 12px", fontSize: 12 }}>
      <div style={{ maxWidth: 980, margin: "0 auto", textAlign: "center" }}>Copyright 2026 SwasthyaQueue | Government Hospital OPD Digital Queue System</div>
    </footer>
  );
}
