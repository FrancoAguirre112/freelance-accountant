// lib/date-utils.ts
import { eachMonthOfInterval, format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Generates a safe list of months between two dates.
 * It ignores timezones by treating input dates as simple "YYYY-MM-DD" strings.
 */
export function getSafeMonthsInRange(from: Date, to: Date) {
  // 1. Convert to ISO String and take the date part "2026-01-01"
  // This strips any weird "21:00" times from previous timezone shifts
  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];

  // 2. Create "Noon Dates" locally.
  // 12:00 PM is the safest time: impossible to shift to prev/next day
  // regardless of timezone (unless you live in the ocean).
  const start = new Date(fromStr + "T12:00:00");
  const end = new Date(toStr + "T12:00:00");

  const months = eachMonthOfInterval({ start, end });

  return months.map((date) => {
    // 3. Create a stable ID for matching (e.g., "2026-01")
    const id = format(date, "yyyy-MM");

    // 4. Create a nice label (e.g., "Enero 2026")
    const label = format(date, "MMMM yyyy", { locale: es });
    const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

    return {
      id, // Use this for logic/matching
      label: capitalizedLabel, // Use this for display
      dateObj: date, // Keep original safe date just in case
    };
  });
}

/**
 * Converts a Date to a "YYYY-MM" string key safely
 */
export function toMonthKey(date: Date) {
  return date.toISOString().slice(0, 7); // Returns "2026-01"
}

/**
 * Formats a date for display, ignoring timezone shifts.
 * Use this for Transactions Lists and Project Dates.
 * Input: Date(Jan 1 00:00) -> Output: "01/01/2026"
 */
export function formatSafeDate(date: Date, formatStr: string = "dd/MM/yyyy") {
  // Create a copy to avoid mutating the original
  const d = new Date(date);

  // Force it to Noon UTC (12:00) just for formatting purposes
  // This ensures that even if the browser subtracts 3-12 hours, it stays on the same day.
  d.setUTCHours(12, 0, 0, 0);

  return format(d, formatStr, { locale: es });
}

/**
 * Helper to ensure database queries cover the full day (00:00 to 23:59)
 */
export function getQueryBounds(
  from: string | undefined,
  to: string | undefined,
) {
  const now = new Date();

  // Default to start/end of current month if no params
  const start = from
    ? new Date(from)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = to
    ? new Date(to)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Force Full Day Range (00:00:00 to 23:59:59)
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}
