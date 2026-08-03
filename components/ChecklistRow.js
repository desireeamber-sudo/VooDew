import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";

// Single checklist row: checkbox + strikethrough on completion, plus
// edit/delete actions, matching the design direction for completion states.
// `footer` is an optional node rendered below the title -- used by the
// Checklist screen to show "Set reminder..." / "Reminder set for ..."
// under each item without duplicating this component's layout.
export default function ChecklistRow({ item, onToggle, onEdit, onDelete, footer }) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onToggle} hitSlop={8} style={styles.checkbox}>
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

      <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteButton}>
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
  deleteButton: { paddingLeft: 10 }
});
