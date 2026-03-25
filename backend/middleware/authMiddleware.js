const { verifyAuthToken } = require("../utils/auth");

function requirePatientAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = verifyAuthToken(token);

  if (!payload || payload.role !== "patient") {
    return res.status(401).json({ error: "Authentication required" });
  }

  req.auth = payload;
  next();
}

module.exports = { requirePatientAuth };
