function parseMs(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const TIMING = {
  staffPollMs: parseMs(process.env.NEXT_PUBLIC_STAFF_POLL_MS, 5000),
  receptionPollMs: parseMs(process.env.NEXT_PUBLIC_RECEPTION_POLL_MS, 5000),
  patientPollMs: parseMs(process.env.NEXT_PUBLIC_PATIENT_POLL_MS, 10000),
  displayPollMs: parseMs(process.env.NEXT_PUBLIC_DISPLAY_POLL_MS, 5000),
  patientNoticeMs: parseMs(process.env.NEXT_PUBLIC_PATIENT_NOTICE_MS, 40000),
};

function parseTime(value, fallbackMinutes) {
  const source = String(value || "");
  const [h, m] = source.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallbackMinutes;
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallbackMinutes;
  return h * 60 + m;
}

function toHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const OPD = {
  startMinutes: parseTime(process.env.NEXT_PUBLIC_OPD_START_TIME, 9 * 60 + 30),
  endMinutes: parseTime(process.env.NEXT_PUBLIC_OPD_END_TIME, 21 * 60 + 30),
  intervalMinutes: parseMs(process.env.NEXT_PUBLIC_OPD_SLOT_INTERVAL_MINUTES, 30),
};

export function getOpdSlotOptions() {
  const slots = [];
  const step = Math.max(5, OPD.intervalMinutes);
  const lastAllowedSlot = Math.min(OPD.endMinutes - step, 21 * 60);
  for (let value = OPD.startMinutes; value <= lastAllowedSlot; value += step) {
    slots.push(toHHMM(value));
  }
  return slots;
}

export function getOpdHoursLabel() {
  const format12 = (totalMinutes) => {
    const h24 = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const suffix = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(mins).padStart(2, "0")} ${suffix}`;
  };
  return `${format12(OPD.startMinutes)} to ${format12(OPD.endMinutes)}`;
}
