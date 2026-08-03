import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";

// Small selectable pill used for event type / travel mode pickers.
export default function Chip({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
    marginRight: 8,
    marginBottom: 8
  },
  chipSelected: {
    backgroundColor: colors.softPink,
    borderWidth: 1,
    borderColor: colors.primaryPink
  },
  label: {
    ...typography.caption,
    color: colors.darkGray,
    fontSize: 13
  },
  labelSelected: {
    color: colors.primaryPink,
    fontWeight: "700"
  }
});
