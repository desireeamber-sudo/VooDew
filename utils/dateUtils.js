// Centralized helpers for "date-only" values (trip startDate/endDate,
// expense date) stored in Firestore as "YYYY-MM-DD" strings.
//
// Why this file exists: `new Date("2026-08-14")` parses the string as UTC
// midnight per the ECMA-262 spec, NOT local midnight. In any timezone
// behind UTC (all of the US, for example), that instant falls on the
// *previous* local calendar day. Combined with `.setHours(0,0,0,0)` (which
// operates in local time), this silently shifted "today" to "yesterday" or
// "tomorrow" depending on time of day and timezone -- the root cause of the
// countdown/status bugs. Every date-only string in the app must be parsed
// with dateStringToLocalDate() below instead of `new Date(str)`, and every
// date-only string produced from a Date must use localDateToDateString()
// below instead of `.toISOString().slice(0, 10)` (also UTC-based).

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date as a local "YYYY-MM-DD" string (no UTC conversion). */
export function getTodayDateString() {
  return localDateToDateString(new Date());
}

/** Converts a JS Date to a local "YYYY-MM-DD" string using local getters. */
export function localDateToDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a "YYYY-MM-DD" string into a Date set at LOCAL midnight for that
 * calendar day. Returns null for empty/invalid input.
 */
export function dateStringToLocalDate(dateString) {
  if (!dateString) return null;
  const match = DATE_ONLY_REGEX.exec(dateString);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** True if `dateString` is a syntactically valid "YYYY-MM-DD" date. */
export function isValidDateString(dateString) {
  return dateStringToLocalDate(dateString) !== null;
}

/**
 * True when there's no end date, or the end date is on/after the start
 * date. Both inputs are "YYYY-MM-DD" strings. Used to block saving an end
 * date earlier than the start date.
 */
export function isEndDateValid(startDate, endDate) {
  if (!endDate) return true;
  const start = dateStringToLocalDate(startDate);
  const end = dateStringToLocalDate(endDate);
  if (!start || !end) return true; // required-field validation handles empty/malformed startDate separately
  return end.getTime() >= start.getTime();
}

/** Whole-day difference (to - from) between two "YYYY-MM-DD" strings, local-safe. */
export function daysBetweenDateStrings(fromDateString, toDateString) {
  const from = dateStringToLocalDate(fromDateString);
  const to = dateStringToLocalDate(toDateString);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Derives a trip's status relative to today, local-safe.
 * Returns { status, label, daysUntil }:
 *   - "upcoming"   -> "X day(s) to go"      (before startDate)
 *   - "today"      -> "Happening today"     (startDate is today)
 *   - "inProgress" -> "In progress"         (after startDate, on/before endDate)
 *   - "past"       -> "Past"                (after endDate, or after startDate with no endDate)
 * Returns status: null when startDate is missing/invalid.
 */
export function getTripDateStatus(startDate, endDate) {
  const today = getTodayDateString();
  const effectiveEnd = endDate || startDate;
  const daysToStart = daysBetweenDateStrings(today, startDate);
  const daysToEnd = daysBetweenDateStrings(today, effectiveEnd);

  if (daysToStart === null) return { status: null, label: "", daysUntil: null };

  if (daysToStart > 0) {
    return {
      status: "upcoming",
      label: `${daysToStart} day${daysToStart === 1 ? "" : "s"} to go`,
      daysUntil: daysToStart
    };
  }
  if (daysToStart === 0) {
    return { status: "today", label: "Happening today", daysUntil: 0 };
  }
  if (daysToEnd !== null && daysToEnd >= 0) {
    return { status: "inProgress", label: "In progress", daysUntil: daysToStart };
  }
  return { status: "past", label: "Past", daysUntil: daysToStart };
}

/** Friendly display string, e.g. "Aug 14, 2026", for a "YYYY-MM-DD" value. */
export function formatDateForDisplay(dateString) {
  const date = dateStringToLocalDate(dateString);
  if (!date) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---------- Time-of-day ("HH:mm", 24-hour) + reminder datetime helpers ----------
// Reminders need a specific time-of-day, not just a calendar day, so these
// work alongside (not instead of) the date-only helpers above.

/** Parses a "HH:mm" string into a Date carrying today's date + that time -- only used to feed the native time picker a Date object. */
export function timeStringToDate(timeString) {
  const date = new Date();
  if (!timeString) return date;
  const [hours, minutes] = timeString.split(":").map(Number);
  date.setHours(Number.isNaN(hours) ? 0 : hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
  return date;
}

/** Converts a Date's time-of-day into a zero-padded 24-hour "HH:mm" string. */
export function dateToTimeString(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Friendly time label, e.g. "9:00 AM", for a "HH:mm" string. */
export function formatTimeForDisplay(timeString) {
  if (!timeString) return "";
  return timeStringToDate(timeString).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Combines a "YYYY-MM-DD" date string and a "HH:mm" time string into a
 * single local Date instant, suitable for scheduling a notification or
 * storing as an ISO string. Returns null if either part is missing/invalid.
 */
export function combineDateAndTimeStrings(dateString, timeString) {
  const datePart = dateStringToLocalDate(dateString);
  if (!datePart || !timeString) return null;
  const [hours, minutes] = timeString.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const combined = new Date(datePart);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

// ---------- Calendar-grid helpers (for the branded date picker) ----------
// These back components/CalendarGrid.js. Kept here, alongside the rest of
// the date logic, instead of inline in a component, so the month-matrix
// math is unit-testable on its own and stays local-date-safe -- every cell
// is built with the `new Date(year, month, day)` constructor form (local
// time), never by parsing a string, so there's no UTC-shift risk here
// either.

/** Friendly "August 2026" label for a given (0-indexed) month. */
export function getMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * Builds a calendar grid for `month` (0-indexed) as an array of week rows,
 * each with exactly 7 cells. Cells outside the month (padding before day 1
 * or after the last day) are `null`; real days are
 * `{ dateString: "YYYY-MM-DD", day: number }`.
 */
export function buildCalendarMonth(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ dateString: localDateToDateString(new Date(year, month, day)), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Adds `delta` months (can be negative) to a { year, month } pair. */
export function addMonths(year, month, delta) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/**
 * Friendly "Today • 9:00 AM" / "Tomorrow • 5:30 PM" / "Jan 27 • 9:00 AM"
 * label for a real Date (e.g. `new Date(reminder.dateTime)`).
 */
export function formatReminderWhen(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const dateOnly = localDateToDateString(date);
  const daysUntil = daysBetweenDateStrings(getTodayDateString(), dateOnly);
  const timeLabel = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  let dayLabel;
  if (daysUntil === 0) dayLabel = "Today";
  else if (daysUntil === 1) dayLabel = "Tomorrow";
  else dayLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return `${dayLabel} • ${timeLabel}`;
}
