const STAFF_USERS = {
  receptionist01: {
    userId: "receptionist01",
    password: "sqrecp123",
    role: "receptionist",
    name: "Anita Reddy",
    designation: "Receptionist",
  },
  nurse01: {
    userId: "nurse01",
    password: "sqnurse123",
    role: "nurse",
    name: "Sujatha Rao",
    designation: "Nurse | General Medicine",
  },
  nurse_cardio01: {
    userId: "nurse_cardio01",
    password: "sqnurse123",
    role: "nurse",
    name: "Nurse Cardiology",
    designation: "Nurse | Cardiology",
  },
  nurse_ortho01: {
    userId: "nurse_ortho01",
    password: "sqnurse123",
    role: "nurse",
    name: "Nurse Orthopedics",
    designation: "Nurse | Orthopedics",
  },
  nurse_pedia01: {
    userId: "nurse_pedia01",
    password: "sqnurse123",
    role: "nurse",
    name: "Nurse Pediatrics",
    designation: "Nurse | Pediatrics",
  },
  nurse_emg01: {
    userId: "nurse_emg01",
    password: "sqnurse123",
    role: "nurse",
    name: "Nurse Emergency",
    designation: "Nurse | Emergency",
  },
  doctor01: {
    userId: "doctor01",
    password: "sqdoc123",
    role: "doctor",
    name: "Dr. S. Mehta",
    designation: "Doctor | General Medicine",
  },
  doctor_cardio01: {
    userId: "doctor_cardio01",
    password: "sqdoc123",
    role: "doctor",
    name: "Dr. Cardiology",
    designation: "Doctor | Cardiology",
  },
  doctor_ortho01: {
    userId: "doctor_ortho01",
    password: "sqdoc123",
    role: "doctor",
    name: "Dr. Orthopedics",
    designation: "Doctor | Orthopedics",
  },
  doctor_pedia01: {
    userId: "doctor_pedia01",
    password: "sqdoc123",
    role: "doctor",
    name: "Dr. Pediatrics",
    designation: "Doctor | Pediatrics",
  },
  doctor_emg01: {
    userId: "doctor_emg01",
    password: "sqdoc123",
    role: "doctor",
    name: "Doctor Emergency",
    designation: "Doctor | Emergency",
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
