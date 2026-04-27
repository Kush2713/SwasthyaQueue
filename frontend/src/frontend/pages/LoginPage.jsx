import { useMemo, useState } from "react";

import {
  loginStaff,
  requestPatientOtp,
  signupPatientAccount,
  verifyPatientOtp,
} from "../lib/api";

const labelStyle = "mb-1.5 block text-sm font-semibold text-slate-700";
const inputStyle =
  "w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#0050A8] focus:ring-2 focus:ring-[#0050A8]/20";

const demoRows = [
  { userId: "receptionist01", password: "recept123" },
  { userId: "nurse01", password: "nurse123" },
  { userId: "doctor01", password: "doc123" },
];

const signupDefaults = {
  name: "",
  age: "",
  gender: "",
  mobile: "",
  email: "",
  address: "",
  emergencyContact: "",
  bloodGroup: "",
  allergies: "",
  chronicConditions: "",
};

const BLOOD_GROUP_OPTIONS = [
  "",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

function normalizeMobile(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) return digits.slice(-10);
  return digits.slice(0, 10);
}

export default function LoginPage({ onLogin }) {
  const [activeRole, setActiveRole] = useState("patient");
  const [patientMode, setPatientMode] = useState("login");
  const [patientStep, setPatientStep] = useState("request");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signupForm, setSignupForm] = useState(signupDefaults);
  const [staffUserId, setStaffUserId] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const patientTitle = useMemo(
    () =>
      patientMode === "signup"
        ? patientStep === "request"
          ? "Create Patient Account"
          : "Verify Signup OTP"
        : patientStep === "request"
          ? "Patient Login"
          : "Verify Login OTP",
    [patientMode, patientStep]
  );

  const setSignupField = (key, value) =>
    setSignupForm((prev) => ({
      ...prev,
      [key]: value,
    }));

  const resetPatientOtpState = () => {
    setPatientStep("request");
    setOtp("");
    setDevOtp("");
    setNotice("");
    setError("");
  };

  const handlePatientLoginRequest = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await requestPatientOtp({ identifier });
      setPatientStep("verify");
      setDevOtp(response.devOtp || "");
      setNotice(`OTP generated for ${response.channel}. Enter it below to continue.`);
    } catch (err) {
      setError(err.message || "Unable to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSignup = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      if (!normalizeMobile(signupForm.emergencyContact)) {
        throw new Error("Emergency contact is required.");
      }

      const response = await signupPatientAccount({
        ...signupForm,
        age: Number(signupForm.age),
        mobile: normalizeMobile(signupForm.mobile),
        emergencyContact: normalizeMobile(signupForm.emergencyContact),
      });

      const resolvedIdentifier = signupForm.email.trim() || normalizeMobile(signupForm.mobile);
      setIdentifier(resolvedIdentifier);
      setPatientStep("verify");
      setDevOtp(response.devOtp || "");
      setNotice("Account created. Enter the OTP to activate your patient login.");
    } catch (err) {
      setError(err.message || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await verifyPatientOtp({
        identifier,
        otp,
      });

      if (typeof onLogin === "function") {
        onLogin(response.user);
      }
    } catch (err) {
      setError(err.message || "Unable to verify OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await loginStaff({
        userId: staffUserId.trim(),
        password: staffPassword.trim(),
      });

      if (typeof onLogin === "function") {
        onLogin(response.user);
      }
    } catch (err) {
      setError(err.message || "Invalid staff credentials. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAutofill = (demoUserId, demoPassword) => {
    setStaffUserId(demoUserId);
    setStaffPassword(demoPassword);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <TricolorStrip />
      <GovHeader />

      <main className="px-4 py-10">
        <div className="mx-auto w-full max-w-[540px]">
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <ModeButton active={activeRole === "patient"} onClick={() => { setActiveRole("patient"); setError(""); }}>
              Patient Access
            </ModeButton>
            <ModeButton active={activeRole === "staff"} onClick={() => { setActiveRole("staff"); setError(""); }}>
              Staff Access
            </ModeButton>
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <div className="bg-[#003580] px-6 py-4">
              <h1 className="text-[19px] font-bold text-white">
                {activeRole === "patient" ? patientTitle : "Staff Sign In"}
              </h1>
              <p className="mt-1 text-[13px] text-[#A8C8FF]">
                {activeRole === "patient"
                  ? "Signup once, then login securely with email or mobile OTP"
                  : "SwasthyaQueue | Hospital Console Access"}
              </p>
            </div>

            <div className="px-6 py-5">
              {activeRole === "patient" ? (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-[#F8FAFC] p-1.5">
                    <ModeButton
                      active={patientMode === "login"}
                      onClick={() => {
                        setPatientMode("login");
                        resetPatientOtpState();
                      }}
                    >
                      Login with OTP
                    </ModeButton>
                    <ModeButton
                      active={patientMode === "signup"}
                      onClick={() => {
                        setPatientMode("signup");
                        resetPatientOtpState();
                      }}
                    >
                      Create Account
                    </ModeButton>
                  </div>

                  {error ? (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#DC2626]">
                      {error}
                    </div>
                  ) : null}

                  {notice ? (
                    <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-[#1D4ED8]">
                      {notice}
                    </div>
                  ) : null}

                  {patientStep === "verify" ? (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div>
                        <label className={labelStyle}>Email or Mobile</label>
                        <input className={inputStyle} value={identifier} readOnly />
                      </div>
                      <div>
                        <label className={labelStyle}>One-Time Password *</label>
                        <input
                          className={inputStyle}
                          value={otp}
                          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="Enter 6-digit OTP"
                          inputMode="numeric"
                        />
                      </div>

                      {devOtp ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          Demo OTP: <span className="font-mono font-bold">{devOtp}</span>
                        </div>
                      ) : null}

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={resetPatientOtpState}
                          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${
                            loading ? "cursor-not-allowed bg-slate-400" : "bg-[#003580] hover:bg-[#0050A8]"
                          }`}
                        >
                          {loading ? "Verifying..." : "Verify and Continue"}
                        </button>
                      </div>
                    </form>
                  ) : patientMode === "login" ? (
                    <form onSubmit={handlePatientLoginRequest} className="space-y-4">
                      <div>
                        <label className={labelStyle}>Email or Mobile *</label>
                        <input
                          className={inputStyle}
                          value={identifier}
                          onChange={(event) => setIdentifier(event.target.value)}
                          placeholder="Enter registered email or mobile"
                          autoComplete="username"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${
                          loading ? "cursor-not-allowed bg-slate-400" : "bg-[#003580] hover:bg-[#0050A8]"
                        }`}
                      >
                        {loading ? "Sending OTP..." : "Send OTP"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handlePatientSignup} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Full Name *">
                          <input className={inputStyle} value={signupForm.name} onChange={(event) => setSignupField("name", event.target.value)} />
                        </Field>
                        <Field label="Age *">
                          <input className={inputStyle} value={signupForm.age} onChange={(event) => setSignupField("age", event.target.value.replace(/\D/g, "").slice(0, 3))} />
                        </Field>
                        <Field label="Gender *">
                          <select className={inputStyle} value={signupForm.gender} onChange={(event) => setSignupField("gender", event.target.value)}>
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </Field>
                        <Field label="Mobile *">
                          <input className={inputStyle} value={signupForm.mobile} onChange={(event) => setSignupField("mobile", normalizeMobile(event.target.value))} placeholder="9876543210" />
                        </Field>
                        <Field label="Email">
                          <input className={inputStyle} value={signupForm.email} onChange={(event) => setSignupField("email", event.target.value)} placeholder="you@example.com" />
                        </Field>
                        <Field label="Blood Group">
                          <select className={inputStyle} value={signupForm.bloodGroup} onChange={(event) => setSignupField("bloodGroup", event.target.value)}>
                            {BLOOD_GROUP_OPTIONS.map((option) => (
                              <option key={option || "blank"} value={option}>
                                {option || "Select blood group"}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <Field label="Address">
                        <textarea className={`${inputStyle} min-h-[78px]`} value={signupForm.address} onChange={(event) => setSignupField("address", event.target.value)} />
                      </Field>
                      <Field label="Emergency Contact *">
                        <input className={inputStyle} value={signupForm.emergencyContact} onChange={(event) => setSignupField("emergencyContact", normalizeMobile(event.target.value))} placeholder="Emergency mobile number" />
                      </Field>
                      <Field label="Known Allergies">
                        <textarea className={`${inputStyle} min-h-[70px]`} value={signupForm.allergies} onChange={(event) => setSignupField("allergies", event.target.value)} placeholder="Food, medicine, or other allergies" />
                      </Field>
                      <Field label="Existing Conditions">
                        <textarea className={`${inputStyle} min-h-[70px]`} value={signupForm.chronicConditions} onChange={(event) => setSignupField("chronicConditions", event.target.value)} placeholder="Diabetes, hypertension, asthma, etc." />
                      </Field>

                      <button
                        type="submit"
                        disabled={loading}
                        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${
                          loading ? "cursor-not-allowed bg-slate-400" : "bg-[#003580] hover:bg-[#0050A8]"
                        }`}
                      >
                        {loading ? "Creating Account..." : "Create Account and Send OTP"}
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <form onSubmit={handleStaffLogin} className="space-y-4">
                  {error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-[#DC2626]">
                      {error}
                    </div>
                  ) : null}

                  <Field label="Staff User ID *">
                    <input
                      className={inputStyle}
                      value={staffUserId}
                      onChange={(event) => setStaffUserId(event.target.value)}
                      placeholder="e.g. receptionist01 | nurse01 | doctor01"
                    />
                  </Field>

                  <Field label="Password *">
                    <div className="relative">
                      <input
                        className={`${inputStyle} pr-20`}
                        type={showPassword ? "text" : "password"}
                        value={staffPassword}
                        onChange={(event) => setStaffPassword(event.target.value)}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-bold tracking-wide text-[#003580] hover:bg-slate-100"
                      >
                        {showPassword ? "HIDE" : "SHOW"}
                      </button>
                    </div>
                  </Field>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${
                      loading ? "cursor-not-allowed bg-slate-400" : "bg-[#003580] hover:bg-[#0050A8]"
                    }`}
                  >
                    {loading ? "Signing In..." : "Sign In"}
                  </button>

                  <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-3.5">
                    <h3 className="text-[11px] font-bold tracking-wide text-slate-600">ROLE DEMO CREDENTIALS</h3>
                    <div className="mt-2 space-y-2">
                      {demoRows.map(({ userId, password }) => (
                        <button
                          type="button"
                          key={userId}
                          onClick={() => handleDemoAutofill(userId, password)}
                          className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <span className="font-mono text-xs text-slate-700">
                            {userId} / {password}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            demo
                          </span>
                        </button>
                      ))}
                    </div>
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-[#003580] text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
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
            <p className="text-lg font-bold">SwasthyaQueue</p>
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
