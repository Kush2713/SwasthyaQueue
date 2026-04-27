const assert = require("node:assert/strict");

const {
  issueAuthToken,
  verifyAuthToken,
  normalizeMobile,
  normalizeIdentifier,
} = require("../utils/auth");
const {
  getStaffUserByCredentials,
  getStaffUserById,
  sanitizeStaffUser,
} = require("../utils/staffUsers");
const {
  requireAuth,
  requireRoles,
  getActorFromRequest,
} = require("../middleware/authMiddleware");

function createResponseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

async function main() {
  await run("auth token round-trip keeps patient identity", () => {
    const token = issueAuthToken({
      accountId: 22,
      patientId: 7,
      role: "patient",
      name: "Test Patient",
    });

    const payload = verifyAuthToken(token);
    assert.equal(payload.account_id, 22);
    assert.equal(payload.patient_id, 7);
    assert.equal(payload.role, "patient");
    assert.equal(payload.name, "Test Patient");
  });

  await run("staff helpers resolve and sanitize users", () => {
    const matched = getStaffUserByCredentials("nurse01", "nurse123");
    assert.ok(matched);
    assert.equal(matched.role, "nurse");
    assert.equal(getStaffUserById("doctor01").designation, "Doctor | General Medicine");

    assert.deepEqual(sanitizeStaffUser(matched, "token-123"), {
      userId: "nurse01",
      role: "nurse",
      name: "Sujatha Rao",
      designation: "Nurse | Triage",
      authToken: "token-123",
    });
  });

  await run("normalizers support Indian mobile and email identifiers", () => {
    assert.equal(normalizeMobile("+91 98765 43210"), "9876543210");
    assert.deepEqual(normalizeIdentifier("9876543210"), {
      type: "mobile",
      value: "9876543210",
    });
    assert.deepEqual(normalizeIdentifier("PATIENT@EXAMPLE.COM "), {
      type: "email",
      value: "patient@example.com",
    });
  });

  await run("requireAuth accepts valid staff token", () => {
    const token = issueAuthToken({
      userId: "doctor01",
      role: "doctor",
      name: "Dr. S. Mehta",
      designation: "Doctor | General Medicine",
    });
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const res = createResponseDouble();
    let nextCalled = false;

    requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.auth.role, "doctor");
    assert.equal(req.auth.user_id, "doctor01");
  });

  await run("requireRoles blocks mismatched roles", () => {
    const token = issueAuthToken({
      userId: "receptionist01",
      role: "receptionist",
      name: "Anita Reddy",
    });
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const res = createResponseDouble();
    let nextCalled = false;

    requireRoles(["doctor"])(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "You do not have permission to perform this action.");
  });

  await run("getActorFromRequest prefers authenticated context", () => {
    assert.deepEqual(
      getActorFromRequest(
        {
          auth: {
            role: "nurse",
            name: "Sujatha Rao",
            user_id: "nurse01",
            account_id: null,
          },
        },
        { role: "fallback", name: "Fallback" }
      ),
      {
        role: "nurse",
        name: "Sujatha Rao",
        userId: "nurse01",
        accountId: null,
      }
    );
  });

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main();
