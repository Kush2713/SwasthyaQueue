async function logWorkflowEvent(
  db,
  {
    actor = {},
    action,
    entityType = null,
    entityId = null,
    patientId = null,
    appointmentId = null,
    queueId = null,
    details = null,
  }
) {
  if (!action) return;

  await db.query(
    `
      INSERT INTO workflow_events (
        actor_role,
        actor_name,
        actor_user_id,
        actor_account_id,
        action,
        entity_type,
        entity_id,
        patient_id,
        appointment_id,
        queue_id,
        details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
    `,
    [
      actor.role || null,
      actor.name || null,
      actor.userId || null,
      actor.accountId || null,
      action,
      entityType,
      entityId,
      patientId,
      appointmentId,
      queueId,
      details ? JSON.stringify(details) : null,
    ]
  );
}

module.exports = { logWorkflowEvent };
