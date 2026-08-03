// Default checklist templates, keyed by event type and (when relevant)
// travel mode. These are copied into a trip's checklistItems when the
// trip is created; editing a trip's checklist never mutates this file.

// travelBehavior controls how Create/Edit Trip asks about travel:
//   "never"  - never a travel question (In-Town Concert)
//   "always" - travel is implied; skip straight to transportation choices
//              (Out-of-Town Concert)
//   "cruise" - the event itself is the trip; ask transportation only for
//              getting to/from the departure city, no "Cruising" option
//   "ask"    - ask Local vs Traveling first; only show transportation
//              choices if Traveling is picked (Festival, Custom Event)
export const EVENT_TYPES = [
  { key: "inTownConcert", label: "In-Town Concert", travelBehavior: "never" },
  { key: "outOfTownConcert", label: "Out-of-Town Concert", travelBehavior: "always" },
  { key: "cruise", label: "Cruise", travelBehavior: "cruise" },
  { key: "festival", label: "Festival", travelBehavior: "ask" },
  { key: "custom", label: "Custom Event", travelBehavior: "ask" }
];

// Transportation TO the event/departure city. "Cruising" is intentionally
// not an option here -- for the Cruise event type the cruise itself is the
// event, not a way of getting somewhere else.
export const TRAVEL_MODES = [
  { key: "driving", label: "Driving" },
  { key: "flying", label: "Flying" },
  { key: "other", label: "Other" }
];

const BASE_TEMPLATES = {
  inTownConcert: [
    "Purchase or confirm ticket",
    "Download ticket",
    "Check venue rules",
    "Plan outfit",
    "Charge phone",
    "Bring identification",
    "Confirm parking",
    "Get directions",
    "Set departure reminder"
  ],
  cruise: [
    "Complete cruise check-in",
    "Verify identification/passport",
    "Save cruise documents",
    "Print or save luggage tags",
    "Book pre-cruise travel",
    "Book hotel if needed",
    "Arrange port transportation",
    "Review excursions",
    "Pack medications",
    "Set boarding reminder"
  ],
  custom: [
    "Confirm date and time",
    "Save location",
    "Save ticket or reservation",
    "Add directions",
    "Add custom tasks",
    "Set reminder"
  ]
};

// Full checklist for a trip that requires travel and isn't a cruise
// (Out-of-Town Concert, or Festival/Custom Event with "Traveling" picked).
const TRAVEL_TEMPLATES = {
  driving: [
    "Purchase or confirm ticket",
    "Plan driving route",
    "Check vehicle and fuel",
    "Confirm parking",
    "Book hotel if needed",
    "Pack clothes",
    "Pack chargers",
    "Download ticket",
    "Save hotel confirmation",
    "Set travel and event reminders"
  ],
  flying: [
    "Purchase or confirm ticket",
    "Book flight",
    "Check in for flight",
    "Save boarding pass link",
    "Arrange airport transportation",
    "Book hotel if needed",
    "Pack luggage",
    "Download event ticket",
    "Save venue directions",
    "Set flight and event reminders"
  ],
  other: [
    "Purchase or confirm ticket",
    "Plan transportation",
    "Book lodging if needed",
    "Pack bags",
    "Download ticket",
    "Set travel and event reminders"
  ]
};

// Small additions layered onto the cruise base checklist depending on how
// the traveler is getting to the departure city -- not a full duplicate of
// TRAVEL_TEMPLATES, since cruise-specific items like "Book hotel if needed"
// and "Arrange port transportation" are already covered by BASE_TEMPLATES.cruise.
const CRUISE_TRAVEL_ADDONS = {
  driving: ["Plan driving route to departure port", "Check vehicle and fuel before departure"],
  flying: ["Book flight to departure city", "Check in for flight", "Save boarding pass link"],
  other: ["Plan transportation to the departure port"]
};

function finalize(items) {
  return items.map((item, index) => ({
    ...item,
    completed: false,
    order: index,
    isDefault: true
  }));
}

/**
 * Builds the suggested checklist for a trip.
 * @param {string} eventType - key from EVENT_TYPES
 * @param {boolean} travelRequired
 * @param {string|null} travelMode - key from TRAVEL_MODES
 * @returns {{title: string, category: string, completed: boolean, order: number, isDefault: boolean}[]}
 */
export function generateChecklist(eventType, travelRequired, travelMode) {
  if (eventType === "cruise") {
    const base = BASE_TEMPLATES.cruise.map((title) => ({ title, category: "cruise" }));
    const addons = (travelMode && CRUISE_TRAVEL_ADDONS[travelMode] ? CRUISE_TRAVEL_ADDONS[travelMode] : []).map(
      (title) => ({ title, category: "travel" })
    );
    return finalize([...base, ...addons]);
  }

  if (!travelRequired) {
    const localTitles = eventType === "inTownConcert" ? BASE_TEMPLATES.inTownConcert : BASE_TEMPLATES.custom;
    const category = eventType === "inTownConcert" ? "local" : "custom";
    return finalize(localTitles.map((title) => ({ title, category })));
  }

  if (travelMode && TRAVEL_TEMPLATES[travelMode]) {
    return finalize(TRAVEL_TEMPLATES[travelMode].map((title) => ({ title, category: "travel" })));
  }

  // Travel required but no mode chosen -- shouldn't normally happen since
  // Create Trip requires a mode before save, but fall back gracefully.
  return finalize(BASE_TEMPLATES.custom.map((title) => ({ title, category: "custom" })));
}

export function getEventTypeLabel(key) {
  const match = EVENT_TYPES.find((e) => e.key === key);
  return match ? match.label : "Event";
}

export function getTravelModeLabel(key) {
  const match = TRAVEL_MODES.find((m) => m.key === key);
  return match ? match.label : "";
}
