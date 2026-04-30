const crypto = require("crypto");

const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || "dev-auth-secret-change-me";
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 12);
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_PREVIEW_ENABLED = process.env.OTP_PREVIEW_ENABLED === "true";

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signTokenPayload(payload) {
  return crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function issueAuthToken(user) {
  const payload = {
    sub: user.accountId || user.userId,
    account_id: user.accountId || null,
    patient_id: user.patientId || null,
    staff_id: user.staffId || null,
    user_id: user.userId || null,
    name: user.name || "",
    designation: user.designation || "",
    assigned_department_ids: Array.isArray(user.assignedDepartmentIds) ? user.assignedDepartmentIds : null,
    primary_department_id: Number.isFinite(user.primaryDepartmentId) ? user.primaryDepartmentId : null,
    role: user.role || "patient",
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = signTokenPayload(encodedPayload);

  if (signature !== expectedSignature) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

function normalizeMobile(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) {
    return digits.slice(-10);
  }
  return digits.slice(0, 10);
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizeIdentifier(value = "") {
  const raw = String(value).trim();
  if (raw.includes("@")) {
    return { type: "email", value: normalizeEmail(raw) };
  }
  return { type: "mobile", value: normalizeMobile(raw) };
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999));
}

function hashOtp(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function getOtpExpirySql() {
  return `${OTP_TTL_MINUTES} minutes`;
}

function canPreviewOtp() {
  return OTP_PREVIEW_ENABLED || process.env.NODE_ENV !== "production";
}

module.exports = {
  issueAuthToken,
  verifyAuthToken,
  normalizeMobile,
  normalizeEmail,
  normalizeIdentifier,
  generateOtpCode,
  hashOtp,
  getOtpExpirySql,
  canPreviewOtp,
};
