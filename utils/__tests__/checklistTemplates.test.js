import { EVENT_TYPES, TRAVEL_MODES, generateChecklist, getEventTypeLabel, getTravelModeLabel } from "../checklistTemplates";

describe("In-Town Concert checklist", () => {
  test("contains no flight, hotel, or cruise tasks", () => {
    const titles = generateChecklist("inTownConcert", false, null).map((item) => item.title.toLowerCase());
    titles.forEach((title) => {
      expect(title).not.toMatch(/flight|hotel|cruise/);
    });
  });
});

describe("Out-of-Town Concert checklist", () => {
  test("Driving includes driving-specific tasks and no flight tasks", () => {
    const titles = generateChecklist("outOfTownConcert", true, "driving").map((item) => item.title);
    expect(titles).toEqual(
      expect.arrayContaining(["Plan driving route", "Check vehicle and fuel", "Confirm parking"])
    );
    expect(titles.some((t) => /flight|boarding pass/i.test(t))).toBe(false);
  });

  test("Flying includes flight-specific tasks", () => {
    const titles = generateChecklist("outOfTownConcert", true, "flying").map((item) => item.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "Book flight",
        "Check in for flight",
        "Save boarding pass link",
        "Arrange airport transportation"
      ])
    );
  });
});

describe("Cruise checklist", () => {
  const APPROVED_ORDER = [
    "Book cruise",
    "Verify identification/passport requirements",
    "Book travel to/from departure city",
    "Book hotel if needed",
    "Book drink/dining packages",
    "Review/book excursions",
    "Complete cruise check-in",
    "Save/print cruise documents",
    "Save/print luggage tags",
    "Arrange transportation to/from cruise port",
    "Pack for cruise",
    "Confirm embarkation details",
    "Confirm disembarkation details",
    "Set boarding reminder"
  ];

  test("uses the approved 14-item task order", () => {
    const titles = generateChecklist("cruise", true, "flying").map((item) => item.title);
    expect(titles).toEqual(APPROVED_ORDER);
  });

  test("order is identical regardless of how the traveler gets to the departure city", () => {
    const flying = generateChecklist("cruise", true, "flying").map((item) => item.title);
    const driving = generateChecklist("cruise", true, "driving").map((item) => item.title);
    const noMode = generateChecklist("cruise", true, null).map((item) => item.title);
    expect(flying).toEqual(APPROVED_ORDER);
    expect(driving).toEqual(APPROVED_ORDER);
    expect(noMode).toEqual(APPROVED_ORDER);
  });
});

describe("custom checklist items don't mutate the master template", () => {
  test("pushing onto a generated checklist doesn't affect the next call", () => {
    const first = generateChecklist("inTownConcert", false, null);
    first.push({ title: "Custom item", category: "custom", completed: false, order: 99, isDefault: false });

    const second = generateChecklist("inTownConcert", false, null);
    expect(second.some((item) => item.title === "Custom item")).toBe(false);
    expect(second.length).toBe(first.length - 1);
  });
});

describe("EVENT_TYPES / TRAVEL_MODES", () => {
  test("TRAVEL_MODES does not include a 'Cruising' transportation option", () => {
    expect(TRAVEL_MODES.some((mode) => mode.key === "cruising")).toBe(false);
  });

  test("every EVENT_TYPES entry has a travelBehavior", () => {
    EVENT_TYPES.forEach((eventType) => {
      expect(["never", "always", "cruise", "ask"]).toContain(eventType.travelBehavior);
    });
  });
});

describe("label lookups", () => {
  test("getEventTypeLabel returns the human-readable label", () => {
    expect(getEventTypeLabel("cruise")).toBe("Cruise");
  });

  test("getEventTypeLabel falls back gracefully for an unknown key", () => {
    expect(getEventTypeLabel("madeUpKey")).toBe("Event");
  });

  test("getTravelModeLabel returns the human-readable label", () => {
    expect(getTravelModeLabel("driving")).toBe("Driving");
  });

  test("getTravelModeLabel falls back gracefully for an unknown key", () => {
    expect(getTravelModeLabel("madeUpKey")).toBe("");
  });
});
