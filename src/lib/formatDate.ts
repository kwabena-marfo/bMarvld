// Dates in client messages read like "Mon/10/01/27": weekday/day/month/year.
// Accepts a booking date ("YYYY-MM-DD") or a Date, shown in Ghana time.
export function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Accra",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  return `${parts.weekday}/${parts.day}/${parts.month}/${parts.year}`;
}
