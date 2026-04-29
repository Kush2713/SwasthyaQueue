import { useCallback, useEffect, useMemo, useState } from "react";
import { TIMING } from "../../lib/timing";

const COLORS = {
  pageBg: "#EEF2F7",
  cardBg: "#FFFFFF",
  cardBorder: "#CBD5E1",
  headerBg: "#002060",
  white: "#FFFFFF",
  sky: "#A8C8FF",
  saffron: "#FF9933",
  liveGreen: "#138808",
  critical: "#DC2626",
  high: "#D97706",
  normal: "#166534",
};

const PRIORITY_META = {
  critical: { color: COLORS.critical, label: "CRITICAL" },
  high: { color: COLORS.high, label: "HIGH" },
  normal: { color: COLORS.normal, label: "NORMAL" },
};

const TICKER_MESSAGES = [
  "Please remain seated. Queue data refreshes automatically from the hospital system.",
  "Emergency and critical cases may be prioritized by staff.",
  "Keep your token ready and watch the department card for your turn.",
  "Backend and queue updates are live from SwasthyaQueue.",
];

function formatClock(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatDateLine(date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function rankPriority(priority) {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  return 2;
}

function departmentShortCode(name) {
  const normalized = String(name || "").toLowerCase();
  if (normalized.includes("general")) return "GM";
  if (normalized.includes("cardio")) return "CD";
  if (normalized.includes("ortho")) return "OR";
  if (normalized.includes("pedia")) return "PD";
  if (normalized.includes("emerg")) return "EM";
  return "OPD";
}

function compactToken(departmentName, row) {
  if (!row) return "-";
  const tokenNumber = Number(row.token_number);
  if (!Number.isFinite(tokenNumber) || tokenNumber <= 0) return "-";
  return `${departmentShortCode(departmentName)}-${tokenNumber}`;
}

export default function LiveQueueDisplay() {
  const [departments, setDepartments] = useState([]);
  const [clock, setClock] = useState(new Date());
  const [livePulse, setLivePulse] = useState(true);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [screenState, setScreenState] = useState("loading");
  const [loadError, setLoadError] = useState("");

  const loadDisplayData = useCallback(async () => {
    setLoadError("");

    try {
      const { getDepartments, getQueueByDepartment, normalizePriority } = await import("../../lib/api");
      const departmentRows = await getDepartments();
      const queueLists = await Promise.all(
        departmentRows.map(async (department) => ({
          department,
          queue: await getQueueByDepartment(department.department_id),
        }))
      );

      const loadedDepartments = queueLists.map(({ department, queue }) => {
        const waitingQueue = queue.filter((item) => item.status === "waiting");
        const inProgress = queue.find((item) => item.status === "in-progress");
        const current = inProgress || waitingQueue[0] || queue[0] || null;
        const next = inProgress ? waitingQueue[0] : waitingQueue[1] || waitingQueue[0] || null;
        const priority = normalizePriority(current?.priority_level || next?.priority_level || 3);

        return {
          id: String(department.department_id),
          name: department.name,
          currentToken: compactToken(department.name, current),
          nextToken: next ? compactToken(department.name, next) : null,
          waiting: waitingQueue.length,
          priority,
          open: true,
          room: `Avg consult ${department.avg_consult_time} min`,
        };
      });

      setDepartments(loadedDepartments);
      setScreenState(loadedDepartments.length ? "ready" : "empty");
    } catch (error) {
      setLoadError(error.message || "Unable to load live queue feed right now.");
      setScreenState("error");
    }
  }, []);

  const openDepartments = useMemo(() => departments.filter((department) => department.open), [departments]);
  const featuredDepartment = useMemo(() => {
    const sorted = [...openDepartments].sort((a, b) => rankPriority(a.priority) - rankPriority(b.priority));
    return sorted[0] || departments[0] || null;
  }, [openDepartments, departments]);

  const stats = useMemo(() => {
    const waitingNow = departments.reduce((sum, department) => sum + department.waiting, 0);
    const activeCalls = departments.filter((department) => department.currentToken !== "-").length;
    const criticalCount = departments.filter((department) => department.priority === "critical").length;
    return {
      waitingNow,
      activeCalls,
      criticalCount,
      deptsOpen: departments.length,
    };
  }, [departments]);

  const recentlyCalled = useMemo(
    () =>
      [...departments]
        .filter((department) => department.currentToken !== "-")
        .sort((a, b) => rankPriority(a.priority) - rankPriority(b.priority))
        .slice(0, 6)
        .map((department) => ({ token: department.currentToken, dept: department.name })),
    [departments]
  );

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setScreenState("loading");
    loadDisplayData();
  }, [loadDisplayData]);

  useEffect(() => {
    if (screenState !== "ready") return;
    const id = setInterval(() => setLivePulse((prev) => !prev), 900);
    return () => clearInterval(id);
  }, [screenState]);

  useEffect(() => {
    if (screenState !== "ready") return;
    const id = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % TICKER_MESSAGES.length);
    }, 6000);
    return () => clearInterval(id);
  }, [screenState]);

  useEffect(() => {
    if (screenState !== "ready") return;
    const id = setInterval(() => {
      loadDisplayData();
    }, TIMING.displayPollMs);
    const onFocus = () => {
      loadDisplayData();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [screenState, loadDisplayData]);

  if (screenState === "loading") {
    return <DisplayShell clock={clock} livePulse={livePulse}><DisplayStateCard title="Loading live queue" description="Fetching department queue data from the backend." /></DisplayShell>;
  }

  if (screenState === "error") {
    return <DisplayShell clock={clock} livePulse={livePulse}><DisplayStateCard title="Live feed unavailable" description={loadError} actionLabel="Retry Feed" onAction={loadDisplayData} /></DisplayShell>;
  }

  if (screenState === "empty") {
    return <DisplayShell clock={clock} livePulse={livePulse}><DisplayStateCard title="No departments found" description="The queue board will appear here once departments are available." actionLabel="Refresh Feed" onAction={loadDisplayData} /></DisplayShell>;
  }

  return (
    <div style={{ height: "100vh", background: COLORS.pageBg, color: "#0F172A", display: "flex", flexDirection: "column", fontFamily: "Segoe UI, Tahoma, sans-serif", overflow: "hidden" }}>
      <DisplayHeader clock={clock} livePulse={livePulse} />
      <TricolorStrip />

      <main style={{ flex: 1, display: "grid", gridTemplateRows: "auto 1fr", gap: 10, padding: 10, minHeight: 0 }}>
        <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 10, minHeight: 0 }}>
          <NowCallingCard department={featuredDepartment} />
          <div style={{ display: "grid", gridTemplateRows: "auto auto", gap: 10, minHeight: 0 }}>
            <section style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              <StatBox label="WAITING NOW" value={stats.waitingNow} valueColor={COLORS.saffron} />
              <StatBox label="ACTIVE CALLS" value={stats.activeCalls} valueColor={COLORS.sky} />
              <StatBox label="CRITICAL" value={stats.criticalCount} valueColor={COLORS.critical} />
              <StatBox label="DEPARTMENTS" value={stats.deptsOpen} valueColor={COLORS.liveGreen} />
            </section>

            <section style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: COLORS.sky, marginBottom: 8, letterSpacing: 1 }}>CURRENT CALLS</div>
              {recentlyCalled.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(140px, 1fr))", gap: 8 }}>
                  {recentlyCalled.map((item, index) => (
                    <div key={`${item.dept}-${item.token}-${index}`} style={{ border: `1px solid ${index === 0 ? COLORS.saffron : "rgba(255,255,255,0.25)"}`, borderRadius: 10, padding: "8px 6px", textAlign: "center", color: index === 0 ? COLORS.saffron : "rgba(255,255,255,0.7)" }}>
                      <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 28 }}>{item.token}</div>
                      <div style={{ fontSize: 12, marginTop: 3 }}>{item.dept}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <DisplayInlineEmpty title="No active tokens" description="Tokens being called will appear here." />
              )}
            </section>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, alignContent: "stretch", minHeight: 0 }}>
          {departments.map((department) => <DepartmentCard key={department.id} department={department} />)}
        </section>

      </main>

      <TickerBar message={TICKER_MESSAGES[tickerIndex]} />
      <TricolorStrip />
    </div>
  );
}

function DisplayShell({ clock, livePulse, children }) {
  return <div style={{ minHeight: "100vh", background: COLORS.pageBg, color: "#0F172A", display: "flex", flexDirection: "column", fontFamily: "Segoe UI, Tahoma, sans-serif" }}><DisplayHeader clock={clock} livePulse={livePulse} /><TricolorStrip /><main style={{ flex: 1, display: "grid", placeItems: "center", padding: 16 }}>{children}</main><TickerBar message="SwasthyaQueue live display is preparing the latest queue feed." /><TricolorStrip /></div>;
}

function DisplayStateCard({ title, description, actionLabel, onAction }) {
  return <section style={{ width: "min(640px, 100%)", border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, background: COLORS.cardBg, padding: 28, textAlign: "center", boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}><div style={{ width: 60, height: 60, margin: "0 auto 14px", borderRadius: "50%", background: "#E2E8F0" }} /><h2 style={{ margin: 0, fontSize: 28, color: "#0F172A" }}>{title}</h2><p style={{ margin: "10px 0 0", color: "#64748B", lineHeight: 1.7 }}>{description}</p>{actionLabel ? <button type="button" onClick={onAction} style={{ marginTop: 18, border: "none", borderRadius: 8, background: "#003580", color: "#fff", padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>{actionLabel}</button> : null}</section>;
}

function DisplayInlineEmpty({ title, description }) {
  return <div style={{ padding: 18, textAlign: "center", color: COLORS.sky }}><div style={{ color: COLORS.white, fontWeight: 800 }}>{title}</div><div style={{ marginTop: 6, fontSize: 12 }}>{description}</div></div>;
}

function DisplayHeader({ clock, livePulse }) {
  return <header style={{ background: COLORS.headerBg, color: "#fff", padding: "10px 16px", borderBottom: `1px solid rgba(255,255,255,0.2)`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke={COLORS.saffron} strokeWidth="2.4" strokeLinecap="round" /></svg></div><div><div style={{ fontSize: 22, fontWeight: 900 }}>Government District Hospital</div><div style={{ fontSize: 13, color: COLORS.sky }}>SwasthyaQueue | OPD Queue Display</div></div></div><div style={{ textAlign: "right" }}><div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.liveGreen, boxShadow: livePulse ? `0 0 0 6px rgba(19,136,8,0.18)` : "none", transition: "box-shadow 0.25s ease" }} /><span style={{ color: "#86EFAC", fontWeight: 900, fontSize: 13 }}>LIVE</span></div><div style={{ fontSize: 26, fontFamily: "monospace", fontWeight: 900, marginTop: 2 }}>{formatClock(clock)}</div><div style={{ fontSize: 12, color: COLORS.sky }}>{formatDateLine(clock)}</div></div></header>;
}

function NowCallingCard({ department }) {
  if (!department) return <section style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14 }}><DisplayInlineEmpty title="No featured department" description="A live department will appear here when queue data becomes available." /></section>;
  const priority = PRIORITY_META[department.priority];
  return <section style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderLeft: `5px solid ${priority.color}`, borderRadius: 14, padding: 14 }}><div style={{ fontSize: 13, color: "#64748B", fontWeight: 800, letterSpacing: 1 }}>NOW CALLING</div><div style={{ marginTop: 8, fontSize: 72, fontFamily: "monospace", fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{department.currentToken}</div><div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0F172A" }}>{department.name}</div><div style={{ marginTop: 3, fontSize: 14, color: "#64748B" }}>{department.room}</div><div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${priority.color}55`, borderRadius: 999, padding: "5px 10px", color: priority.color, fontSize: 13, fontWeight: 800, background: "#F8FAFC" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: priority.color }} />{priority.label}</div></section>;
}

function DepartmentCard({ department }) {
  const priority = PRIORITY_META[department.priority];
  return <section style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 12, padding: 12, minHeight: 0 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>{department.name}</div><div style={{ fontSize: 11, fontWeight: 700, color: "#166534", border: `1px solid #BBF7D0`, background: "#F0FDF4", borderRadius: 999, padding: "3px 8px" }}>OPEN</div></div><div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 10 }}><div><div style={{ fontSize: 11, color: "#64748B" }}>CURRENT TOKEN</div><div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 40, color: "#0F172A", lineHeight: 1 }}>{department.currentToken}</div></div>{department.nextToken ? <div style={{ borderLeft: "1px solid #E2E8F0", paddingLeft: 10, alignSelf: "end" }}><div style={{ fontSize: 10, color: "#64748B" }}>UP NEXT</div><div style={{ fontFamily: "monospace", fontSize: 24, color: "#334155", fontWeight: 800, lineHeight: 1.1 }}>{department.nextToken}</div></div> : null}</div><div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div style={{ color: priority.color, fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: priority.color }} />{priority.label}</div><div style={{ border: "1px solid #E2E8F0", borderRadius: 999, padding: "5px 10px", fontSize: 12, color: "#334155", fontWeight: 800, background: "#F8FAFC" }}>{department.waiting} waiting</div></div></section>;
}

function TickerBar({ message }) {
  return <section style={{ background: "#FFFFFF", borderTop: `1px solid ${COLORS.cardBorder}`, borderBottom: `1px solid ${COLORS.cardBorder}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 12, padding: "8px 12px" }}><div style={{ background: "#FFEDD5", color: "#9A3412", borderRadius: 999, padding: "4px 9px", fontSize: 12, fontWeight: 800, letterSpacing: 0.4 }}>NOTICE</div><div style={{ color: "#475569", fontSize: 14, fontWeight: 600 }}>{message}</div><div style={{ color: "#64748B", fontSize: 12 }}>SwasthyaQueue v1.0</div></section>;
}

function StatBox({ label, value, valueColor }) {
  return <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 11px", background: "#fff" }}><div style={{ fontFamily: "monospace", fontSize: 34, fontWeight: 900, color: valueColor, lineHeight: 1 }}>{value}</div><div style={{ marginTop: 5, fontSize: 11, color: "#64748B", letterSpacing: 0.4, fontWeight: 700 }}>{label}</div></div>;
}

function TricolorStrip() {
  return <div style={{ display: "flex", height: 4 }}><div style={{ flex: 1, background: COLORS.saffron }} /><div style={{ flex: 1, background: "#FFFFFF" }} /><div style={{ flex: 1, background: COLORS.liveGreen }} /></div>;
}
