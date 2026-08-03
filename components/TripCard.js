import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import { getEventTypeLabel } from "../utils/checklistTemplates";
import { getTripDateStatus } from "../utils/dateUtils";

const EVENT_ICONS = {
  inTownConcert: "musical-notes",
  outOfTownConcert: "airplane",
  cruise: "boat",
  festival: "sparkles",
  custom: "calendar"
};

// Card shown in the Home / Saved Trips list.
export default function TripCard({ trip, onPress }) {
  const { label: countdownLabel } = getTripDateStatus(trip.startDate, trip.endDate);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconCircle}>
        <Ionicons name={EVENT_ICONS[trip.eventType] || "calendar"} size={22} color={colors.primaryPink} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {trip.title || "Untitled Trip"}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {getEventTypeLabel(trip.eventType)}
          {trip.destination ? ` · ${trip.destination}` : ""}
        </Text>
      </View>
      {countdownLabel ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{countdownLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  pressed: { opacity: 0.85 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.softPink,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  info: { flex: 1 },
  title: { ...typography.cardTitle, color: colors.black },
  subtitle: { ...typography.body, fontSize: 13, color: colors.darkGray, marginTop: 2 },
  badge: {
    backgroundColor: colors.softPink,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8
  },
  badgeText: { ...typography.caption, color: colors.primaryPink }
});
