const pool = require("../db");
const { getActorFromRequest } = require("../middleware/authMiddleware");
const { hashStaffPassword } = require("../utils/staffAccounts");
const { logWorkflowEvent } = require("../utils/audit");

async function listStaff(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          s.staff_id,
          s.user_id,
          s.role,
          s.name,
          s.designation,
          s.active,
          ARRAY_REMOVE(ARRAY_AGG(CASE WHEN a.active THEN a.department_id END), NULL) AS assigned_department_ids,
          MAX(CASE WHEN a.active AND a.is_primary THEN a.department_id END) AS primary_department_id
        FROM staff_accounts s
        LEFT JOIN staff_department_assignments a ON a.staff_id = s.staff_id
        GROUP BY s.staff_id, s.user_id, s.role, s.name, s.designation, s.active
        ORDER BY s.role, s.name
      `
    );

    res.json({
      staff: result.rows.map((row) => ({
        staffId: row.staff_id,
        userId: row.user_id,
        role: row.role,
        name: row.name,
        designation: row.designation,
        active: Boolean(row.active),
        assignedDepartmentIds: (row.assigned_department_ids || []).map((v) => Number(v)).filter((v) => Number.isFinite(v)),
        primaryDepartmentId: Number.isFinite(Number(row.primary_department_id)) ? Number(row.primary_department_id) : null,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load staff list right now." });
  }
}

async function updateStaffAssignments(req, res) {
  const staffId = Number(req.params.staff_id);
  const departmentIds = Array.from(
    new Set((Array.isArray(req.body.department_ids) ? req.body.department_ids : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value)))
  );
  const primaryDepartmentId = Number(req.body.primary_department_id);
  const actor = getActorFromRequest(req, { role: "admin", name: "Platform Admin" });

  if (!Number.isFinite(staffId)) {
    return res.status(400).json({ error: "Invalid staff id." });
  }
  if (!departmentIds.length) {
    return res.status(400).json({ error: "At least one department assignment is required." });
  }
  if (!Number.isFinite(primaryDepartmentId) || !departmentIds.includes(primaryDepartmentId)) {
    return res.status(400).json({ error: "Primary department must be one of the assigned departments." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const staffExists = await client.query("SELECT staff_id FROM staff_accounts WHERE staff_id = $1 LIMIT 1", [staffId]);
    if (!staffExists.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Staff account not found." });
    }

    const deptCheck = await client.query(
      "SELECT department_id FROM departments WHERE department_id = ANY($1::int[])",
      [departmentIds]
    );
    if (deptCheck.rows.length !== departmentIds.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "One or more department ids are invalid." });
    }

    await client.query("UPDATE staff_department_assignments SET active = FALSE, is_primary = FALSE WHERE staff_id = $1", [staffId]);

    for (const departmentId of departmentIds) {
      await client.query(
        `
          INSERT INTO staff_department_assignments (staff_id, department_id, is_primary, active, assigned_at)
          VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP)
          ON CONFLICT (staff_id, department_id)
          DO UPDATE SET active = TRUE, is_primary = EXCLUDED.is_primary, assigned_at = CURRENT_TIMESTAMP
        `,
        [staffId, departmentId, departmentId === primaryDepartmentId]
      );
    }

    await logWorkflowEvent(client, {
      actor,
      action: "staff_assignment_updated",
      entityType: "staff_user",
      entityId: String(staffId),
      details: {
        staffId,
        departmentIds,
        primaryDepartmentId,
      },
    });

    await client.query("COMMIT");
    res.json({ message: "Staff assignments updated successfully." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Unable to update staff assignments right now." });
  } finally {
    client.release();
  }
}

async function resetStaffPassword(req, res) {
  const staffId = Number(req.params.staff_id);
  const nextPassword = String(req.body.password || "");
  const actor = getActorFromRequest(req, { role: "admin", name: "Platform Admin" });

  if (!Number.isFinite(staffId)) {
    return res.status(400).json({ error: "Invalid staff id." });
  }
  if (nextPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const result = await pool.query(
      `
        UPDATE staff_accounts
        SET password_hash = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE staff_id = $1
        RETURNING staff_id
      `,
      [staffId, hashStaffPassword(nextPassword)]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Staff account not found." });
    }

    await logWorkflowEvent(pool, {
      actor,
      action: "staff_password_reset",
      entityType: "staff_user",
      entityId: String(staffId),
      details: { staffId },
    });

    res.json({ message: "Staff password reset successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to reset staff password right now." });
  }
}

module.exports = {
  listStaff,
  updateStaffAssignments,
  resetStaffPassword,
};

