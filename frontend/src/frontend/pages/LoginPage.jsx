import { useState } from "react";

const MOCK_USERS = {
  patient01: { password: "pass123", role: "patient", name: "Rahul Kumar", id: "P001" },
  patient02: { password: "pass456", role: "patient", name: "Priya Sharma", id: "P002" },
  staff01: {
    password: "staff123",
    role: "staff",
    name: "Anita Reddy",
    id: "S001",
    designation: "Receptionist",
  },
  doctor01: {
    password: "doc123",
    role: "staff",
    name: "Dr. S. Mehta",
    id: "D001",
    designation: "Doctor | General Medicine",
  },
};

const labelStyle = "mb-1.5 block text-sm font-semibold text-slate-700";
const inputStyle =
  "w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#0050A8] focus:ring-2 focus:ring-[#0050A8]/20";

const demoRows = [
  { userId: "patient01", password: "pass123" },
  { userId: "patient02", password: "pass456" },
  { userId: "staff01", password: "staff123" },
  { userId: "doctor01", password: "doc123" },
];

export default function LoginPage({ onLogin }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggedInUser, setLoggedInUser] = useState(null);


  const handleDemoAutofill = (demoUserId, demoPassword) => {
    setUserId(demoUserId);
    setPassword(demoPassword);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!userId.trim() || !password.trim()) {
      setError("Please enter your User ID and Password to continue.");
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 900));

    const key = userId.trim().toLowerCase();
    const matchedUser = MOCK_USERS[key];

    // TODO: Replace with real API call
    // const res = await fetch('/api/auth/login', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ userId, password })
    // })
    // const user = await res.json()

    if (!matchedUser || matchedUser.password !== password.trim()) {
      setLoading(false);
      setError("Invalid User ID or Password. Please check and try again.");
      return;
    }

    const user = { ...matchedUser, userId: key };
    setLoggedInUser(user);
    setLoading(false);

    if (typeof onLogin === "function") {
      onLogin(user);
    }
  };


  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <TricolorStrip />
      <GovHeader />

      <main className="px-4 py-10">
        <div className="mx-auto w-full max-w-[430px]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <div className="bg-[#003580] px-6 py-4">
              <h1 className="text-[19px] font-bold text-white">Sign In</h1>
              <p className="mt-1 text-[13px] text-[#A8C8FF]">SwasthyaQueue | Hospital Access</p>
            </div>

            <div className="px-6 py-5">
              {loggedInUser ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                    OK
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Login Successful</h2>
                  <p className="mt-1 text-slate-700">{loggedInUser.name}</p>

                  <p className="mt-3 text-sm text-slate-600">
                    Redirecting to your dashboard...
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {loggedInUser.id}
                    {loggedInUser.designation ? ` | ${loggedInUser.designation}` : ""}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#DC2626]">
                      {error}
                    </div>
                  ) : null}


                  <div>
                    <label htmlFor="user-id" className={labelStyle}>
                      User ID *
                    </label>
                    <input
                      id="user-id"
                      type="text"
                      className={inputStyle}
                      placeholder="e.g. patient01 | staff01 | doctor01"
                      value={userId}
                      onChange={(event) => setUserId(event.target.value)}
                      autoComplete="username"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className={labelStyle}>
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        className={`${inputStyle} pr-20`}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handleSubmit(event);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-bold tracking-wide text-[#003580] hover:bg-slate-100"
                      >
                        {showPassword ? "HIDE" : "SHOW"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${
                      loading ? "cursor-not-allowed bg-slate-400" : "bg-[#003580] hover:bg-[#0050A8]"
                    }`}
                  >
                    {loading ? "Verifying..." : "Sign In"}
                  </button>

                  <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-3.5">
                    <h3 className="text-[11px] font-bold tracking-wide text-slate-600">DEMO CREDENTIALS</h3>
                    <div className="mt-2 space-y-2">
                      {demoRows.map(({ userId: demoUserId, password: demoPassword }) => (
                        <button
                          type="button"
                          key={demoUserId}
                          onClick={() => handleDemoAutofill(demoUserId, demoPassword)}
                          className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <span className="font-mono text-xs text-slate-700">
                            {demoUserId} / {demoPassword}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            demo
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-center text-[11px] text-slate-500">
                      Click any row to autofill.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </section>

          <div className="mt-4 text-center text-sm text-slate-600">
            <p>For login issues, contact your Hospital IT Administrator</p>
            <p className="mt-1 font-bold text-[#003580]">helpdesk@swasthyaqueue.gov.in</p>
          </div>
        </div>
      </main>

      <GovFooter />
    </div>
  );
}

function TricolorStrip() {
  return (
    <div className="flex h-[5px] w-full">
      <div className="w-1/3 bg-[#FF9933]" />
      <div className="w-1/3 bg-white" />
      <div className="w-1/3 bg-[#138808]" />
    </div>
  );
}

function GovHeader() {
  return (
    <header className="bg-[#002060] text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/10 text-sm font-bold">
            SQ
          </div>
          <div>
            <p className="font-[family-name:var(--font-space-grotesk)] text-lg font-bold">SwasthyaQueue</p>
            <p className="text-xs text-[#A8C8FF]">National Health Authority | OPD Queue Management System</p>
          </div>
        </div>
        <p className="text-xs text-[#A8C8FF] sm:text-right">
          District Government Hospital | Amaravati, Andhra Pradesh | 522237
        </p>
      </div>
    </header>
  );
}

function GovFooter() {
  return (
    <footer className="bg-[#002060]">
      <div className="mx-auto max-w-7xl px-4 py-3 text-center text-xs text-[#A8C8FF] sm:px-6">
        Copyright 2026 SwasthyaQueue | Government of India Health Technology Initiative
      </div>
    </footer>
  );
}

