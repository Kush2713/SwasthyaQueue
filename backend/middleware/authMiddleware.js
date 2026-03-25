const { verifyAuthToken } = require("../utils/auth");
const { getStaffUserById } = require("../utils/staffUsers");

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  const payload = verifyAuthToken(token);

  if (!payload) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (payload.role !== "patient") {
    const staffUser = getStaffUserById(payload.user_id);
    if (!staffUser || staffUser.role !== payload.role) {
      return res.status(401).json({ error: "Authentication required" });
    }
  }

  req.auth = payload;
  next();
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

module.exports = { requireAuth, requirePatientAuth, requireRoles, getActorFromRequest };
