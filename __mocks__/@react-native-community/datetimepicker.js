// Manual mock for @react-native-community/datetimepicker.
//
// As of the branded date/time picker revision, DateField.js and
// TimeField.js no longer import this package at all -- they render a
// custom pink-branded modal (DateTimeModal + CalendarGrid/TimePickerBody)
// built entirely from React Native core components instead, specifically
// so the picker UI matches the app on both platforms instead of Android's
// teal/green Material dialog. Nothing in the app currently imports the
// real @react-native-community/datetimepicker package, so this mock is
// unused dead weight for now -- left in place (harmless) rather than
// deleted, in case a future screen needs the real native picker again.
import React from "react";
import { Pressable, Text } from "react-native";

// Aug 14, 2026, 9:00 AM -- arbitrary fixed instant, deliberately not
// "today" so date-math bugs would show up as a wrong assertion, not
// accidentally pass by coincidence.
let mockDate = new Date(2026, 7, 14, 9, 0, 0);

// Test-only escape hatch: screen-level tests that need two different picker
// interactions to resolve to two different dates (e.g. picking an end date
// before a start date) can call this between presses. Never used by real
// component code -- DateField/TimeField only ever import the default export.
export function __setMockDate(date) {
  mockDate = date;
}

export default function MockDateTimePicker({ onChange, mode, testID }) {
  // Callers that render more than one picker on screen at once (e.g.
  // Create/Edit Trip's Start Date + End Date) pass an explicit testID so
  // each picker is independently targetable; everyone else falls back to
  // the old shared default.
  const resolvedTestID = testID || (mode === "time" ? "mock-time-picker" : "mock-date-picker");
  return (
    <Pressable testID={resolvedTestID} onPress={() => onChange({ type: "set" }, mockDate)}>
      <Text>{resolvedTestID}</Text>
    </Pressable>
  );
}
