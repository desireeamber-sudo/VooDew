import React, { useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import AppButton from "./AppButton";
import { requestCameraPhoto, requestLibraryPhoto, persistCoverPhoto } from "../services/imageService";

// Optional Trip Cover Photo picker for Create/Edit Trip. Two clear actions
// (Take Photo / Choose from Library) that stay available even once a photo
// is set, so they double as "Replace", plus a separate "Remove" action.
// Camera/library permission is requested only when the corresponding
// button is pressed, never on mount; a denial shows an inline explanation
// instead of crashing. The picked image is copied into persistent storage
// by services/imageService.js before `onChange` fires, so the uri handed
// back is always safe to keep in the trip's form state and save.
export default function CoverPhotoField({ uri, onChange, testID = "cover-photo" }) {
  const [busySource, setBusySource] = useState(null); // "camera" | "library" | null
  const [notice, setNotice] = useState("");

  async function handlePick(pickerFn, source, sourceLabel) {
    setNotice("");
    setBusySource(source);
    try {
      const result = await pickerFn();
      if (result.status === "denied") {
        setNotice(
          `Trip VooDew needs ${sourceLabel} access to add a cover photo. You can allow this in your device Settings, or try the other option instead.`
        );
        return;
      }
      if (result.status === "error") {
        // requestCameraPhoto/requestLibraryPhoto never throw -- a launch
        // failure or (camera-only) timeout comes back as this normalized
        // status instead, with a message specific enough to act on.
        setNotice(result.message || "Something went wrong adding that photo. Please try again.");
        return;
      }
      if (result.status !== "success" || !result.uri) return; // cancelled -- nothing to do
      const persistedUri = await persistCoverPhoto(result.uri);
      onChange(persistedUri);
    } catch (e) {
      // Defensive fallback only -- covers persistCoverPhoto's own copy
      // step failing, since the picker calls above already normalize
      // their own errors instead of throwing.
      setNotice("Something went wrong adding that photo. Please try again.");
    } finally {
      // Always runs -- success, cancel, denial, error, or an unexpected
      // throw -- so the button can never keep spinning.
      setBusySource(null);
    }
  }

  function handleRemove() {
    setNotice("");
    onChange(null);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Trip Cover Photo (optional)</Text>

      {uri ? (
        <Image
          source={{ uri }}
          style={styles.preview}
          accessibilityLabel="Trip cover photo"
          testID={`${testID}-image`}
        />
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.actionRow} testID={`${testID}-actions`}>
        <AppButton
          title={uri ? "Retake Photo" : "Take Photo"}
          variant="secondary"
          onPress={() => handlePick(requestCameraPhoto, "camera", "camera")}
          loading={busySource === "camera"}
          disabled={busySource === "library"}
          testID={`${testID}-take`}
          style={styles.actionButton}
        />
        <AppButton
          title={uri ? "Choose Different Photo" : "Choose from Library"}
          variant="secondary"
          onPress={() => handlePick(requestLibraryPhoto, "library", "photo library")}
          loading={busySource === "library"}
          disabled={busySource === "camera"}
          testID={`${testID}-choose`}
          style={styles.actionButton}
        />
      </View>

      {uri ? (
        <Pressable
          onPress={handleRemove}
          hitSlop={8}
          testID={`${testID}-remove`}
          accessibilityRole="button"
          style={styles.removeRow}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.removeText}>Remove Photo</Text>
        </Pressable>
      ) : null}
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
  preview: {
    width: "100%",
    height: 170,
    borderRadius: 14,
    backgroundColor: colors.lightGray,
    marginBottom: 10
  },
  notice: { ...typography.caption, color: colors.danger, marginBottom: 10 },
  // Side-by-side, equal width: AppButton now uses minHeight instead of a
  // fixed height (see components/AppButton.js), so a longer wrapped label
  // like "Choose Different Photo" grows the button instead of clipping --
  // safe to go two-up here instead of stacking full-width rows.
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  actionButton: { flex: 1 },
  removeRow: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 2 },
  removeText: { ...typography.caption, color: colors.danger, marginLeft: 6 }
});
