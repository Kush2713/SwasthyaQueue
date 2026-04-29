/* eslint-disable no-console */
const pool = require("../db");

async function run() {
  try {
    await pool.query(
      "TRUNCATE TABLE workflow_events, queue, appointments, patient_accounts, patients RESTART IDENTITY CASCADE"
    );
    console.log("✅ Database cleared. No operational data present.");
    console.log("Departments are preserved.");
  } catch (error) {
    console.error("❌ Failed to clear database:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

