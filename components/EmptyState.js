import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import AppButton from "./AppButton";

// Consistent "No trips yet" style empty state with an optional action button.
export default function EmptyState({ icon = "sparkles-outline", title, subtitle, actionLabel, onAction }) {
  return (
    <View style={styles.wrapper}>
      <Ionicons name={icon} size={40} color={colors.primaryPink} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel ? (
        <AppButton title={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 24 },
  title: { ...typography.sectionTitle, color: colors.black, marginTop: 12, textAlign: "center" },
  subtitle: { ...typography.body, color: colors.darkGray, marginTop: 6, textAlign: "center" },
  button: { marginTop: 20, minWidth: 180 }
});
