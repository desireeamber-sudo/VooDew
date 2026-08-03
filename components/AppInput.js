import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";

// Reusable text input with a visible label, error text, and strong
// contrast placeholder, per the design direction.
export default function AppInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = "default",
  multiline = false,
  secureTextEntry = false,
  autoCapitalize = "sentences"
}) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.darkGray}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={[
          styles.input,
          multiline && styles.multiline,
          error ? styles.inputError : null
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  input: {
    ...typography.body,
    color: colors.black,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top"
  },
  inputError: {
    borderColor: colors.danger
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 4
  }
});
