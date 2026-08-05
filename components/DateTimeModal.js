import React from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import AppButton from "./AppButton";

// Shared pink-branded modal chrome for the date & time pickers: a rounded
// white card on a dimmed backdrop, with a title, arbitrary body content,
// and clear Cancel/Confirm actions. Replaces the OS's teal/green Material
// date & time dialogs (Android) so picking a date or time looks like the
// rest of VooDew everywhere it happens -- Start Date, End Date, expense
// date, settlement date, and reminder date/time all share this one
// component (see DateField.js / TimeField.js).
//
// Built entirely from React Native core (Modal/View/Text) plus this app's
// own AppButton -- no new dependency, and Modal behaves the same on both
// platforms, so there's no Android/iOS branching left to maintain here.
export default function DateTimeModal({
  visible,
  title,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  confirmDisabled,
  children,
  testID
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} testID={testID}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
          <View style={styles.buttonRow}>
            <AppButton
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              style={styles.button}
              testID={testID ? `${testID}-cancel` : undefined}
            />
            <AppButton
              title={confirmLabel}
              onPress={onConfirm}
              disabled={confirmDisabled}
              style={styles.button}
              testID={testID ? `${testID}-confirm` : undefined}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(23, 23, 23, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20
  },
  title: { ...typography.sectionTitle, color: colors.black, marginBottom: 14, textAlign: "center" },
  buttonRow: { flexDirection: "row", marginTop: 18 },
  button: { flex: 1, marginHorizontal: 4 }
});
