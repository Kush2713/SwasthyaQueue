import { useCallback, useEffect, useMemo, useState } from "react";

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

export default function StaffDashboard({ user, onLogout }) {
  const [patients, setPatients] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [clock, setClock] = useState(clockText());
  const [deptFilter, setDeptFilter] = useState("All");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [toast, setToast] = useState("");
  const [screenState, setScreenState] = useState("loading");
  const [loadError, setLoadError] = useState("");

  const loadDashboardData = useCallback(async () => {
    setLoadError("");

    try {
      const { getDepartments, getQueueByDepartment, getQueueStats, normalizePriority } = await import("../../lib/api");
      const departmentRows = await getDepartments();
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
          token: patient.token_number,
          name: patient.name,
          age: patient.age ?? "-",
          mobile: patient.phone ?? "",
          department: department.name,
          departmentId: department.department_id,
          priority: normalizePriority(patient.priority_level),
          priorityLevel: patient.priority_level,
          waitMins: patient.estimated_wait_time ?? 0,
          status: statusLabel(patient.status),
          rawStatus: patient.status,
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
  }, []);

  useEffect(() => {
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
    }, 15000);
    return () => clearInterval(timer);
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
        .filter((patient) => patient.rawStatus === "waiting")
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

  const pushToast = (message) => setToast(message);

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

  const runLookup = () => {
    const query = lookupQuery.trim().toLowerCase();
    if (!query) {
      setLookupResult(null);
      return;
    }
    const byToken = Number(query);
    const found = patients.find((patient) => patient.token === byToken || patient.name?.toLowerCase().includes(query));
    setLookupResult(found || null);
    pushToast(found ? `Patient found: Token #${found.token}` : "No matching patient found.");
  };

  if (screenState === "loading") return <PageShell name={user?.name || "Staff"} clock={clock}><StateCard title="Loading staff console" description="Fetching queue status and patient records from the backend." /></PageShell>;
  if (screenState === "error") return <PageShell name={user?.name || "Staff"} clock={clock}><StateCard title="Unable to load console" description={loadError} actionLabel="Try Again" onAction={loadDashboardData} /></PageShell>;
  if (screenState === "empty") return <PageShell name={user?.name || "Staff"} clock={clock}><StateCard title="No patients in queue" description="Registrations and queue activity will appear here once patients are added." actionLabel="Refresh Data" onAction={loadDashboardData} /></PageShell>;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.pageBg }}>
      <TricolorStrip />
      <GovHeader name={user?.name || "Staff"} clock={clock} />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "14px 12px 24px" }}>
        <section style={{ background: COLORS.navy, color: "#fff", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ color: COLORS.skyText, fontSize: 12 }}>Staff Console</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{user?.name || "Reception Staff"}</div>
              <div style={{ color: COLORS.skyText, fontSize: 12 }}>{clock}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(78px, 1fr))", gap: 8, minWidth: 320 }}>
              <MiniStat title="Waiting" value={kpis.waiting} />
              <MiniStat title="Critical" value={kpis.criticalWait} />
              <MiniStat title="In Room" value={kpis.inConsult} />
              <MiniStat title="Done" value={kpis.completed} />
            </div>
          </div>
        </section>

        <TabsBar activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "overview" ? (
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
                          {patient.rawStatus === "waiting" ? <button type="button" onClick={() => callIn(patient.departmentId)} style={{ border: "none", borderRadius: 7, padding: "7px 10px", background: COLORS.navy, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Call Next</button> : null}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12 }}><PriorityPill priority={patient.priority} /></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <InlineEmpty title="No urgent cases right now" description="Waiting patients will appear here automatically." />
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
              {queueRows.length ? queueRows.map((patient) => <QueueManagerRow key={patient.id} patient={patient} onCall={() => callIn(patient.departmentId)} onComplete={() => complete(patient.queueId)} />) : <InlineEmpty title="No patients in this department" description="Try a different filter or wait for new registrations." />}
            </section>
          </section>
        ) : null}

        {activeTab === "lookup" ? (
          <section style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={lookupQuery} onChange={(event) => setLookupQuery(event.target.value)} onKeyDown={(event) => (event.key === "Enter" ? runLookup() : null)} placeholder="Search by token or patient name" style={{ flex: 1, border: "1px solid #CBD5E1", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none" }} />
              <button type="button" onClick={runLookup} style={{ border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", fontWeight: 700, padding: "10px 14px", cursor: "pointer" }}>Search</button>
            </div>

            {lookupResult ? (
              <section style={{ border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                <div style={{ background: COLORS.navy, color: "#fff", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{lookupResult.name}</strong>
                  <div style={{ color: COLORS.skyText, fontSize: 12 }}>Token #{lookupResult.token} | {lookupResult.department}</div>
                  <PriorityPill priority={lookupResult.priority} />
                </div>
                <div style={{ padding: 10, display: "grid", gridTemplateColumns: "repeat(2, minmax(160px,1fr))", gap: 8 }}>
                  <InfoBox label="Queue ID" value={lookupResult.queueId} />
                  <InfoBox label="Department" value={lookupResult.department} />
                  <InfoBox label="Priority" value={lookupResult.priority} />
                  <InfoBox label="Status" value={lookupResult.status} />
                  <InfoBox label="Estimated Wait" value={`${lookupResult.waitMins} min`} />
                  <InfoBox label="Registered At" value={lookupResult.registeredAt} />
                </div>
                <div style={{ padding: "0 10px 10px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {lookupResult.rawStatus === "waiting" ? <button type="button" onClick={() => callIn(lookupResult.departmentId)} style={btnPrimary}>Call Next In Department</button> : null}
                  {lookupResult.rawStatus === "in-progress" ? <button type="button" onClick={() => complete(lookupResult.queueId)} style={{ ...btnPrimary, background: COLORS.green }}>Complete</button> : null}
                </div>
              </section>
            ) : (
              <InlineEmpty title="Search for a patient" description="Use token number or patient name to find the patient record." />
            )}
          </section>
        ) : null}

        {activeTab === "overrides" ? (
          <section style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <section style={{ border: "1px solid #FCD34D", background: "#FFFBEB", color: "#92400E", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.6 }}>
              The current backend does not support manual priority overrides yet. This tab is intentionally read-only so the frontend matches the backend behavior.
            </section>
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

function PageShell({ name, clock, children }) {
  return <div style={{ minHeight: "100vh", background: COLORS.pageBg }}><TricolorStrip /><GovHeader name={name} clock={clock} /><main style={{ maxWidth: 880, margin: "0 auto", padding: "14px 12px 24px" }}>{children}</main><GovFooter /></div>;
}

function StateCard({ title, description, actionLabel, onAction }) {
  return <section style={{ border: "1px solid #CBD5E1", borderRadius: 12, background: "#fff", padding: 24, textAlign: "center" }}><div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E2E8F0", margin: "0 auto 12px" }} /><h2 style={{ margin: 0, fontSize: 22, color: "#0F172A" }}>{title}</h2><p style={{ margin: "8px 0 0", color: "#64748B", lineHeight: 1.6 }}>{description}</p>{actionLabel ? <button type="button" onClick={onAction} style={{ marginTop: 16, border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>{actionLabel}</button> : null}</section>;
}

function InlineEmpty({ title, description }) {
  return <div style={{ padding: 20, textAlign: "center", color: "#64748B" }}><div style={{ fontWeight: 800, color: "#0F172A" }}>{title}</div><div style={{ marginTop: 6, fontSize: 13 }}>{description}</div></div>;
}

function TabsBar({ activeTab, onChange }) {
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "queue", label: "Queue Manager" },
    { key: "lookup", label: "Patient Lookup" },
    { key: "overrides", label: "Overrides" },
    { key: "analytics", label: "Analytics" },
  ];
  return <section style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", background: "#fff", border: "1px solid #CBD5E1", borderRadius: 999, padding: 4, gap: 2 }}>{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => onChange(tab.key)} style={{ border: "none", borderRadius: 999, padding: "8px 8px", cursor: "pointer", fontWeight: 700, fontSize: 12, background: activeTab === tab.key ? COLORS.navy : "transparent", color: activeTab === tab.key ? "#fff" : "#64748B" }}>{tab.label}</button>)}</section>;
}

function KpiCard({ value, label, color }) { return <div style={{ background: "#fff", border: "1px solid #CBD5E1", borderRadius: 10, padding: 10 }}><div style={{ fontFamily: "monospace", fontSize: 26, fontWeight: 900, color }}>{value}</div><div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{label}</div></div>; }
function Card({ title, count, countColor, children }) { return <section style={{ border: "1px solid #CBD5E1", borderRadius: 10, overflow: "hidden", background: "#fff" }}><div style={{ background: COLORS.navy, color: "#fff", padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><strong>{title}</strong>{typeof count === "number" ? <span style={{ background: "#fff", color: countColor || COLORS.navy, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>{count}</span> : null}</div><div style={{ padding: 10 }}>{children}</div></section>; }
function MiniStat({ title, value }) { return <div style={{ border: "1px solid rgba(255,255,255,.25)", borderRadius: 8, padding: "8px 9px" }}><div style={{ fontSize: 11, color: COLORS.saffron }}>{title}</div><div style={{ fontSize: 14, fontWeight: 900, color: COLORS.skyText, marginTop: 2 }}>{value}</div></div>; }
function PriorityPill({ priority }) { const tone = priority === "critical" ? { bg: "#FEE2E2", color: "#B91C1C", label: "Critical" } : priority === "high" ? { bg: "#FEF3C7", color: "#B45309", label: "High" } : { bg: "#DCFCE7", color: "#166534", label: "Normal" }; return <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: "3px 8px", fontSize: 12, fontWeight: 700 }}>{tone.label}</span>; }
function QueueManagerRow({ patient, onCall, onComplete }) { const left = patient.priority === "critical" ? "#DC2626" : patient.priority === "high" ? "#D97706" : "transparent"; const rowBg = patient.status === "in-consultation" ? "#ECFDF5" : patient.status === "completed" ? "#F1F5F9" : "#FFFFFF"; return <div style={{ display: "grid", gridTemplateColumns: "72px 1.8fr 1.2fr 1fr 1fr 1fr", gap: 8, alignItems: "center", borderBottom: "1px solid #E2E8F0", borderLeft: `4px solid ${left}`, background: rowBg, padding: "9px 10px", fontSize: 12 }}><div style={{ fontFamily: "monospace", fontWeight: 800 }}>#{patient.token}</div><div><div style={{ fontWeight: 700 }}>{patient.name}</div><div style={{ color: "#64748B" }}>Queue #{patient.queueId}</div></div><div>{patient.department}</div><div><PriorityPill priority={patient.priority} /></div><div>{patient.waitMins} min</div><div>{patient.rawStatus === "waiting" ? <button type="button" onClick={onCall} style={{ ...btnPrimary, padding: "6px 9px", fontSize: 12 }}>Call Next</button> : patient.rawStatus === "in-progress" ? <button type="button" onClick={onComplete} style={{ ...btnPrimary, background: COLORS.green, padding: "6px 9px", fontSize: 12 }}>Complete</button> : <span style={{ color: "#64748B", fontWeight: 700 }}>Done</span>}</div></div>; }
function InfoBox({ label, value }) { return <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, background: "#F8FAFC", padding: "8px 9px" }}><div style={{ fontSize: 11, color: "#64748B" }}>{label}</div><div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>{value}</div></div>; }
function TricolorStrip() { return <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, background: COLORS.saffron }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: COLORS.green }} /></div>; }
function GovHeader({ name, clock }) { return <header style={{ background: COLORS.navyDark, color: "#fff", padding: "10px 12px" }}><div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>SQ</div><div><div style={{ fontWeight: 800, fontSize: 18 }}>SwasthyaQueue</div><div style={{ color: COLORS.skyText, fontSize: 12 }}>Staff Console | Current Backend API</div></div></div><div style={{ fontSize: 12, color: COLORS.skyText, fontWeight: 700 }}>{name} | {clock}</div></div></header>; }
function GovFooter() { return <footer style={{ background: COLORS.navyDark, color: COLORS.skyText, fontSize: 12, padding: "10px 12px" }}><div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>Copyright 2026 SwasthyaQueue | Government Hospital OPD Digital Queue System</div></footer>; }
