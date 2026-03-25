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

export default function PatientTokenPage({ tokenData, onBack, onProceed }) {
  if (!tokenData) return null;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.pageBg }}>
      <TricolorStrip />
      <GovHeader />
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "16px 12px 24px" }}>
        <section style={{ border: "1px solid #CBD5E1", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ background: COLORS.navy, color: "#fff", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800 }}>{tokenData.department}</div>
              <div style={{ color: COLORS.skyText, fontSize: 12 }}>Token generated successfully</div>
            </div>
            <div style={{ background: COLORS.saffron, color: "#4A2500", borderRadius: 999, padding: "5px 12px", fontFamily: "monospace", fontWeight: 900 }}>
              #{tokenData.token}
            </div>
          </div>

          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A" }}>{tokenData.patientName}</div>
            <div style={{ color: "#64748B", fontSize: 13, marginTop: 6 }}>Please keep this token ready and follow the display board or staff instructions.</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(120px,1fr))", gap: 8, marginTop: 12 }}>
              <Info label="Estimated Wait" value={`${tokenData.estimatedWait} min`} />
              <Info label="Position in Queue" value={tokenData.position} />
              <Info label="Department" value={tokenData.department} />
              <Info label="Registered At" value={tokenData.registeredAt} />
            </div>

            {tokenData.preferredSlot ? (
              <div style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#334155", borderRadius: 8, padding: "10px 12px", marginTop: 10, fontSize: 13 }}>
                Preferred slot noted: {new Date(tokenData.preferredSlot).toLocaleString("en-IN")}
              </div>
            ) : null}

            <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 8, padding: "10px 12px", marginTop: 10, fontSize: 13 }}>
              SMS alert will be sent to {formatIndianMobile(tokenData.mobile)} when your turn is near.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" onClick={onProceed} style={btnPrimary}>Go to Dashboard</button>
            </div>
          </div>
        </section>
      </main>
      <GovFooter />
    </div>
  );
}

function Info({ label, value }) {
  return <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, background: "#F8FAFC", padding: "9px 10px" }}><div style={{ fontSize: 11, color: "#64748B" }}>{label}</div><div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{value}</div></div>;
}

const btnPrimary = { border: "none", borderRadius: 8, background: COLORS.navy, color: "#fff", fontWeight: 700, padding: "10px 14px", cursor: "pointer" };
const btnGhost = { border: "1px solid #CBD5E1", borderRadius: 8, background: "#fff", color: "#334155", fontWeight: 700, padding: "10px 14px", cursor: "pointer" };

function TricolorStrip() {
  return <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, background: COLORS.saffron }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: COLORS.green }} /></div>;
}

function GovHeader() {
  return <header style={{ background: COLORS.navyDark, color: "#fff", padding: "10px 12px" }}><div style={{ maxWidth: 880, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>SQ</div><div><div style={{ fontWeight: 800, fontSize: 18 }}>SwasthyaQueue</div><div style={{ color: COLORS.skyText, fontSize: 12 }}>Patient Token Confirmation</div></div></div></div></header>;
}

function GovFooter() {
  return <footer style={{ background: COLORS.navyDark, color: COLORS.skyText, fontSize: 12, padding: "10px 12px", textAlign: "center" }}>Copyright 2026 SwasthyaQueue | Government Hospital OPD Digital Queue System</footer>;
}
