import { useCallback, useEffect, useMemo, useState } from "react";

const COLORS = {
  navyDark: "#002060",
  navy: "#003580",
  saffron: "#FF9933",
  green: "#138808",
  pageBg: "#EEF2F7",
  skyText: "#A8C8FF",
};

const MOCK_PATIENT_TOKEN = {
  token: 247,
  dept: "Cardiology",
  priority: "high",
  riskScore: 7,
  symptoms: ["Chest Pain", "Blood Pressure"],
  painScale: 5,
  registeredAt: "09:42 AM",
  mobile: "9876501234",
  totalInQueue: 14,
  patientsAhead: 5,
  avgConsultMins: 8,
  doctorName: "Dr. Arvind Nair",
  opdRoom: "OPD Room 3 | Block B",
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

function notificationFactory(type, message) {
  return { id: `${Date.now()}-${Math.random()}`, type, message, time: nowHHMM() };
}

function createNotifications(token) {
  return [
    notificationFactory("success", `Registration successful. Token ${token.token} issued for ${token.dept}.`),
    notificationFactory("info", `You are currently #${token.patientsAhead + 1} in the ${token.dept} queue.`),
    notificationFactory("info", `Please stay near ${token.opdRoom} and follow the display board.`),
  ];
}

export default function PatientDashboard({ user, tokenData: registrationToken, onLogout, onRegister }) {
  const [clock, setClock] = useState(nowHHMM());
  const [activeTab, setActiveTab] = useState("status");
  const [screenState, setScreenState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [tokenData, setTokenData] = useState(null);
  const [queueRows, setQueueRows] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const loadDashboardData = useCallback(async () => {
    setScreenState("loading");
    setLoadError("");

    try {
      if (!registrationToken) {
        setTokenData(null);
        setQueueRows([]);
        setNotifications([]);
        setScreenState("empty");
        return;
      }

      const { checkTurn, getQueueByDepartment, normalizePriority } = await import("../../lib/api");
      const departmentQueue = await getQueueByDepartment(registrationToken.departmentId);
      const turnInfo = await checkTurn({
        patient_id: registrationToken.patientId,
        department_id: registrationToken.departmentId,
      });

      const rows = departmentQueue.map((row, index) => ({
        position: index + 1,
        token: row.token_number,
        priority: normalizePriority(row.priority_level),
        status: row.status === "in-progress" ? "in-consultation" : row.status,
        isYou: row.patient_id === registrationToken.patientId,
      }));

      const waitingAhead = Math.max(0, rows.findIndex((row) => row.isYou));
      const mergedToken = {
        ...MOCK_PATIENT_TOKEN,
        ...registrationToken,
        dept: registrationToken.department || registrationToken.dept || MOCK_PATIENT_TOKEN.dept,
        department: registrationToken.department || registrationToken.dept || MOCK_PATIENT_TOKEN.dept,
        priority: String(registrationToken.priority || MOCK_PATIENT_TOKEN.priority).toLowerCase(),
        mobile: registrationToken.mobile || MOCK_PATIENT_TOKEN.mobile,
        estimatedWait: turnInfo?.estimated_wait_time ?? registrationToken.estimatedWait,
        avgConsultMins: rows.length > 1
          ? Math.max(1, Math.round((turnInfo?.estimated_wait_time ?? registrationToken.estimatedWait ?? 0) / Math.max(waitingAhead, 1)))
          : MOCK_PATIENT_TOKEN.avgConsultMins,
      };

      const normalizedToken = {
        ...mergedToken,
        totalInQueue: rows.length,
        patientsAhead: waitingAhead,
      };

      setTokenData(normalizedToken);
      setQueueRows(rows);
      setNotifications(createNotifications(normalizedToken));
      setScreenState(rows.length ? "ready" : "empty");
    } catch {
      setLoadError("Unable to load patient queue details right now.");
      setScreenState("error");
    }
  }, [registrationToken]);

  useEffect(() => {
    const timer = setInterval(() => setClock(nowHHMM()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (screenState !== "ready") return;
    const realtimeId = setInterval(() => {
      loadDashboardData();
    }, 45000);
    return () => clearInterval(realtimeId);
  }, [screenState, loadDashboardData]);

  const urgentBanner = useMemo(() => {
    if (!tokenData) return null;
    if (tokenData.patientsAhead <= 2 && tokenData.patientsAhead > 0) {
      return {
        bg: "#FFF7ED",
        border: "#FCD34D",
        text: "#D97706",
        message: `Almost your turn. ${tokenData.patientsAhead} patients ahead. Please be ready near ${tokenData.opdRoom}.`,
      };
    }
    if (tokenData.patientsAhead === 0) {
      return {
        bg: "#FEF2F2",
        border: "#FCA5A5",
        text: "#DC2626",
        message: `Your turn now. Please proceed to ${tokenData.opdRoom} immediately.`,
      };
    }
    return null;
  }, [tokenData]);

  const statusLabel = tokenData?.patientsAhead === 0 ? "Your Turn" : "Waiting";
  const estWait = !tokenData ? "-" : tokenData.patientsAhead === 0 ? "Now" : `${tokenData.patientsAhead * tokenData.avgConsultMins} min`;
  const position = tokenData ? tokenData.patientsAhead + 1 : 0;
  const percentComplete = !tokenData ? 0 : Math.min(100, Math.round(((tokenData.totalInQueue - position) / Math.max(tokenData.totalInQueue - 1, 1)) * 100));
  const nowServing = queueRows.find((row) => row.status === "in-consultation")?.token || queueRows[0]?.token || "-";

  if (screenState === "loading") return <PageShell clock={clock} name={user?.name || "Patient"}><StateCard title="Loading queue status" description="Fetching your token, queue position, and updates for today." /></PageShell>;
  if (screenState === "error") return <PageShell clock={clock} name={user?.name || "Patient"}><StateCard title="Unable to load dashboard" description={loadError} actionLabel="Try Again" onAction={loadDashboardData} /></PageShell>;
  if (screenState === "empty") return <PageShell clock={clock} name={user?.name || "Patient"}><StateCard title="No active OPD token" description="Complete registration to view your live queue status and updates." actionLabel="Start Registration" onAction={onRegister} /></PageShell>;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.pageBg }}>
      <TricolorStrip />
      <GovHeader name={user?.name || "Patient"} clock={clock} />

      {urgentBanner ? <div style={{ width: "100%", borderTop: `1px solid ${urgentBanner.border}`, borderBottom: `1px solid ${urgentBanner.border}`, backgroundColor: urgentBanner.bg, color: urgentBanner.text, fontWeight: 700, padding: "10px 14px", boxSizing: "border-box" }}><div style={{ maxWidth: 980, margin: "0 auto" }}>{urgentBanner.message}</div></div> : null}

      <main style={{ maxWidth: 660, margin: "0 auto", padding: "16px 12px 24px" }}>
        <section style={{ backgroundColor: COLORS.navy, color: "white", borderRadius: 12, padding: 14, marginBottom: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: COLORS.skyText, fontSize: 12 }}>Welcome back</div>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{user?.name || "Rahul Kumar"}</div>
              <div style={{ color: COLORS.skyText, fontSize: 12 }}>{user?.id || "P001"} | {clock}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(78px,1fr))", gap: 8, minWidth: 260 }}>
              <MiniStat title="Token" value={`#${tokenData.token}`} />
              <MiniStat title="Department" value={tokenData.dept} />
              <MiniStat title="Status" value={statusLabel} />
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", backgroundColor: "#fff", border: "1px solid #CBD5E1", borderRadius: 999, padding: 4, marginBottom: 12 }}>
          <TabBtn active={activeTab === "status"} onClick={() => setActiveTab("status")}>My Status</TabBtn>
          <TabBtn active={activeTab === "alerts"} onClick={() => setActiveTab("alerts")}>Updates ({notifications.length})</TabBtn>
        </section>

        {activeTab === "status" ? (
          <div>
            <TokenCard tokenData={tokenData} estWait={estWait} position={position} percentComplete={percentComplete} nowServing={nowServing} />
            <div style={{ marginTop: 10, border: "1px solid #BFDBFE", backgroundColor: "#EFF6FF", color: "#1D4ED8", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>SMS will be sent to {formatIndianMobile(tokenData.mobile)} when 3 patients are ahead. Stay within hospital.</div>
            <div style={{ marginTop: 10, backgroundColor: "#fff", border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden" }}>
              <SummaryRow label="Full Name" value={user?.name || "Rahul Kumar"} />
              <SummaryRow label="Mobile" value={formatIndianMobile(tokenData.mobile)} />
              <SummaryRow label="Department" value={tokenData.dept} />
              <SummaryRow label="Doctor / Room" value={`${tokenData.doctorName} | ${tokenData.opdRoom}`} />
              <SummaryRow label="Symptoms" value={tokenData.symptoms.join(", ")} />
              <SummaryRow label="Pain Scale" value={`${tokenData.painScale}/10`} noBorder />
            </div>
            <button type="button" onClick={loadDashboardData} style={{ marginTop: 10, width: "100%", border: "1px dashed #64748B", borderRadius: 10, padding: "11px 12px", backgroundColor: "#fff", color: "#334155", fontWeight: 700, cursor: "pointer" }}>Refresh Queue Status</button>
          </div>
        ) : null}

        {activeTab === "alerts" ? (notifications.length ? <section style={{ display: "grid", gap: 8 }}>{notifications.map((item) => <AlertCard key={item.id} item={item} />)}</section> : <InlineEmpty title="No updates yet" description="Your queue updates will appear here automatically." />) : null}

        <section style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={onLogout} style={{ backgroundColor: "white", color: "#334155", border: "1px solid #CBD5E1", borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Sign Out</button>
        </section>
      </main>

      <GovFooter />
    </div>
  );
}

function PageShell({ name, clock, children }) { return <div style={{ minHeight: "100vh", backgroundColor: COLORS.pageBg }}><TricolorStrip /><GovHeader name={name} clock={clock} /><main style={{ maxWidth: 660, margin: "0 auto", padding: "16px 12px 24px" }}>{children}</main><GovFooter /></div>; }
function StateCard({ title, description, actionLabel, onAction }) { return <section style={{ border: "1px solid #CBD5E1", borderRadius: 12, background: "#fff", padding: 24, textAlign: "center" }}><div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E2E8F0", margin: "0 auto 12px" }} /><h2 style={{ margin: 0, fontSize: 22, color: "#0F172A" }}>{title}</h2><p style={{ margin: "8px 0 0", color: "#64748B", lineHeight: 1.6 }}>{description}</p>{actionLabel ? <button type="button" onClick={onAction} style={{ marginTop: 16, border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>{actionLabel}</button> : null}</section>; }
function InlineEmpty({ title, description }) { return <div style={{ padding: 20, textAlign: "center" }}><div style={{ fontWeight: 800, color: "#0F172A" }}>{title}</div><div style={{ marginTop: 6, fontSize: 13, color: "#64748B" }}>{description}</div></div>; }

function TokenCard({ tokenData, estWait, position, percentComplete, nowServing }) {
  const aheadTone = tokenData.patientsAhead <= 2 ? { bg: "#FFFBEB", border: "#FCD34D", text: "#D97706" } : { bg: "#F8FAFC", border: "#E2E8F0", text: "#0F172A" };
  return <section style={{ border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff" }}><div style={{ backgroundColor: COLORS.navy, color: "white", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><div><div style={{ color: COLORS.skyText, fontSize: 12 }}>District Government Hospital | Amaravati</div><div style={{ fontWeight: 700, marginTop: 2 }}>{tokenData.dept}</div><div style={{ fontSize: 12, color: COLORS.skyText }}>{tokenData.doctorName} | {tokenData.opdRoom}</div></div><div style={{ backgroundColor: COLORS.saffron, color: "#4A2500", borderRadius: 999, padding: "6px 12px", fontFamily: "monospace", fontWeight: 900 }}>#{tokenData.token}</div></div><div style={{ padding: 12 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(120px,1fr))", gap: 8 }}><InfoCell label="Patients Ahead" value={String(tokenData.patientsAhead)} tone={aheadTone} /><InfoCell label="Estimated Wait" value={estWait} /><InfoCell label="Now Serving" value={`#${nowServing}`} /><InfoCell label="Registered At" value={tokenData.registeredAt} /></div><div style={{ marginTop: 10 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: "#64748B", fontWeight: 700 }}>QUEUE PROGRESS</span><span style={{ color: COLORS.navy, fontWeight: 700 }}>{percentComplete}% complete</span></div><div style={{ height: 9, backgroundColor: "#E2E8F0", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${percentComplete}%`, transition: "width 0.35s ease", height: "100%", backgroundColor: COLORS.navy }} /></div><div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", marginTop: 6, fontSize: 12 }}><span style={{ color: "#64748B" }}>Queue Start</span><span style={{ color: COLORS.navy, fontWeight: 800 }}>Position {position} of {tokenData.totalInQueue}</span><span style={{ color: "#64748B", textAlign: "right" }}>Your Turn</span></div></div></div></section>;
}

function AlertCard({ item }) {
  const tones = { success: { bg: "#ECFDF5", border: "#86EFAC", text: "#166534", label: "Update" }, info: { bg: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8", label: "Info" }, warning: { bg: "#FFFBEB", border: "#FCD34D", text: "#B45309", label: "Attention" }, error: { bg: "#FEF2F2", border: "#FCA5A5", text: "#B91C1C", label: "Urgent" } }[item.type];
  return <div style={{ border: `1px solid ${tones.border}`, backgroundColor: tones.bg, color: tones.text, borderRadius: 10, padding: "10px 12px" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><strong>{tones.label}:</strong> {item.message}</div><div style={{ fontSize: 12 }}>{item.time}</div></div></div>;
}

function MiniStat({ title, value }) { return <div style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "7px 8px" }}><div style={{ color: COLORS.skyText, fontSize: 11 }}>{title}</div><div style={{ fontSize: 12, fontWeight: 800, marginTop: 2 }}>{value}</div></div>; }
function TabBtn({ active, onClick, children }) { return <button type="button" onClick={onClick} style={{ border: "none", borderRadius: 999, padding: "8px 8px", fontWeight: 700, fontSize: 12, cursor: "pointer", backgroundColor: active ? COLORS.navy : "transparent", color: active ? "white" : "#64748B" }}>{children}</button>; }
function InfoCell({ label, value, tone }) { return <div style={{ border: `1px solid ${tone?.border || "#E2E8F0"}`, backgroundColor: tone?.bg || "#F8FAFC", borderRadius: 8, padding: "9px 10px" }}><div style={{ fontSize: 11, color: "#64748B" }}>{label}</div><div style={{ marginTop: 2, fontWeight: 800, fontSize: 14, color: tone?.text || "#0F172A" }}>{value}</div></div>; }
function SummaryRow({ label, value, noBorder }) { return <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 8, padding: "8px 10px", borderBottom: noBorder ? "none" : "1px solid #E2E8F0", fontSize: 13 }}><strong style={{ color: "#334155" }}>{label}</strong><span style={{ color: "#0F172A" }}>{value}</span></div>; }
function TricolorStrip() { return <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, backgroundColor: COLORS.saffron }} /><div style={{ flex: 1, backgroundColor: "#FFFFFF" }} /><div style={{ flex: 1, backgroundColor: COLORS.green }} /></div>; }
function GovHeader({ name, clock }) { return <header style={{ backgroundColor: COLORS.navyDark, color: "white", padding: "10px 12px" }}><div style={{ maxWidth: 980, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>SQ</div><div><div style={{ fontWeight: 800, fontSize: 18 }}>SwasthyaQueue</div><div style={{ fontSize: 12, color: COLORS.skyText }}>National Health Authority | OPD Queue Management System</div></div></div><div style={{ fontSize: 12, color: COLORS.skyText, fontWeight: 700 }}>Patient Dashboard | {name} | {clock}</div></div></header>; }
function GovFooter() { return <footer style={{ backgroundColor: COLORS.navyDark, color: COLORS.skyText, padding: "10px 12px", fontSize: 12 }}><div style={{ maxWidth: 980, margin: "0 auto", textAlign: "center" }}>Copyright 2026 SwasthyaQueue | Government Hospital OPD Digital Queue System</div></footer>; }
