import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../constants/colors";
import { typography } from "../../../constants/typography";
import {
  subscribeToTrip,
  subscribeToChecklist,
  subscribeToReminders,
  addReminder,
  updateReminder,
  deleteReminder
} from "../../../services/tripService";
import { scheduleLocalReminder, cancelLocalReminder } from "../../../services/notificationService";
import {
  getTodayDateString,
  localDateToDateString,
  dateToTimeString,
  combineDateAndTimeStrings,
  formatReminderWhen
} from "../../../utils/dateUtils";
import { validateFields, isRequired } from "../../../utils/validators";
import AppInput from "../../../components/AppInput";
import AppButton from "../../../components/AppButton";
import Chip from "../../../components/Chip";
import DateField from "../../../components/DateField";
import TimeField from "../../../components/TimeField";
import EmptyState from "../../../components/EmptyState";

// Reminders: create/edit/enable/disable/delete multiple reminders for a
// trip, each optionally linked to a checklist item. Replaces the old
// single generic "remind me in an hour" button on the Checklist screen.
export default function RemindersScreen() {
  const { tripId, linkItemId, linkItemTitle } = useLocalSearchParams();

  const [trip, setTrip] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getTodayDateString());
  const [time, setTime] = useState("");
  const [linkedChecklistItemId, setLinkedChecklistItemId] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

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

  // Arriving from Checklist's "Set reminder..." link -- open the create
  // form pre-linked to that item.
  useEffect(() => {
    if (linkItemId) {
      openCreateForm(linkItemId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkItemId]);

  const checklistTitleById = useMemo(() => {
    const map = {};
    checklist.forEach((item) => (map[item.id] = item.title));
    return map;
  }, [checklist]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setDate((trip && trip.startDate) || getTodayDateString());
    setTime("");
    setLinkedChecklistItemId(null);
    setErrors({});
  }

  function openCreateForm(prefillLinkedItemId) {
    resetForm();
    if (prefillLinkedItemId) setLinkedChecklistItemId(prefillLinkedItemId);
    setFormOpen(true);
  }

  function openEditForm(reminder) {
    const when = new Date(reminder.dateTime);
    setEditingId(reminder.id);
    setTitle(reminder.title || "");
    setDescription(reminder.description || "");
    setDate(Number.isNaN(when.getTime()) ? getTodayDateString() : localDateToDateString(when));
    setTime(Number.isNaN(when.getTime()) ? "" : dateToTimeString(when));
    setLinkedChecklistItemId(reminder.linkedChecklistItemId || null);
    setErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    resetForm();
  }

  function toggleLinkedItem(itemId) {
    setLinkedChecklistItemId((prev) => (prev === itemId ? null : itemId));
  }

  async function handleSave() {
    const fieldErrors = validateFields(
      { title, date, time },
      {
        title: { check: isRequired, message: "Title is required." },
        date: { check: isRequired, message: "Date is required." },
        time: { check: isRequired, message: "Time is required." }
      }
    );
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    const when = combineDateAndTimeStrings(date, time);
    if (!when) {
      setErrors({ time: "Enter a valid date and time." });
      return;
    }
    if (when.getTime() <= Date.now()) {
      setErrors({ time: "Choose a date and time in the future." });
      return;
    }

    setSaving(true);
    try {
      // Cancel whatever was previously scheduled for this reminder (if any)
      // before scheduling the new/updated one, so edits never leave a
      // duplicate stale notification behind.
      if (editingId) {
        const existing = reminders.find((r) => r.id === editingId);
        if (existing && existing.osIdentifier) {
          await cancelLocalReminder(existing.osIdentifier);
        }
      }

      const identifier = await scheduleLocalReminder(title.trim(), description.trim(), when);
      const reminderData = {
        title: title.trim(),
        description: description.trim(),
        dateTime: when.toISOString(),
        enabled: Boolean(identifier),
        linkedChecklistItemId: linkedChecklistItemId || null,
        osIdentifier: identifier || null
      };

      if (editingId) {
        await updateReminder(tripId, editingId, reminderData);
      } else {
        await addReminder(tripId, reminderData);
      }

      if (!identifier) {
        Alert.alert(
          "Reminder saved, but not scheduled",
          "Enable notifications for VooDew in your device settings so this reminder can actually alert you."
        );
      }

      closeForm();
    } catch (e) {
      Alert.alert("Couldn't save reminder", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled(reminder) {
    if (reminder.enabled) {
      await cancelLocalReminder(reminder.osIdentifier);
      await updateReminder(tripId, reminder.id, { enabled: false, osIdentifier: null });
      return;
    }

    const when = new Date(reminder.dateTime);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      Alert.alert("Can't re-enable", "This reminder's time has already passed. Edit it to set a new date and time.");
      return;
    }

    const identifier = await scheduleLocalReminder(reminder.title, reminder.description || "", when);
    if (!identifier) {
      Alert.alert("Permission needed", "Enable notifications for VooDew to turn this reminder back on.");
      return;
    }
    await updateReminder(tripId, reminder.id, { enabled: true, osIdentifier: identifier });
  }

  function confirmDeleteReminder(reminder) {
    Alert.alert("Delete this reminder?", reminder.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await cancelLocalReminder(reminder.osIdentifier);
          await deleteReminder(tripId, reminder.id);
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

  return (
    <View style={styles.container}>
      <FlatList
        data={formOpen ? [] : reminders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          formOpen ? (
            <View>
              <Text style={styles.sectionLabel}>{editingId ? "Edit Reminder" : "New Reminder"}</Text>
              <AppInput
                label="Title"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Check in for flight"
                error={errors.title}
              />
              <AppInput
                label="Description (optional)"
                value={description}
                onChangeText={setDescription}
                placeholder="Any extra detail"
                multiline
              />
              <DateField label="Date" value={date} onChange={setDate} error={errors.date} testID="reminder-date" />
              <TimeField label="Time" value={time} onChange={setTime} error={errors.time} testID="reminder-time" />

              {checklist.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Link to a Checklist Item (optional)</Text>
                  <View style={styles.chipRow}>
                    {checklist.map((item) => (
                      <Chip
                        key={item.id}
                        label={item.title}
                        selected={linkedChecklistItemId === item.id}
                        onPress={() => toggleLinkedItem(item.id)}
                      />
                    ))}
                  </View>
                </>
              )}

              <View style={styles.formButtonRow}>
                <AppButton title="Cancel" variant="secondary" onPress={closeForm} style={styles.formButton} />
                <AppButton
                  title={editingId ? "Save Changes" : "Create Reminder"}
                  onPress={handleSave}
                  loading={saving}
                  style={styles.formButton}
                />
              </View>
            </View>
          ) : (
            <AppButton title="+ New Reminder" onPress={() => openCreateForm()} style={styles.newButton} />
          )
        }
        ListEmptyComponent={
          formOpen ? null : (
            <EmptyState
              icon="notifications-outline"
              title="No reminders yet"
              subtitle="Create one for anything time-sensitive -- buying tickets, flight check-in, leaving for the venue, and more."
            />
          )
        }
        renderItem={({ item }) => {
          const linkedTitle = item.linkedChecklistItemId ? checklistTitleById[item.linkedChecklistItemId] : null;
          const when = new Date(item.dateTime);
          return (
            <View style={styles.reminderCard}>
              <View style={styles.reminderIconCircle}>
                <Ionicons name="notifications" size={18} color={colors.primaryPink} />
              </View>
              <Pressable style={{ flex: 1 }} onPress={() => openEditForm(item)}>
                <Text style={[styles.reminderTitle, !item.enabled && styles.reminderTitleMuted]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.reminderWhen}>
                  {Number.isNaN(when.getTime()) ? "" : formatReminderWhen(when)}
                </Text>
                {item.description ? (
                  <Text style={styles.reminderDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                {linkedTitle ? <Text style={styles.reminderLinked}>Linked to: {linkedTitle}</Text> : null}
              </Pressable>
              <View style={styles.reminderActions}>
                <Chip
                  label={item.enabled ? "Enabled" : "Disabled"}
                  selected={item.enabled}
                  onPress={() => handleToggleEnabled(item)}
                />
                <Pressable
                  onPress={() => confirmDeleteReminder(item)}
                  hitSlop={8}
                  style={styles.reminderDeleteButton}
                  testID={`reminder-delete-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete reminder "${item.title}"`}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.darkGray} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.lightGray },
  list: { padding: 20, paddingBottom: 40 },
  newButton: { marginBottom: 18 },
  sectionLabel: { ...typography.sectionTitle, fontSize: 16, color: colors.black, marginBottom: 10, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  formButtonRow: { flexDirection: "row", marginTop: 16 },
  formButton: { flex: 1, marginHorizontal: 4 },
  reminderCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10
  },
  reminderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.softPink,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2
  },
  reminderTitle: { ...typography.cardTitle, fontSize: 15, color: colors.black },
  reminderTitleMuted: { color: colors.darkGray },
  reminderWhen: { ...typography.caption, color: colors.primaryPink, marginTop: 2 },
  reminderDescription: { ...typography.caption, color: colors.darkGray, marginTop: 4 },
  reminderLinked: { ...typography.caption, color: colors.darkGray, marginTop: 4, fontStyle: "italic" },
  reminderActions: { alignItems: "flex-end", marginLeft: 8 },
  reminderDeleteButton: { marginTop: 10 }
});
