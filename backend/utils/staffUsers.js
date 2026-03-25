const STAFF_USERS = {
  receptionist01: {
    userId: "receptionist01",
    password: "recept123",
    role: "receptionist",
    name: "Anita Reddy",
    designation: "Receptionist",
  },
  nurse01: {
    userId: "nurse01",
    password: "nurse123",
    role: "nurse",
    name: "Sujatha Rao",
    designation: "Nurse | Triage",
  },
  doctor01: {
    userId: "doctor01",
    password: "doc123",
    role: "doctor",
    name: "Dr. S. Mehta",
    designation: "Doctor | General Medicine",
  },
};

function sanitizeStaffUser(user, authToken) {
  return {
    userId: user.userId,
    role: user.role,
    name: user.name,
    designation: user.designation,
    authToken,
  };
}

function getStaffUserByCredentials(userId, password) {
  const normalizedUserId = String(userId || "").trim().toLowerCase();
  const matched = STAFF_USERS[normalizedUserId];
  if (!matched || matched.password !== String(password || "").trim()) {
    return null;
  }
  return matched;
}

function getStaffUserById(userId) {
  return STAFF_USERS[String(userId || "").trim().toLowerCase()] || null;
}

module.exports = {
  STAFF_USERS,
  sanitizeStaffUser,
  getStaffUserByCredentials,
  getStaffUserById,
};
