import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import { formatDateForDisplay, getTodayDateString } from "../utils/dateUtils";
import DateTimeModal from "./DateTimeModal";
import CalendarGrid from "./CalendarGrid";

// Reusable branded date picker field. Works entirely with the app's
// "YYYY-MM-DD" date-only string convention -- callers never touch a Date
// object, and the local-safe parsing lives once in utils/dateUtils.js
// instead of being duplicated per screen.
//
// Renders a pink-branded modal (DateTimeModal + CalendarGrid) instead of
// the OS's native date dialog, which on Android used teal/green Material
// styling that didn't match VooDew's pink/black/white look. Selection is
// staged in local `pendingDate` state and only committed to `onChange` on
// Confirm -- Cancel discards it -- giving this picker the same
// local-date-safe defaulting, minimumDate floor, and end-before-start
// protection the native picker had, plus an explicit confirm step it
// didn't. Same component, same behavior, on both platforms -- no
// Platform.OS branching needed anymore.
export default function DateField({
  label,
  value, // "YYYY-MM-DD" or ""
  onChange, // (dateString) => void
  onClear, // optional -- shows a "Clear" action when provided and value is set
  error,
  minimumDate, // optional "YYYY-MM-DD" floor
  placeholder = "Select a date",
  // Optional stable identifier for screens that render more than one
  // DateField at once (e.g. Create/Edit Trip's Start Date + End Date) --
  // without it, two pickers on the same screen are indistinguishable to
  // tests (and to accessibility tooling). Forwarded to every interactive
  // piece of the picker (field, calendar days, month nav, confirm/cancel),
  // each with its own suffix so none of them collide.
  testID
}) {
  const [open, setOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState(value || getTodayDateString());

  function openPicker() {
    setPendingDate(value || getTodayDateString());
    setOpen(true);
  }
  function handleConfirm() {
    onChange(pendingDate);
    setOpen(false);
  }
  function handleCancel() {
    setOpen(false);
  }

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable
          style={[styles.field, error && styles.fieldError]}
          onPress={openPicker}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label ? `${label}: ${value ? formatDateForDisplay(value) : placeholder}` : undefined}
        >
          <Text style={value ? styles.valueText : styles.placeholderText}>
            {value ? formatDateForDisplay(value) : placeholder}
          </Text>
        </Pressable>
        {onClear && value ? (
          <Pressable onPress={onClear} hitSlop={8} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {open && (
        <DateTimeModal
          visible
          title={label || "Select a date"}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          testID={testID}
        >
          <Text style={styles.selectedPreview}>{formatDateForDisplay(pendingDate)}</Text>
          <CalendarGrid value={pendingDate} minimumDate={minimumDate} onSelectDate={setPendingDate} testID={testID} />
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
  row: { flexDirection: "row", alignItems: "center" },
  field: {
    flex: 1,
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
  clearButton: { marginLeft: 10 },
  clearText: { ...typography.caption, color: colors.primaryPink },
  error: { ...typography.caption, color: colors.danger, marginTop: 4 },
  selectedPreview: {
    ...typography.screenTitle,
    fontSize: 20,
    color: colors.primaryPink,
    textAlign: "center",
    marginBottom: 14
  }
});
