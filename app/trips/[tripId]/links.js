import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Alert, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../constants/colors";
import { typography } from "../../../constants/typography";
import { subscribeToLinks, addLink, deleteLink } from "../../../services/tripService";
import { validateFields, isRequired, isValidUrl } from "../../../utils/validators";
import AppInput from "../../../components/AppInput";
import AppButton from "../../../components/AppButton";
import Chip from "../../../components/Chip";
import EmptyState from "../../../components/EmptyState";

const LINK_TYPES = [
  { key: "ticket", label: "Ticket", icon: "ticket-outline" },
  { key: "flight", label: "Flight", icon: "airplane-outline" },
  { key: "hotel", label: "Hotel", icon: "bed-outline" },
  { key: "parking", label: "Parking", icon: "car-outline" },
  { key: "rentalCar", label: "Rental Car", icon: "car-sport-outline" },
  { key: "cruise", label: "Cruise Docs", icon: "boat-outline" },
  { key: "restaurant", label: "Restaurant", icon: "restaurant-outline" },
  { key: "custom", label: "Other", icon: "link-outline" }
];

// Reservations & Links: save labeled URLs for tickets, flights, hotels,
// parking, rental cars, cruise documents, or anything else, and open
// them with the device browser / appropriate installed app.
export default function LinksScreen() {
  const { tripId } = useLocalSearchParams();
  const [links, setLinks] = useState([]);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [type, setType] = useState("ticket");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToLinks(tripId, setLinks, () => {});
    return unsubscribe;
  }, [tripId]);

  async function handleAdd() {
    const fieldErrors = validateFields(
      { label, url },
      {
        label: { check: isRequired, message: "Label is required." },
        url: { check: isValidUrl, message: "Enter a valid http(s) URL." }
      }
    );
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSaving(true);
    try {
      await addLink(tripId, {
        type,
        label: label.trim(),
        url: url.trim(),
        confirmationNumber: confirmationNumber.trim() || null
      });
      setLabel("");
      setUrl("");
      setConfirmationNumber("");
    } finally {
      setSaving(false);
    }
  }

  async function handleOpen(link) {
    const canOpen = await Linking.canOpenURL(link.url);
    if (canOpen) {
      Linking.openURL(link.url);
    } else {
      Alert.alert("Can't open link", "This device can't open that URL.");
    }
  }

  function confirmDelete(link) {
    Alert.alert("Remove this link?", link.label, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteLink(tripId, link.id) }
    ]);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={links}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="link-outline" title="No links yet" subtitle="Add a ticket, flight, hotel, or other reservation link below." />}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.sectionLabel}>Type</Text>
            <View style={styles.chipRow}>
              {LINK_TYPES.map((t) => (
                <Chip key={t.key} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />
              ))}
            </View>
            <AppInput label="Label" value={label} onChangeText={setLabel} placeholder="e.g. Concert Ticket" error={errors.label} />
            <AppInput label="URL" value={url} onChangeText={setUrl} placeholder="https://..." keyboardType="url" autoCapitalize="none" error={errors.url} />
            <AppInput label="Confirmation Number (optional)" value={confirmationNumber} onChangeText={setConfirmationNumber} placeholder="ABC123" />
            <AppButton title="Save Link" onPress={handleAdd} loading={saving} />
            {links.length > 0 && <Text style={styles.sectionLabel}>Saved Links</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const meta = LINK_TYPES.find((t) => t.key === item.type) || LINK_TYPES[LINK_TYPES.length - 1];
          return (
            <View style={styles.row}>
              <Pressable style={styles.rowMain} onPress={() => handleOpen(item)}>
                <View style={styles.iconCircle}>
                  <Ionicons name={meta.icon} size={18} color={colors.primaryPink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
                  <Text style={styles.url} numberOfLines={1}>{item.url}</Text>
                  {item.confirmationNumber ? <Text style={styles.confirmation}>Confirmation: {item.confirmationNumber}</Text> : null}
                </View>
                <Ionicons name="open-outline" size={18} color={colors.darkGray} />
              </Pressable>
              <Pressable onPress={() => confirmDelete(item)} hitSlop={8} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={18} color={colors.darkGray} />
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  list: { padding: 20, paddingBottom: 40 },
  form: { marginBottom: 8 },
  sectionLabel: { ...typography.sectionTitle, fontSize: 16, color: colors.black, marginBottom: 8, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.white, borderRadius: 12, padding: 12, marginBottom: 8 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.softPink, alignItems: "center", justifyContent: "center", marginRight: 10 },
  label: { ...typography.cardTitle, fontSize: 15, color: colors.black },
  url: { ...typography.caption, color: colors.darkGray, marginTop: 2 },
  confirmation: { ...typography.caption, color: colors.primaryPink, marginTop: 2 },
  deleteButton: { paddingLeft: 10 }
});
