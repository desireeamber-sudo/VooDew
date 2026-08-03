import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import { dateStringToLocalDate, localDateToDateString, formatDateForDisplay } from "../utils/dateUtils";

// Reusable native date picker field. Works entirely with the app's
// "YYYY-MM-DD" date-only string convention -- callers never touch a Date
// object, and the local-safe parsing lives once in utils/dateUtils.js
// instead of being duplicated per screen.
export default function DateField({
  label,
  value, // "YYYY-MM-DD" or ""
  onChange, // (dateString) => void
  onClear, // optional -- shows a "Clear" action when provided and value is set
  error,
  minimumDate, // optional "YYYY-MM-DD" floor
  placeholder = "Select a date"
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = dateStringToLocalDate(value) || new Date();
  const min = minimumDate ? dateStringToLocalDate(minimumDate) : undefined;

  function handleChange(event, pickedDate) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "dismissed" || !pickedDate) return;
    }
    if (pickedDate) {
      onChange(localDateToDateString(pickedDate));
    }
  }

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable style={[styles.field, error && styles.fieldError]} onPress={() => setOpen(true)}>
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

      {open &&
        (Platform.OS === "android" ? (
          <DateTimePicker value={selectedDate} mode="date" display="default" minimumDate={min} onChange={handleChange} />
        ) : (
          <View style={styles.iosPickerWrap}>
            <DateTimePicker value={selectedDate} mode="date" display="inline" minimumDate={min} onChange={handleChange} />
            <Pressable style={styles.iosDoneButton} onPress={() => setOpen(false)}>
              <Text style={styles.iosDoneText}>Done</Text>
            </Pressable>
          </View>
        ))}
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
  iosPickerWrap: { backgroundColor: colors.white, borderRadius: 12, marginTop: 8, paddingBottom: 8 },
  iosDoneButton: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 8 },
  iosDoneText: { ...typography.cardTitle, fontSize: 14, color: colors.primaryPink }
});
