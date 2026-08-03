import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../constants/colors";
import { typography } from "../../../constants/typography";
import {
  subscribeToTrip,
  subscribeToTravelers,
  createTraveler,
  assignTravelerToTrip,
  removeTravelerFromTrip
} from "../../../services/tripService";
import { validateFields, isRequired, isValidEmail } from "../../../utils/validators";
import AppInput from "../../../components/AppInput";
import AppButton from "../../../components/AppButton";
import EmptyState from "../../../components/EmptyState";

// Travelers: shows everyone assigned to this trip, lets the user assign
// existing travelers or add a brand-new one, and remove someone from
// the trip without deleting their traveler record entirely.
export default function TravelersScreen() {
  const { tripId } = useLocalSearchParams();
  const [trip, setTrip] = useState(null);
  const [allTravelers, setAllTravelers] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubTrip = subscribeToTrip(tripId, setTrip, () => {});
    const unsubTravelers = subscribeToTravelers(setAllTravelers, () => {});
    return () => {
      unsubTrip();
      unsubTravelers();
    };
  }, [tripId]);

  const assignedIds = trip && trip.travelerIds ? trip.travelerIds : [];
  const assigned = allTravelers.filter((t) => assignedIds.includes(t.id));
  const unassigned = allTravelers.filter((t) => !assignedIds.includes(t.id));

  async function handleAddAndAssign() {
    const fieldErrors = validateFields(
      { name, email },
      {
        name: { check: isRequired, message: "Name is required." },
        email: { check: isValidEmail, message: "Enter a valid email." }
      }
    );
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSaving(true);
    try {
      const id = await createTraveler({ name: name.trim(), email: email.trim() || null });
      await assignTravelerToTrip(tripId, id);
      setName("");
      setEmail("");
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove(traveler) {
    Alert.alert("Remove from trip?", `${traveler.name} will stay in your traveler list but won't be assigned to this trip.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeTravelerFromTrip(tripId, traveler.id) }
    ]);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={assigned}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.sectionLabel}>Add a New Traveler</Text>
            <AppInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Amber" error={errors.name} />
            <AppInput label="Email (optional)" value={email} onChangeText={setEmail} placeholder="amber@example.com" keyboardType="email-address" autoCapitalize="none" error={errors.email} />
            <AppButton title="Add & Assign to Trip" onPress={handleAddAndAssign} loading={saving} style={styles.addButton} />

            {unassigned.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Assign Existing Traveler</Text>
                {unassigned.map((t) => (
                  <Pressable key={t.id} style={styles.unassignedRow} onPress={() => assignTravelerToTrip(tripId, t.id)}>
                    <Text style={styles.unassignedName}>{t.name}</Text>
                    <Ionicons name="add-circle-outline" size={22} color={colors.primaryPink} />
                  </Pressable>
                ))}
              </>
            )}

            <Text style={styles.sectionLabel}>On This Trip ({assigned.length})</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="people-outline" title="No travelers yet" subtitle="Add someone above to assign them to this trip." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {item.email ? <Text style={styles.email}>{item.email}</Text> : null}
            </View>
            <Pressable onPress={() => confirmRemove(item)} hitSlop={8}>
              <Ionicons name="close-circle-outline" size={22} color={colors.darkGray} />
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  list: { padding: 20, paddingBottom: 40 },
  sectionLabel: { ...typography.sectionTitle, fontSize: 16, color: colors.black, marginBottom: 8, marginTop: 10 },
  addButton: { marginTop: 4, marginBottom: 4 },
  unassignedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8
  },
  unassignedName: { ...typography.body, color: colors.black },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.white, borderRadius: 12, padding: 12, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.softPink, alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarText: { ...typography.cardTitle, color: colors.primaryPink },
  name: { ...typography.cardTitle, fontSize: 15, color: colors.black },
  email: { ...typography.caption, color: colors.darkGray, marginTop: 2 }
});
