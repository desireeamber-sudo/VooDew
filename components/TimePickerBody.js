import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import Chip from "./Chip";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, ... 55
const PERIODS = ["AM", "PM"];

// Time-of-day body for the branded time picker (see DateTimeModal.js /
// TimeField.js): hour, minute (5-minute increments), and AM/PM as
// horizontally-scrollable rows of the app's existing pink Chip component,
// so it's visually consistent with every other selectable-option row in
// the app for free, and every option is a discrete, tappable target
// (nothing to drag or scrub) for clear, testable selection.
export default function TimePickerBody({ hour12, minute, period, onChangeHour, onChangeMinute, onChangePeriod, testID }) {
  return (
    <View>
      <Text style={styles.groupLabel}>Hour</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollRow}>
        {HOURS.map((h) => (
          <Chip
            key={h}
            label={String(h)}
            selected={hour12 === h}
            onPress={() => onChangeHour(h)}
            testID={testID ? `${testID}-hour-${h}` : undefined}
          />
        ))}
      </ScrollView>

      <Text style={styles.groupLabel}>Minute</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollRow}>
        {MINUTES.map((m) => (
          <Chip
            key={m}
            label={String(m).padStart(2, "0")}
            selected={minute === m}
            onPress={() => onChangeMinute(m)}
            testID={testID ? `${testID}-minute-${m}` : undefined}
          />
        ))}
      </ScrollView>

      <Text style={styles.groupLabel}>AM / PM</Text>
      <View style={styles.chipRow}>
        {PERIODS.map((p) => (
          <Chip
            key={p}
            label={p}
            selected={period === p}
            onPress={() => onChangePeriod(p)}
            testID={testID ? `${testID}-period-${p}` : undefined}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    ...typography.caption,
    color: colors.darkGray,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 10
  },
  chipScrollRow: { flexDirection: "row", paddingBottom: 2 },
  chipRow: { flexDirection: "row" }
});
