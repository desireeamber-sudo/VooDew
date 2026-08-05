import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, StyleSheet, ActivityIndicator, Alert, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../constants/colors";
import { typography } from "../../../constants/typography";
import { getEventTypeLabel } from "../../../utils/checklistTemplates";
import { getTripDateStatus, formatDateForDisplay, formatReminderWhen } from "../../../utils/dateUtils";
import {
  subscribeToTrip,
  subscribeToChecklist,
  subscribeToReminders,
  deleteTrip
} from "../../../services/tripService";
import { cancelLocalReminder } from "../../../services/notificationService";
import { deleteCoverPhoto } from "../../../services/imageService";
import DashboardCard from "../../../components/DashboardCard";

// Trip Dashboard: hero card, progress card, quick action grid, and an
// upcoming reminder card. This is the hub every other trip screen is
// reached from.
export default function TripDashboardScreen() {
  const { tripId } = useLocalSearchParams();
  const router = useRouter();

  const [trip, setTrip] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubTrip = subscribeToTrip(tripId, (data) => {
      setTrip(data);
      setLoading(false);
    });
    const unsubChecklist = subscribeToChecklist(tripId, setChecklist, () => {});
    const unsubReminders = subscribeToReminders(tripId, setReminders, () => {});
    return () => {
      unsubTrip();
      unsubChecklist();
      unsubReminders();
    };
  }, [tripId]);

  function confirmDelete() {
    Alert.alert("Delete this trip?", "This removes the trip and everything saved inside it. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          // Cancel every scheduled OS notification for this trip's
          // reminders before removing the Firestore records -- otherwise a
          // stale notification could still fire for a trip that no longer
          // exists in the app.
          await Promise.all(reminders.map((r) => cancelLocalReminder(r.osIdentifier)));
          await deleteTrip(tripId);
          // Best-effort: remove the locally stored cover photo too, if
          // this trip had one. Never blocks navigation on failure.
          await deleteCoverPhoto(trip.coverPhotoUri);
          router.replace("/");
        }
      }
    ]);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primaryPink} size="large" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={typography.body}>Trip not found.</Text>
      </View>
    );
  }

  const completedCount = checklist.filter((i) => i.completed).length;
  const progress = checklist.length ? Math.round((completedCount / checklist.length) * 100) : 0;
  const dateStatus = getTripDateStatus(trip.startDate, trip.endDate);

  // Reminders are already ordered by dateTime ascending; the next one to
  // show is the earliest enabled reminder that hasn't fired yet.
  const now = Date.now();
  const nextReminder = reminders.find((r) => r.enabled && new Date(r.dateTime).getTime() > now);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <DashboardCard>
        {trip.coverPhotoUri ? (
          <Image
            source={{ uri: trip.coverPhotoUri }}
            style={styles.coverPhoto}
            accessibilityLabel="Trip cover photo"
            testID="trip-cover-photo"
          />
        ) : null}
        <View style={styles.heroTop}>
          <Text style={styles.heroTitle}>{trip.title}</Text>
          <Pressable onPress={() => router.push(`/trips/create?editId=${tripId}`)} hitSlop={8}>
            <Ionicons name="create-outline" size={22} color={colors.primaryPink} />
          </Pressable>
        </View>
        <Text style={styles.heroMeta}>
          {getEventTypeLabel(trip.eventType)}
          {trip.destination ? ` · ${trip.destination}` : ""}
        </Text>
        <Text style={styles.heroMeta}>
          {formatDateForDisplay(trip.startDate)}
          {trip.endDate && trip.endDate !== trip.startDate ? ` – ${formatDateForDisplay(trip.endDate)}` : ""}
        </Text>
        {dateStatus.status && (
          <View style={styles.countdownPill}>
            <Text style={styles.countdownText}>{dateStatus.label}</Text>
          </View>
        )}
      </DashboardCard>

      <DashboardCard title="Checklist Progress">
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {completedCount} of {checklist.length} items complete ({progress}%)
        </Text>
      </DashboardCard>

      <Text style={styles.gridLabel}>Manage Trip</Text>
      <View style={styles.grid}>
        <DashboardCard icon="checkbox-outline" label="Checklist" onPress={() => router.push(`/trips/${tripId}/checklist`)} />
        <DashboardCard icon="link-outline" label="Tickets & Links" onPress={() => router.push(`/trips/${tripId}/links`)} />
        <DashboardCard icon="map-outline" label="Map" onPress={() => router.push(`/trips/${tripId}/map`)} />
        <DashboardCard icon="cash-outline" label="Expenses" onPress={() => router.push(`/trips/${tripId}/expenses`)} />
        <DashboardCard icon="people-outline" label="Travelers" onPress={() => router.push(`/trips/${tripId}/travelers`)} />
        <DashboardCard icon="notifications-outline" label="Reminders" onPress={() => router.push(`/trips/${tripId}/reminders`)} />
      </View>

      <DashboardCard title="Upcoming Reminder">
        {nextReminder ? (
          <Pressable style={styles.reminderRow} onPress={() => router.push(`/trips/${tripId}/reminders`)}>
            <Ionicons name="notifications-outline" size={18} color={colors.primaryPink} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.reminderText}>{nextReminder.title}</Text>
              <Text style={styles.reminderWhenText}>{formatReminderWhen(new Date(nextReminder.dateTime))}</Text>
            </View>
          </Pressable>
        ) : (
          <Text style={typography.body}>No reminders scheduled yet. Set one from the Reminders screen.</Text>
        )}
      </DashboardCard>

      <Pressable style={styles.deleteRow} onPress={confirmDelete}>
        <Ionicons name="trash-outline" size={16} color={colors.danger} />
        <Text style={styles.deleteText}>Delete Trip</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.lightGray },
  content: { padding: 20, paddingBottom: 60 },
  coverPhoto: { width: "100%", height: 160, borderRadius: 14, marginBottom: 12, backgroundColor: colors.lightGray },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroTitle: { ...typography.screenTitle, fontSize: 24, color: colors.black, flex: 1, marginRight: 8 },
  heroMeta: { ...typography.body, color: colors.darkGray, marginTop: 4 },
  countdownPill: { alignSelf: "flex-start", backgroundColor: colors.softPink, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  countdownText: { ...typography.caption, color: colors.primaryPink },
  progressBarTrack: { height: 10, backgroundColor: colors.lightGray, borderRadius: 6, overflow: "hidden" },
  progressBarFill: { height: 10, backgroundColor: colors.primaryPink, borderRadius: 6 },
  progressLabel: { ...typography.caption, color: colors.darkGray, marginTop: 8 },
  gridLabel: { ...typography.sectionTitle, color: colors.black, marginBottom: 10, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  reminderRow: { flexDirection: "row", alignItems: "center" },
  reminderText: { ...typography.body, color: colors.black },
  reminderWhenText: { ...typography.caption, color: colors.primaryPink, marginTop: 2 },
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8, paddingVertical: 12 },
  deleteText: { ...typography.body, color: colors.danger, marginLeft: 6 }
});
