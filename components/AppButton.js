import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";

// Reusable button with consistent height/radius/padding and a real
// disabled state, per the design direction ("consistent height, corner
// radius, padding, and disabled state").
export default function AppButton({
  title,
  onPress,
  variant = "primary", // "primary" | "secondary" | "danger"
  disabled = false,
  loading = false,
  style
}) {
  const isSecondary = variant === "secondary";
  const isDanger = variant === "danger";

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        isSecondary && styles.secondary,
        isDanger && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? colors.primaryPink : colors.white} />
      ) : (
        <Text
          style={[
            styles.label,
            isSecondary && styles.labelSecondary,
            (disabled || loading) && styles.labelDisabled
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.primaryPink,
    alignItems: "center",
    justifyContent: "center"
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primaryPink
  },
  danger: {
    backgroundColor: colors.danger
  },
  disabled: {
    backgroundColor: colors.lightGray
  },
  pressed: {
    opacity: 0.85
  },
  label: {
    ...typography.cardTitle,
    color: colors.white
  },
  labelSecondary: {
    color: colors.primaryPink
  },
  labelDisabled: {
    color: colors.darkGray
  }
});
