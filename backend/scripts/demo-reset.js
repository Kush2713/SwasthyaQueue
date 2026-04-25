const pool = require("../db");

(async () => {
  await pool.query(`
    TRUNCATE TABLE workflow_events, queue, appointments,
    patient_accounts, patients RESTART IDENTITY CASCADE
  `);
  console.log("✅ Demo DB cleared and ready for seeding.");
  await pool.end();
})().catch(async (e) => {
  console.error("❌ Reset failed:", e.message);
  process.exit(1);
});
