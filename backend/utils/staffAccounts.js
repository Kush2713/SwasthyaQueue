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

  // Phase-2 compatibility: password_hash currently stores seeded plain-text values.
  // We will switch to hashed verification in the hardening phase.
  if (String(account.passwordHash || "").trim() !== String(password || "").trim()) {
    return null;
  }

  return account;
}

module.exports = {
  sanitizeStaffAccount,
  getStaffAccountByUserId,
  getStaffAccountByCredentials,
};

