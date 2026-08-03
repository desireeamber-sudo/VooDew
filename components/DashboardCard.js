import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";

// General-purpose rounded card used across the Trip Dashboard.
// Two modes:
//  - Info card: pass `title` + children (hero card, progress card, reminder card)
//  - Quick action card: pass `icon` + `label` + `onPress` (Checklist, Map, Expenses, ...)
export default function DashboardCard({ title, icon, label, onPress, children, style }) {
  const isQuickAction = Boolean(icon && label);
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isQuickAction && styles.quickAction,
        pressed && onPress ? styles.pressed : null,
        style
      ]}
    >
      {isQuickAction ? (
        <>
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={22} color={colors.primaryPink} />
          </View>
          <Text style={styles.quickLabel}>{label}</Text>
        </>
      ) : (
        <>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 14
  },
  quickAction: {
    width: "47%",
    alignItems: "flex-start",
    marginRight: "3%"
  },
  pressed: { opacity: 0.85 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.softPink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  quickLabel: { ...typography.cardTitle, color: colors.black },
  title: { ...typography.sectionTitle, color: colors.black, marginBottom: 8 }
});
