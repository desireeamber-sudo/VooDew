import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";

// Single checklist row: checkbox + strikethrough on completion, plus
// reminder/edit/delete actions, matching the design direction for
// completion states.
//
// `footer` is an optional node rendered below the title -- used by the
// Checklist screen to show a concise "Reminder: Aug 14 at 8:27 PM" summary
// ONLY when the item already has a linked reminder. It's intentionally
// omitted (not a muted placeholder) when there isn't one yet, so the list
// isn't cluttered with a call-to-action under every single row -- setting a
// reminder is opt-in via the bell icon below, not implied to be required.
//
// `hasReminder` / `onReminderPress` back that bell icon: tapping it either
// opens the reminder that's already linked to this item, or starts creating
// one pre-linked to it, depending on `hasReminder`.
export default function ChecklistRow({ item, onToggle, onEdit, onDelete, onReminderPress, hasReminder, footer }) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        style={styles.checkbox}
        testID={`checklist-item-toggle-${item.id}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.completed }}
        accessibilityLabel={`Mark "${item.title}" as ${item.completed ? "not done" : "done"}`}
      >
        <Ionicons
          name={item.completed ? "checkbox" : "square-outline"}
          size={24}
          color={item.completed ? colors.primaryPink : colors.darkGray}
        />
      </Pressable>

      <View style={styles.textWrap}>
        <Pressable onPress={onEdit}>
          <Text style={[styles.title, item.completed && styles.titleCompleted]} numberOfLines={2}>
            {item.title}
          </Text>
        </Pressable>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>

      {onReminderPress ? (
        <Pressable
          onPress={onReminderPress}
          hitSlop={8}
          style={styles.reminderButton}
          testID={`checklist-item-reminder-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={hasReminder ? `View reminder for "${item.title}"` : `Set a reminder for "${item.title}"`}
        >
          <Ionicons
            name={hasReminder ? "notifications" : "notifications-outline"}
            size={18}
            color={hasReminder ? colors.primaryPink : colors.darkGray}
          />
        </Pressable>
      ) : null}

      <Pressable
        onPress={onDelete}
        hitSlop={8}
        style={styles.deleteButton}
        testID={`checklist-item-delete-${item.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Delete "${item.title}"`}
      >
        <Ionicons name="trash-outline" size={18} color={colors.darkGray} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8
  },
  checkbox: { marginRight: 10 },
  textWrap: { flex: 1 },
  title: { ...typography.body, color: colors.black },
  titleCompleted: { color: colors.darkGray, textDecorationLine: "line-through" },
  footer: { marginTop: 4 },
  reminderButton: { paddingHorizontal: 8 },
  deleteButton: { paddingLeft: 2 }
});
