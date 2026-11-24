// Dates shown to customers use India time, so they match Razorpay's renewal dates (which fall at midnight IST).
export function formatIndiaDate(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}
