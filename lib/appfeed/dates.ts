/** Returns a validated YYYY-MM-DD date as a whole UTC day number. */
function isoDayNumber(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.floor(date.getTime() / 86_400_000);
}

/**
 * Returns true when a lease end is within the inclusive 60-day reminder window.
 * Both values must be validated YYYY-MM-DD dates.
 */
export function isRenewalReminderDue(leaseEnd: string, today: string): boolean {
  const remaining = isoDayNumber(leaseEnd) - isoDayNumber(today);
  return remaining >= 0 && remaining <= 60;
}

/** Returns today's date in Asia/Taipei as YYYY-MM-DD. */
export function todayInTaipei(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}
