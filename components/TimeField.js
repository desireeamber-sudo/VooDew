import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import { formatTimeForDisplay } from "../utils/dateUtils";
import DateTimeModal from "./DateTimeModal";
import TimePickerBody from "./TimePickerBody";

// Default pending selection the first time a TimeField with no value yet
// is opened -- a fixed, predictable 9:00 AM rather than "whatever the
// clock happens to read right now", which would make the picker's
// starting point (and any test of it) non-deterministic.
const DEFAULT_HOUR_12 = 9;
const DEFAULT_MINUTE = 0;
const DEFAULT_PERIOD = "AM";

/** Converts a "HH:mm" (24-hour) string into { hour12, minute, period } for the picker. */
function timeStringToPending(timeString) {
  if (!timeString) return { hour12: DEFAULT_HOUR_12, minute: DEFAULT_MINUTE, period: DEFAULT_PERIOD };
  const [hours, minutes] = timeString.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return { hour12: DEFAULT_HOUR_12, minute: DEFAULT_MINUTE, period: DEFAULT_PERIOD };
  }
  const period = hours >= 12 ? "PM" : "AM";
  let hour12 = hours % 12;
  if (hour12 === 0) hour12 = 12;
  // The picker only offers 5-minute increments -- round to the nearest one
  // so a value saved some other way still lands on a selectable option.
  const minute = (Math.round(minutes / 5) * 5) % 60;
  return { hour12, minute, period };
}

/** Converts { hour12, minute, period } back into a "HH:mm" (24-hour) string. */
function pendingToTimeString(hour12, minute, period) {
  let hours = hour12 % 12;
  if (period === "PM") hours += 12;
  return `${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Reusable branded time picker field, the time-of-day sibling of
// DateField.js -- same pink modal chrome (DateTimeModal), same
// stage-then-confirm pattern, same reasons: replacing the OS's native time
// dialog (teal/green Material on Android) with something that matches the
// rest of the app, on both platforms, with no new dependency. Works with
// the app's "HH:mm" (24-hour) time-only string convention -- callers never
// touch a Date object.
export default function TimeField({ label, value, onChange, error, placeholder = "Select a time", testID }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(() => timeStringToPending(value));

  function openPicker() {
    setPending(timeStringToPending(value));
    setOpen(true);
  }
  function handleConfirm() {
    onChange(pendingToTimeString(pending.hour12, pending.minute, pending.period));
    setOpen(false);
  }
  function handleCancel() {
    setOpen(false);
  }

  const pendingTimeString = pendingToTimeString(pending.hour12, pending.minute, pending.period);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={[styles.field, error && styles.fieldError]}
        onPress={openPicker}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${value ? formatTimeForDisplay(value) : placeholder}` : undefined}
      >
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatTimeForDisplay(value) : placeholder}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {open && (
        <DateTimeModal
          visible
          title={label || "Select a time"}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          testID={testID}
        >
          <Text style={styles.selectedPreview}>{formatTimeForDisplay(pendingTimeString)}</Text>
          <TimePickerBody
            hour12={pending.hour12}
            minute={pending.minute}
            period={pending.period}
            onChangeHour={(h) => setPending((p) => ({ ...p, hour12: h }))}
            onChangeMinute={(m) => setPending((p) => ({ ...p, minute: m }))}
            onChangePeriod={(per) => setPending((p) => ({ ...p, period: per }))}
            testID={testID}
          />
        </DateTimeModal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    ...typography.caption,
    color: colors.darkGray,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  field: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  fieldError: { borderColor: colors.danger },
  valueText: { ...typography.body, color: colors.black },
  placeholderText: { ...typography.body, color: colors.darkGray },
  error: { ...typography.caption, color: colors.danger, marginTop: 4 },
  selectedPreview: {
    ...typography.screenTitle,
    fontSize: 20,
    color: colors.primaryPink,
    textAlign: "center",
    marginBottom: 8
  }
});
