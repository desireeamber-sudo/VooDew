import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import { buildCalendarMonth, addMonths, getMonthLabel, getTodayDateString, dateStringToLocalDate } from "../utils/dateUtils";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Month-grid calendar body for the branded date picker (see
// DateTimeModal.js / DateField.js). Owns its own month-being-viewed state
// -- navigating to a different month never changes what's selected, only
// what's visible -- initialized from the current value (or minimumDate, or
// today) each time it mounts. Every date is built with `new Date(year,
// month, day)`/localDateToDateString, never by parsing a string, so this
// stays local-date-safe the same way the rest of utils/dateUtils.js is.
export default function CalendarGrid({ value, minimumDate, onSelectDate, testID }) {
  const initial = dateStringToLocalDate(value) || dateStringToLocalDate(minimumDate) || new Date();
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  const weeks = buildCalendarMonth(view.year, view.month);
  const today = getTodayDateString();

  function goToPrevMonth() {
    setView((v) => addMonths(v.year, v.month, -1));
  }
  function goToNextMonth() {
    setView((v) => addMonths(v.year, v.month, 1));
  }

  return (
    <View>
      <View style={styles.monthHeader}>
        <Pressable
          onPress={goToPrevMonth}
          hitSlop={8}
          testID={testID ? `${testID}-prev-month` : undefined}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={20} color={colors.primaryPink} />
        </Pressable>
        <Text style={styles.monthLabel}>{getMonthLabel(view.year, view.month)}</Text>
        <Pressable
          onPress={goToNextMonth}
          hitSlop={8}
          testID={testID ? `${testID}-next-month` : undefined}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.primaryPink} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((wLabel, idx) => (
          <Text key={idx} style={styles.weekdayLabel}>
            {wLabel}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIdx) => (
        <View key={weekIdx} style={styles.weekRow}>
          {week.map((cell, cellIdx) => {
            if (!cell) return <View key={cellIdx} style={styles.dayCell} />;
            const disabled = Boolean(minimumDate) && cell.dateString < minimumDate;
            const isSelected = cell.dateString === value;
            const isToday = cell.dateString === today;
            return (
              <Pressable
                key={cellIdx}
                disabled={disabled}
                onPress={() => onSelectDate(cell.dateString)}
                style={styles.dayCell}
                testID={testID ? `${testID}-day-${cell.dateString}` : undefined}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled }}
                accessibilityLabel={cell.dateString}
              >
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && styles.dayCircleSelected,
                    isToday && !isSelected && styles.dayCircleToday
                  ]}
                >
                  <Text style={[styles.dayText, isSelected && styles.dayTextSelected, disabled && styles.dayTextDisabled]}>
                    {cell.day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  monthLabel: { ...typography.cardTitle, fontSize: 16, color: colors.black },
  weekdayRow: { flexDirection: "row", marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: "center", ...typography.caption, color: colors.darkGray },
  weekRow: { flexDirection: "row" },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dayCircleSelected: { backgroundColor: colors.primaryPink },
  dayCircleToday: { borderWidth: 1.5, borderColor: colors.primaryPink },
  dayText: { ...typography.body, fontSize: 14, color: colors.black },
  dayTextSelected: { color: colors.white, fontWeight: "700" },
  dayTextDisabled: { color: colors.border }
});
