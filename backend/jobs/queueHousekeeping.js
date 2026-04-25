const { logWorkflowEvent } = require("../utils/audit");

const HOSPITAL_TIMEZONE = process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata";

// End-of-day safety job: closes stale queue/appointment rows from previous hospital days.
async function closeStaleQueueEntries(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const staleRowsResult = await client.query(
      `
        SELECT q.queue_id, q.patient_id, q.appointment_id, q.department_id, q.token_number, q.token_date, d.name AS department_name
        FROM queue q
        JOIN departments d ON d.department_id = q.department_id
        WHERE q.status IN ('waiting', 'in-progress')
          AND q.token_date < (CURRENT_TIMESTAMP AT TIME ZONE $1)::date
        FOR UPDATE
      `,
      [HOSPITAL_TIMEZONE]
    );

    const staleRows = staleRowsResult.rows;
    if (!staleRows.length) {
      await client.query("COMMIT");
      return { closedQueueEntries: 0, closedAppointments: 0 };
    }

    const queueIds = staleRows.map((row) => row.queue_id);
    const appointmentIds = staleRows
      .map((row) => row.appointment_id)
      .filter((id) => Number.isFinite(Number(id)));

    await client.query(
      `
        UPDATE queue
        SET status = 'cancelled'
        WHERE queue_id = ANY($1::int[])
      `,
      [queueIds]
    );

    let closedAppointments = 0;
    if (appointmentIds.length) {
      const appointmentUpdate = await client.query(
        `
          UPDATE appointments
          SET status = 'cancelled',
              updated_at = CURRENT_TIMESTAMP
          WHERE appointment_id = ANY($1::int[])
            AND status IN ('booked', 'queued', 'ready-for-doctor', 'in-progress')
        `,
        [appointmentIds]
      );
      closedAppointments = appointmentUpdate.rowCount;
    }

    // Keep an auditable trail for every auto-closed queue item.
    for (const row of staleRows) {
      await logWorkflowEvent(client, {
        actor: { role: "system", name: "Queue Housekeeping" },
        action: "queue_auto_closed_eod",
        entityType: "queue",
        entityId: row.queue_id,
        patientId: row.patient_id,
        appointmentId: row.appointment_id || null,
        queueId: row.queue_id,
        details: {
          reason: "Auto-close stale queue entry from previous operational day",
          departmentId: row.department_id,
          departmentName: row.department_name,
          tokenNumber: row.token_number,
          tokenDate: row.token_date,
          timezone: HOSPITAL_TIMEZONE,
        },
      });
    }

    await client.query("COMMIT");
    return {
      closedQueueEntries: staleRows.length,
      closedAppointments,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  closeStaleQueueEntries,
};
