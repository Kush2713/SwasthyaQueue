import { useCallback, useEffect, useMemo, useState } from "react";

const COLORS = {
  pageBg: "#001030",
  cardBg: "#002060",
  cardBorder: "#003580",
  headerBg: "#001845",
  white: "#FFFFFF",
  sky: "#6B9DC8",
  saffron: "#FF9933",
  liveGreen: "#22C55E",
  critical: "#FF4444",
  high: "#FFB020",
  normal: "#22C55E",
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
          currentToken: current?.token_label || (current?.token_number ? `#${current.token_number}` : "-"),
          nextToken: next?.token_label || (next?.token_number ? `#${next.token_number}` : null),
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
    const interval = setInterval(() => {
      loadDisplayData();
    }, 10000);
    const onFocus = () => {
      loadDisplayData();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
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
    <div style={{ minHeight: "100vh", background: COLORS.pageBg, color: COLORS.white, display: "flex", flexDirection: "column", fontFamily: "Segoe UI, Tahoma, sans-serif" }}>
      <DisplayHeader clock={clock} livePulse={livePulse} />
      <TricolorStrip />

      <main style={{ flex: 1, display: "grid", gridTemplateRows: "auto 1fr", gap: 12, padding: 12 }}>
        <section style={{ display: "grid", gridTemplateColumns: "1fr 2.2fr", gap: 12 }}>
          <NowCallingCard department={featuredDepartment} />
          <div style={{ display: "grid", gridTemplateRows: "auto auto", gap: 12 }}>
            <section style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <StatBox label="WAITING NOW" value={stats.waitingNow} valueColor={COLORS.saffron} />
              <StatBox label="ACTIVE CALLS" value={stats.activeCalls} valueColor={COLORS.sky} />
              <StatBox label="CRITICAL" value={stats.criticalCount} valueColor={COLORS.critical} />
              <StatBox label="DEPARTMENTS" value={stats.deptsOpen} valueColor={COLORS.liveGreen} />
            </section>

            <section style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: COLORS.sky, marginBottom: 8, letterSpacing: 1 }}>CURRENT CALLS</div>
              {recentlyCalled.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                  {recentlyCalled.map((item, index) => (
                    <div key={`${item.dept}-${item.token}-${index}`} style={{ border: `1px solid ${index === 0 ? COLORS.saffron : "rgba(255,255,255,0.25)"}`, borderRadius: 10, padding: "8px 6px", textAlign: "center", color: index === 0 ? COLORS.saffron : "rgba(255,255,255,0.7)" }}>
                      <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 22 }}>{item.token}</div>
                      <div style={{ fontSize: 10, marginTop: 3 }}>{item.dept}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <DisplayInlineEmpty title="No active tokens" description="Tokens being called will appear here." />
              )}
            </section>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, alignContent: "start" }}>
          {departments.map((department) => <DepartmentCard key={department.id} department={department} />)}
        </section>
      </main>

      <TickerBar message={TICKER_MESSAGES[tickerIndex]} />
      <TricolorStrip />
    </div>
  );
}

function DisplayShell({ clock, livePulse, children }) {
  return <div style={{ minHeight: "100vh", background: COLORS.pageBg, color: COLORS.white, display: "flex", flexDirection: "column", fontFamily: "Segoe UI, Tahoma, sans-serif" }}><DisplayHeader clock={clock} livePulse={livePulse} /><TricolorStrip /><main style={{ flex: 1, display: "grid", placeItems: "center", padding: 16 }}>{children}</main><TickerBar message="SwasthyaQueue live display is preparing the latest queue feed." /><TricolorStrip /></div>;
}

function DisplayStateCard({ title, description, actionLabel, onAction }) {
  return <section style={{ width: "min(640px, 100%)", border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, background: COLORS.cardBg, padding: 28, textAlign: "center", boxShadow: "0 18px 44px rgba(0,0,0,0.22)" }}><div style={{ width: 60, height: 60, margin: "0 auto 14px", borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} /><h2 style={{ margin: 0, fontSize: 28 }}>{title}</h2><p style={{ margin: "10px 0 0", color: COLORS.sky, lineHeight: 1.7 }}>{description}</p>{actionLabel ? <button type="button" onClick={onAction} style={{ marginTop: 18, border: `1px solid ${COLORS.saffron}`, borderRadius: 999, background: COLORS.saffron, color: "#2A1A00", padding: "10px 18px", fontWeight: 900, cursor: "pointer" }}>{actionLabel}</button> : null}</section>;
}

function DisplayInlineEmpty({ title, description }) {
  return <div style={{ padding: 18, textAlign: "center", color: COLORS.sky }}><div style={{ color: COLORS.white, fontWeight: 800 }}>{title}</div><div style={{ marginTop: 6, fontSize: 12 }}>{description}</div></div>;
}

function DisplayHeader({ clock, livePulse }) {
  return <header style={{ background: COLORS.headerBg, padding: "10px 16px", borderBottom: `1px solid ${COLORS.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 56, height: 56, borderRadius: "50%", border: `2px solid ${COLORS.saffron}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: COLORS.saffron }}>GDH</div><div><div style={{ fontSize: 22, fontWeight: 800 }}>Government District Hospital</div><div style={{ fontSize: 12, color: COLORS.sky }}>SwasthyaQueue | OPD Queue Display</div></div></div><div style={{ textAlign: "right" }}><div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.liveGreen, boxShadow: livePulse ? `0 0 0 7px rgba(34,197,94,0.18)` : "none", transition: "box-shadow 0.25s ease" }} /><span style={{ color: COLORS.liveGreen, fontWeight: 900, letterSpacing: 1 }}>LIVE</span></div><div style={{ fontSize: 26, fontFamily: "monospace", fontWeight: 900, marginTop: 2 }}>{formatClock(clock)}</div><div style={{ fontSize: 12, color: COLORS.sky }}>{formatDateLine(clock)}</div></div></header>;
}

function NowCallingCard({ department }) {
  if (!department) return <section style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14 }}><DisplayInlineEmpty title="No featured department" description="A live department will appear here when queue data becomes available." /></section>;
  const priority = PRIORITY_META[department.priority];
  return <section style={{ background: COLORS.cardBg, border: `2px solid ${priority.color}`, boxShadow: `0 0 22px ${priority.color}45`, borderRadius: 14, padding: 14, position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", right: -28, top: -20, width: 130, height: 130, borderRadius: "50%", background: `${priority.color}10` }} /><div style={{ fontSize: 12, color: COLORS.sky, fontWeight: 700, letterSpacing: 1.2 }}>NOW CALLING</div><div style={{ marginTop: 8, fontSize: 32, fontFamily: "monospace", fontWeight: 900, color: priority.color, lineHeight: 1.15, textShadow: `0 0 18px ${priority.color}88`, wordBreak: "break-word" }}>{department.currentToken}</div><div style={{ marginTop: 4, fontSize: 17, fontWeight: 800 }}>{department.name}</div><div style={{ marginTop: 2, fontSize: 12, color: COLORS.sky }}>{department.room}</div><div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${priority.color}`, borderRadius: 999, padding: "5px 9px", color: priority.color, fontSize: 11, fontWeight: 900 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: priority.color }} />{priority.label}</div></section>;
}

function DepartmentCard({ department }) {
  const priority = PRIORITY_META[department.priority];
  return <section style={{ background: COLORS.cardBg, border: `1.5px solid ${priority.color}99`, boxShadow: `0 0 18px ${priority.color}26`, borderRadius: 12, padding: 12, position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", right: -18, top: -18, width: 90, height: 90, borderRadius: "50%", background: `${priority.color}0A` }} /><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div style={{ fontSize: 13, fontWeight: 800, color: COLORS.white }}>{department.name}</div><div style={{ fontSize: 10, fontWeight: 800, color: COLORS.liveGreen, border: `1px solid #22C55E66`, background: "#22C55E22", borderRadius: 999, padding: "3px 7px" }}>OPEN</div></div><div style={{ marginTop: 9, height: 1, background: `linear-gradient(90deg, ${priority.color}, transparent)` }} /><div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 10 }}><div><div style={{ fontSize: 9, color: COLORS.sky, letterSpacing: 1.1 }}>CURRENT TOKEN</div><div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 18, color: priority.color, lineHeight: 1.2, wordBreak: "break-word" }}>{department.currentToken}</div></div>{department.nextToken ? <div style={{ borderLeft: "1px solid #FFFFFF22", paddingLeft: 10, alignSelf: "end" }}><div style={{ fontSize: 8, color: COLORS.sky }}>UP NEXT</div><div style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 800, lineHeight: 1.2, wordBreak: "break-word" }}>{department.nextToken}</div></div> : null}</div><div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div style={{ color: priority.color, fontWeight: 700, fontSize: 10, display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: priority.color }} />{priority.label}</div><div style={{ border: `1px solid ${COLORS.saffron}55`, borderRadius: 999, padding: "3px 8px", fontSize: 11, color: COLORS.saffron, fontWeight: 800 }}>{department.waiting} waiting</div></div></section>;
}

function TickerBar({ message }) {
  return <section style={{ background: COLORS.headerBg, borderTop: `1px solid ${COLORS.cardBorder}`, borderBottom: `1px solid ${COLORS.cardBorder}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 12, padding: "8px 12px" }}><div style={{ background: COLORS.saffron, color: "#2A1A00", borderRadius: 999, padding: "4px 9px", fontSize: 11, fontWeight: 900, letterSpacing: 0.6 }}>NOTICE</div><div style={{ color: COLORS.sky, fontSize: 12 }}>{message}</div><div style={{ color: COLORS.sky, fontSize: 11 }}>SwasthyaQueue v1.0</div></section>;
}

function StatBox({ label, value, valueColor }) {
  return <div style={{ border: "1px solid #FFFFFF22", borderRadius: 10, padding: "9px 10px" }}><div style={{ fontFamily: "monospace", fontSize: 30, fontWeight: 900, color: valueColor, lineHeight: 1 }}>{value}</div><div style={{ marginTop: 4, fontSize: 9, color: COLORS.sky, letterSpacing: 1 }}>{label}</div></div>;
}

function TricolorStrip() {
  return <div style={{ display: "flex", height: 4 }}><div style={{ flex: 1, background: COLORS.saffron }} /><div style={{ flex: 1, background: "#FFFFFF" }} /><div style={{ flex: 1, background: COLORS.liveGreen }} /></div>;
}
