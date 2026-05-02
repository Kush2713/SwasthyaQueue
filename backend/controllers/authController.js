const pool = require("../db");
const {
  canPreviewOtp,
  generateOtpCode,
  getOtpExpirySql,
  hashOtp,
  issueAuthToken,
  isValidIndianMobile,
  normalizeEmail,
  normalizeIdentifier,
  normalizeMobile,
} = require("../utils/auth");
const { getStaffUserByCredentials, getStaffUserById, sanitizeStaffUser } = require("../utils/staffUsers");
const { getStaffAccountByCredentials, getStaffAccountByUserId, sanitizeStaffAccount } = require("../utils/staffAccounts");
const { logWorkflowEvent } = require("../utils/audit");

function sanitizePatientUser(row, token) {
  return {
    role: "patient",
    authToken: token,
    accountId: row.account_id,
    patientId: row.patient_id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    mobile: row.mobile || row.phone,
    email: row.email,
    address: row.address,
    emergencyContact: row.emergency_contact,
    bloodGroup: row.blood_group,
    allergies: row.allergies,
    chronicConditions: row.chronic_conditions,
  };
}

function validateSignup(body) {
  if (!body.name?.trim()) return "Full name is required.";
  if (!Number.isFinite(Number(body.age)) || Number(body.age) < 0 || Number(body.age) > 120) {
    return "Please enter a valid age.";
  }
  if (!body.gender?.trim()) return "Gender is required.";
  if (!isValidIndianMobile(body.mobile)) return "Enter a valid Indian mobile number.";
  return "";
}

function validateAssistedSignup(body) {
  if (!body.name?.trim()) return "Full name is required.";
  if (!Number.isFinite(Number(body.age)) || Number(body.age) < 0 || Number(body.age) > 120) {
    return "Please enter a valid age.";
  }
  if (!body.gender?.trim()) return "Gender is required.";
  if (body.mobile && !isValidIndianMobile(body.mobile)) {
    return "Enter a valid Indian mobile number.";
  }
  return "";
}

function buildAssistedReference() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ASST-${stamp}-${random}`;
}

async function storeOtp(db, accountId) {
  const otp = generateOtpCode();
  await db.query(
    `
      UPDATE patient_accounts
      SET otp_hash = $2,
          otp_expires_at = CURRENT_TIMESTAMP + ($3::interval),
          otp_requested_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $1
    `,
    [accountId, hashOtp(otp), getOtpExpirySql()]
  );
  return otp;
}

async function signupPatient(req, res) {
  const validationError = validateSignup(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const mobile = normalizeMobile(req.body.mobile);
  const resolvedEmergency = req.body.emergencyContact?.trim() || null;
  const email = req.body.email ? normalizeEmail(req.body.email) : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingAccount = await client.query(
      `
        SELECT account_id
        FROM patient_accounts
        WHERE mobile = $1 OR ($2::text IS NOT NULL AND email = $2)
      `,
      [mobile, email]
    );

    if (existingAccount.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "An account already exists with this mobile or email." });
    }

    const patientResult = await client.query(
      `
        INSERT INTO patients (
          name, age, gender, phone, email, address, emergency_contact, blood_group, allergies, chronic_conditions
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        req.body.name.trim(),
        Number(req.body.age),
        req.body.gender,
        mobile,
        email,
        req.body.address?.trim() || null,
        resolvedEmergency,
        req.body.bloodGroup?.trim() || null,
        req.body.allergies?.trim() || null,
        req.body.chronicConditions?.trim() || null,
      ]
    );

    const accountResult = await client.query(
      `
        INSERT INTO patient_accounts (patient_id, email, mobile)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [patientResult.rows[0].patient_id, email, mobile]
    );

    const otp = await storeOtp(client, accountResult.rows[0].account_id);
    await logWorkflowEvent(client, {
      actor: { role: "patient", accountId: accountResult.rows[0].account_id, name: patientResult.rows[0].name },
      action: "patient_account_created",
      entityType: "patient_account",
      entityId: accountResult.rows[0].account_id,
      patientId: patientResult.rows[0].patient_id,
      details: { accountSource: "self" },
    });
    await client.query("COMMIT");

    res.status(201).json({
      message: "Account created successfully. Enter the OTP to continue.",
      identifier: email || mobile,
      channel: email ? "email" : "mobile",
      ...(canPreviewOtp() ? { devOtp: otp } : {}),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Unable to create patient account right now." });
  } finally {
    client.release();
  }
}

async function createAssistedPatientAccount(req, res) {
  const validationError = validateAssistedSignup(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const mobile = req.body.mobile ? normalizeMobile(req.body.mobile) : null;
  const resolvedEmergency = req.body.emergencyContact?.trim() || null;
  const email = req.body.email ? normalizeEmail(req.body.email) : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (mobile || email) {
      const existingAccount = await client.query(
        `
          SELECT account_id
          FROM patient_accounts
          WHERE ($1::text IS NOT NULL AND mobile = $1)
             OR ($2::text IS NOT NULL AND email = $2)
        `,
        [mobile, email]
      );

      if (existingAccount.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "An account already exists with this mobile or email." });
      }
    }

    const patientResult = await client.query(
      `
        INSERT INTO patients (
          name, age, gender, phone, email, address, emergency_contact, blood_group, allergies, chronic_conditions
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        req.body.name.trim(),
        Number(req.body.age),
        req.body.gender,
        mobile,
        email,
        req.body.address?.trim() || null,
        resolvedEmergency,
        req.body.bloodGroup?.trim() || null,
        req.body.allergies?.trim() || null,
        req.body.chronicConditions?.trim() || null,
      ]
    );

    const assistedReference = buildAssistedReference();
    const accountResult = await client.query(
      `
        INSERT INTO patient_accounts (
          patient_id, email, mobile, account_source, created_by_role, created_by_name, assisted_reference
        )
        VALUES ($1, $2, $3, 'staff-assisted', $4, $5, $6)
        RETURNING *
      `,
      [
        patientResult.rows[0].patient_id,
        email,
        mobile,
        req.body.createdByRole || "receptionist",
        req.body.createdByName || "Front Desk",
        assistedReference,
      ]
    );

    await logWorkflowEvent(client, {
      actor: {
        role: req.body.createdByRole || "receptionist",
        name: req.body.createdByName || "Front Desk",
      },
      action: "assisted_patient_account_created",
      entityType: "patient_account",
      entityId: accountResult.rows[0].account_id,
      patientId: patientResult.rows[0].patient_id,
      details: {
        accountSource: "staff-assisted",
        assistedReference,
      },
    });

    await client.query("COMMIT");

    res.status(201).json({
      message: "Staff-assisted patient account created successfully.",
      patient: patientResult.rows[0],
      account: {
        accountId: accountResult.rows[0].account_id,
        patientId: accountResult.rows[0].patient_id,
        accountSource: accountResult.rows[0].account_source,
        assistedReference: accountResult.rows[0].assisted_reference,
        createdByRole: accountResult.rows[0].created_by_role,
        createdByName: accountResult.rows[0].created_by_name,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Unable to create a staff-assisted patient account right now." });
  } finally {
    client.release();
  }
}

async function requestPatientOtp(req, res) {
  const identifier = normalizeIdentifier(req.body.identifier);
  if (!identifier.value) {
    return res.status(400).json({ error: "Email or mobile is required." });
  }
  if (identifier.type === "mobile" && !isValidIndianMobile(identifier.value)) {
    return res.status(400).json({ error: "Enter a valid Indian mobile number." });
  }

  try {
    const query = identifier.type === "email" ? "pa.email = $1" : "pa.mobile = $1";
    const accountResult = await pool.query(
      `
        SELECT pa.account_id, pa.email, pa.mobile
        FROM patient_accounts pa
        WHERE ${query}
      `,
      [identifier.value]
    );

    if (!accountResult.rows.length) {
      return res.status(404).json({ error: "No patient account found for that email or mobile." });
    }

    const account = accountResult.rows[0];
    const otp = await storeOtp(pool, account.account_id);
    res.json({
      message: "OTP generated successfully.",
      identifier: identifier.value,
      channel: identifier.type,
      ...(canPreviewOtp() ? { devOtp: otp } : {}),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to send OTP right now." });
  }
}

async function verifyPatientOtp(req, res) {
  const identifier = normalizeIdentifier(req.body.identifier);
  const otp = String(req.body.otp || "").trim();

  if (!identifier.value || !otp) {
    return res.status(400).json({ error: "Identifier and OTP are required." });
  }
  if (identifier.type === "mobile" && !isValidIndianMobile(identifier.value)) {
    return res.status(400).json({ error: "Enter a valid Indian mobile number." });
  }

  try {
    const query = identifier.type === "email" ? "pa.email = $1" : "pa.mobile = $1";
    const result = await pool.query(
      `
        SELECT
          pa.account_id,
          pa.patient_id,
          pa.mobile,
          pa.email,
          pa.otp_hash,
          pa.otp_expires_at,
          (pa.otp_expires_at IS NOT NULL AND pa.otp_expires_at >= CURRENT_TIMESTAMP) AS otp_valid_now,
          p.name,
          p.age,
          p.gender,
          p.phone,
          p.address,
          p.emergency_contact,
          p.blood_group,
          p.allergies,
          p.chronic_conditions
        FROM patient_accounts pa
        JOIN patients p ON p.patient_id = pa.patient_id
        WHERE ${query}
      `,
      [identifier.value]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "No patient account found for that identifier." });
    }

    const account = result.rows[0];
    if (!account.otp_hash || !account.otp_expires_at) {
      return res.status(400).json({ error: "Request a fresh OTP before verifying." });
    }

    if (account.otp_hash !== hashOtp(otp)) {
      return res.status(401).json({ error: "Invalid OTP. Please try again." });
    }

    if (!account.otp_valid_now) {
      return res.status(401).json({ error: "OTP has expired. Request a new one." });
    }

    await pool.query(
      `
        UPDATE patient_accounts
        SET otp_hash = NULL,
            otp_expires_at = NULL,
            last_login_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE account_id = $1
      `,
      [account.account_id]
    );

    const token = issueAuthToken({
      accountId: account.account_id,
      patientId: account.patient_id,
      role: "patient",
    });

    await logWorkflowEvent(pool, {
      actor: {
        role: "patient",
        accountId: account.account_id,
        name: account.name,
      },
      action: "patient_login",
      entityType: "patient_account",
      entityId: account.account_id,
      patientId: account.patient_id,
      details: { channel: identifier.type },
    });

    res.json({
      message: "Login successful.",
      user: sanitizePatientUser(account, token),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to verify OTP right now." });
  }
}

async function loginStaff(req, res) {
  let matchedUser = null;
  let source = "db";

  try {
    matchedUser = await getStaffAccountByCredentials(pool, req.body.userId, req.body.password);
  } catch (error) {
    console.error("DB staff auth lookup failed, trying fallback:", error.message);
  }

  if (!matchedUser) {
    const legacy = getStaffUserByCredentials(req.body.userId, req.body.password);
    if (legacy) {
      source = "legacy";
      matchedUser = {
        staffId: null,
        userId: legacy.userId,
        role: legacy.role,
        name: legacy.name,
        designation: legacy.designation,
        assignedDepartmentIds: [],
        primaryDepartmentId: null,
      };
    }
  }

  if (!matchedUser) {
    return res.status(401).json({ error: "Invalid staff credentials." });
  }

  const token = issueAuthToken({
    staffId: matchedUser.staffId,
    userId: matchedUser.userId,
    role: matchedUser.role,
    name: matchedUser.name,
    designation: matchedUser.designation,
    assignedDepartmentIds: matchedUser.assignedDepartmentIds || [],
    primaryDepartmentId: matchedUser.primaryDepartmentId,
  });

  await logWorkflowEvent(pool, {
    actor: {
      role: matchedUser.role,
      name: matchedUser.name,
      userId: matchedUser.userId,
    },
    action: "staff_login",
    entityType: "staff_user",
    entityId: matchedUser.userId,
    details: {
      designation: matchedUser.designation,
      source,
      assignedDepartmentIds: matchedUser.assignedDepartmentIds || [],
    },
  });

  res.json({
    message: "Staff login successful.",
    user: source === "db"
      ? sanitizeStaffAccount(matchedUser, token)
      : sanitizeStaffUser(matchedUser, token),
  });
}

async function getCurrentSession(req, res) {
  if (req.auth.role !== "patient") {
    const token = req.headers.authorization?.slice(7);
    try {
      const dbStaff = await getStaffAccountByUserId(pool, req.auth.user_id);
      if (dbStaff && dbStaff.active) {
        return res.json({
          user: sanitizeStaffAccount(dbStaff, token),
        });
      }
    } catch (error) {
      console.error("DB staff session lookup failed, trying fallback:", error.message);
    }

    const legacyStaff = getStaffUserById(req.auth.user_id);
    if (!legacyStaff) {
      return res.status(404).json({ error: "Staff user not found." });
    }

    return res.json({
      user: sanitizeStaffUser(legacyStaff, token),
    });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          pa.account_id,
          pa.patient_id,
          pa.mobile,
          pa.email,
          p.name,
          p.age,
          p.gender,
          p.phone,
          p.address,
          p.emergency_contact,
          p.blood_group,
          p.allergies,
          p.chronic_conditions
        FROM patient_accounts pa
        JOIN patients p ON p.patient_id = pa.patient_id
        WHERE pa.account_id = $1
      `,
      [req.auth.sub]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Account not found." });
    }

    res.json({
      user: sanitizePatientUser(result.rows[0], req.headers.authorization?.slice(7)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to load account details right now." });
  }
}

module.exports = {
  signupPatient,
  createAssistedPatientAccount,
  requestPatientOtp,
  verifyPatientOtp,
  loginStaff,
  getCurrentSession,
};
