import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import { timeStringToDate, dateToTimeString, formatTimeForDisplay } from "../utils/dateUtils";

// Reusable native time picker field, the time-of-day sibling of DateField.
// Works with the app's "HH:mm" (24-hour) time-only string convention --
// callers never touch a Date object. Reuses the same
// @react-native-community/datetimepicker native module already installed
// for DateField, just with mode="time" -- no new native dependency.
export default function TimeField({ label, value, onChange, error, placeholder = "Select a time" }) {
  const [open, setOpen] = useState(false);
  const selectedTime = timeStringToDate(value);

  function handleChange(event, pickedDate) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "dismissed" || !pickedDate) return;
    }
    if (pickedDate) {
      onChange(dateToTimeString(pickedDate));
    }
  }

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={[styles.field, error && styles.fieldError]} onPress={() => setOpen(true)}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatTimeForDisplay(value) : placeholder}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {open &&
        (Platform.OS === "android" ? (
          <DateTimePicker value={selectedTime} mode="time" display="default" onChange={handleChange} />
        ) : (
          <View style={styles.iosPickerWrap}>
            <DateTimePicker value={selectedTime} mode="time" display="spinner" onChange={handleChange} />
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
  iosPickerWrap: { backgroundColor: colors.white, borderRadius: 12, marginTop: 8, paddingBottom: 8 },
  iosDoneButton: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 8 },
  iosDoneText: { ...typography.cardTitle, fontSize: 14, color: colors.primaryPink }
});
