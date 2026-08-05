import {
  getTodayDateString,
  dateStringToLocalDate,
  localDateToDateString,
  isEndDateValid,
  getTripDateStatus,
  formatDateForDisplay,
  buildCalendarMonth,
  getMonthLabel,
  addMonths
} from "../dateUtils";

describe("local date parsing (no UTC shift)", () => {
  test("today's date string round-trips to the same local calendar day", () => {
    const today = getTodayDateString();
    const parsed = dateStringToLocalDate(today);
    expect(localDateToDateString(parsed)).toBe(today);
  });

  test("a date-only string is never off by one day due to UTC parsing", () => {
    // Historical bug: `new Date("2026-08-14")` parses as UTC midnight, which
    // in any negative-UTC-offset timezone lands on Aug 13 locally.
    const parsed = dateStringToLocalDate("2026-08-14");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7); // August, 0-indexed
    expect(parsed.getDate()).toBe(14);
  });

  test("a date read back from Firestore as a plain YYYY-MM-DD string parses to the correct calendar day", () => {
    // Trips are stored with startDate/endDate as plain date-only strings,
    // not Firestore Timestamps -- this is what comes back from a real read.
    const parsed = dateStringToLocalDate("2026-12-31");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(11);
    expect(parsed.getDate()).toBe(31);
  });

  test("returns null for an empty or malformed date string", () => {
    expect(dateStringToLocalDate("")).toBeNull();
    expect(dateStringToLocalDate("08/14/2026")).toBeNull();
  });
});

describe("getTripDateStatus", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 14, 12, 0, 0)); // "today" = Aug 14, 2026, noon local
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("today's local date is not treated as tomorrow or yesterday", () => {
    expect(getTodayDateString()).toBe("2026-08-14");
  });

  test("a trip happening today (no end date) shows 'Happening today'", () => {
    const status = getTripDateStatus("2026-08-14", "");
    expect(status.status).toBe("today");
    expect(status.label).toBe("Happening today");
  });

  test("a future trip shows the correct days-to-go", () => {
    const status = getTripDateStatus("2026-08-19", "");
    expect(status.status).toBe("upcoming");
    expect(status.label).toBe("5 days to go");
    expect(status.daysUntil).toBe(5);
  });

  test("a trip starting tomorrow uses singular 'day' wording", () => {
    const status = getTripDateStatus("2026-08-15", "");
    expect(status.label).toBe("1 day to go");
  });

  test("an active multi-day trip (started, not yet ended) shows 'In progress'", () => {
    const status = getTripDateStatus("2026-08-12", "2026-08-16");
    expect(status.status).toBe("inProgress");
    expect(status.label).toBe("In progress");
  });

  test("a finished trip shows 'Past'", () => {
    const status = getTripDateStatus("2026-08-01", "2026-08-05");
    expect(status.status).toBe("past");
    expect(status.label).toBe("Past");
  });

  test("a trip that starts and ends today is 'Happening today', not 'In progress'", () => {
    const status = getTripDateStatus("2026-08-14", "2026-08-14");
    expect(status.status).toBe("today");
  });
});

describe("isEndDateValid", () => {
  test("an end date before the start date fails validation", () => {
    expect(isEndDateValid("2026-08-14", "2026-08-10")).toBe(false);
  });

  test("an end date on the same day as the start date is valid", () => {
    expect(isEndDateValid("2026-08-14", "2026-08-14")).toBe(true);
  });

  test("an end date after the start date is valid", () => {
    expect(isEndDateValid("2026-08-14", "2026-08-20")).toBe(true);
  });

  test("no end date is valid (single-day trip)", () => {
    expect(isEndDateValid("2026-08-14", "")).toBe(true);
  });
});

describe("buildCalendarMonth", () => {
  test("pads the first week so day 1 lands on its correct weekday (Aug 2026 starts on a Saturday)", () => {
    const weeks = buildCalendarMonth(2026, 7); // August, 0-indexed
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0][6]).toEqual({ dateString: "2026-08-01", day: 1 });
  });

  test("includes every day of the month with correctly zero-padded date strings", () => {
    const weeks = buildCalendarMonth(2026, 7);
    const allDays = weeks.flat().filter(Boolean);
    expect(allDays.length).toBe(31);
    expect(allDays[0]).toEqual({ dateString: "2026-08-01", day: 1 });
    expect(allDays[allDays.length - 1]).toEqual({ dateString: "2026-08-31", day: 31 });
  });

  test("every week row has exactly 7 cells, including padding on the trailing week", () => {
    const weeks = buildCalendarMonth(2026, 7);
    weeks.forEach((week) => expect(week.length).toBe(7));
  });

  test("handles February in a leap year (2028) correctly", () => {
    const allDays = buildCalendarMonth(2028, 1).flat().filter(Boolean); // February, 0-indexed
    expect(allDays.length).toBe(29);
  });

  test("handles February in a non-leap year (2026) correctly", () => {
    const allDays = buildCalendarMonth(2026, 1).flat().filter(Boolean);
    expect(allDays.length).toBe(28);
  });
});

describe("getMonthLabel", () => {
  test("formats a year/month as a friendly label", () => {
    expect(getMonthLabel(2026, 7)).toBe("August 2026");
  });
});

describe("addMonths", () => {
  test("adds months forward, rolling into the next year", () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 }); // Dec 2026 -> Jan 2027
  });

  test("adds months backward, rolling into the previous year", () => {
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 }); // Jan 2026 -> Dec 2025
  });

  test("stays within the same year for a simple forward step", () => {
    expect(addMonths(2026, 7, 1)).toEqual({ year: 2026, month: 8 }); // Aug -> Sep
  });
});

describe("formatDateForDisplay", () => {
  test("formats a date-only string as a short human-readable date", () => {
    expect(formatDateForDisplay("2026-08-14")).toBe("Aug 14, 2026");
  });

  test("returns an empty string for an invalid date string", () => {
    expect(formatDateForDisplay("not-a-date")).toBe("");
  });
});
