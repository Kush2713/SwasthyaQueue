const crypto = require("crypto");

function normalizeUserId(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeDepartmentIds(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    )
  ).sort((a, b) => a - b);
}

function mapStaffRow(row) {
  const assignedDepartmentIds = normalizeDepartmentIds(row.assigned_department_ids);
  const primaryDepartmentId = Number.isFinite(Number(row.primary_department_id))
    ? Number(row.primary_department_id)
    : assignedDepartmentIds[0] || null;

  return {
    staffId: row.staff_id,
    userId: row.user_id,
    passwordHash: row.password_hash,
    role: row.role,
    name: row.name,
    designation: row.designation,
    active: Boolean(row.active),
    assignedDepartmentIds,
    primaryDepartmentId,
  };
}

function sanitizeStaffAccount(user, authToken) {
  return {
    staffId: user.staffId || null,
    userId: user.userId,
    role: user.role,
    name: user.name,
    designation: user.designation || "",
    assignedDepartmentIds: user.assignedDepartmentIds || [],
    primaryDepartmentId: user.primaryDepartmentId || null,
    authToken,
  };
}

function hashStaffPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const normalized = String(password || "");
  const derived = crypto.pbkdf2Sync(normalized, salt, 120000, 64, "sha512").toString("hex");
  return `pbkdf2$120000$${salt}$${derived}`;
}

function verifyStaffPassword(storedHash, candidatePassword) {
  const stored = String(storedHash || "").trim();
  const candidate = String(candidatePassword || "");

  // Legacy compatibility: plain-text seeded values.
  if (!stored.startsWith("pbkdf2$")) {
    return stored === candidate;
  }

  const [scheme, roundsText, salt, expected] = stored.split("$");
  if (scheme !== "pbkdf2" || !roundsText || !salt || !expected) return false;
  const rounds = Number(roundsText);
  if (!Number.isFinite(rounds) || rounds < 10000) return false;

  const actual = crypto.pbkdf2Sync(candidate, salt, rounds, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

async function getStaffAccountByUserId(db, userId) {
  const normalized = normalizeUserId(userId);
  if (!normalized) return null;

  const result = await db.query(
    `
      SELECT
        s.staff_id,
        s.user_id,
        s.password_hash,
        s.role,
        s.name,
        s.designation,
        s.active,
        ARRAY_REMOVE(ARRAY_AGG(CASE WHEN a.active THEN a.department_id END), NULL) AS assigned_department_ids,
        MAX(CASE WHEN a.active AND a.is_primary THEN a.department_id END) AS primary_department_id
      FROM staff_accounts s
      LEFT JOIN staff_department_assignments a ON a.staff_id = s.staff_id
      WHERE LOWER(s.user_id) = $1
      GROUP BY s.staff_id, s.user_id, s.password_hash, s.role, s.name, s.designation, s.active
      LIMIT 1
    `,
    [normalized]
  );

  if (!result.rows.length) return null;
  return mapStaffRow(result.rows[0]);
}

async function getStaffAccountByCredentials(db, userId, password) {
  const account = await getStaffAccountByUserId(db, userId);
  if (!account || !account.active) return null;

  if (!verifyStaffPassword(account.passwordHash, password)) {
    return null;
  }

  // One-way hardening migration: upgrade legacy plain-text staff passwords to hash at login.
  if (!String(account.passwordHash || "").startsWith("pbkdf2$")) {
    await db.query(
      `
        UPDATE staff_accounts
        SET password_hash = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE staff_id = $1
      `,
      [account.staffId, hashStaffPassword(password)]
    );
  }

  return account;
}

module.exports = {
  sanitizeStaffAccount,
  getStaffAccountByUserId,
  getStaffAccountByCredentials,
  hashStaffPassword,
  verifyStaffPassword,
};
