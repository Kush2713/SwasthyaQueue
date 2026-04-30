const { verifyAuthToken } = require("../utils/auth");
const { getStaffUserById } = require("../utils/staffUsers");
const { getStaffAccountByUserId } = require("../utils/staffAccounts");
const pool = require("../db");

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

async function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  const payload = verifyAuthToken(token);

  if (!payload) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (payload.role !== "patient") {
    try {
      const staffUser = await getStaffAccountByUserId(pool, payload.user_id);
      if (staffUser?.active && staffUser.role === payload.role) {
        req.auth = {
          ...payload,
          staff_id: staffUser.staffId,
          assigned_department_ids: staffUser.assignedDepartmentIds || [],
          primary_department_id: staffUser.primaryDepartmentId || null,
        };
        return next();
      }
    } catch (error) {
      console.error("DB staff auth validation failed, trying fallback:", error.message);
    }

    const legacyStaff = getStaffUserById(payload.user_id);
    if (!legacyStaff || legacyStaff.role !== payload.role) {
      return res.status(401).json({ error: "Authentication required" });
    }
  }

  req.auth = payload;
  next();
}

async function attachOptionalAuth(req, _res, next) {
  const token = getBearerToken(req);
  const payload = verifyAuthToken(token);

  if (!payload) {
    return next();
  }

  if (payload.role === "patient") {
    req.auth = payload;
    return next();
  }

  try {
    const staffUser = await getStaffAccountByUserId(pool, payload.user_id);
    if (staffUser?.active && staffUser.role === payload.role) {
      req.auth = {
        ...payload,
        staff_id: staffUser.staffId,
        assigned_department_ids: staffUser.assignedDepartmentIds || [],
        primary_department_id: staffUser.primaryDepartmentId || null,
      };
      return next();
    }
  } catch (_error) {
    // silent fallback below
  }

  const legacyStaff = getStaffUserById(payload.user_id);
  if (legacyStaff && legacyStaff.role === payload.role) {
    req.auth = payload;
  }

  return next();
}

function requirePatientAuth(req, res, next) {
  return requireRoles(["patient"])(req, res, next);
}

function requireRoles(roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.auth.role)) {
        return res.status(403).json({ error: "You do not have permission to perform this action." });
      }
      next();
    });
  };
}

function getActorFromRequest(req, fallback = {}) {
  if (!req?.auth) return fallback;
  return {
    role: req.auth.role || fallback.role || null,
    name: req.auth.name || fallback.name || null,
    userId: req.auth.user_id || fallback.userId || null,
    accountId: req.auth.account_id || fallback.accountId || null,
  };
}

function getAssignedDepartmentIdsFromAuth(auth) {
  const ids = Array.isArray(auth?.assigned_department_ids) ? auth.assigned_department_ids : [];
  return Array.from(new Set(ids.map((value) => Number(value)).filter((value) => Number.isFinite(value))));
}

function hasDepartmentAccess(auth, departmentId) {
  const role = auth?.role;
  if (!["receptionist", "nurse", "doctor"].includes(role)) return true;

  const ids = getAssignedDepartmentIdsFromAuth(auth);
  if (!ids.length) return true; // compatibility fallback until full enforcement rollout

  const numericDepartmentId = Number(departmentId);
  if (!Number.isFinite(numericDepartmentId)) return false;
  return ids.includes(numericDepartmentId);
}

module.exports = {
  requireAuth,
  attachOptionalAuth,
  requirePatientAuth,
  requireRoles,
  getActorFromRequest,
  getAssignedDepartmentIdsFromAuth,
  hasDepartmentAccess,
};
