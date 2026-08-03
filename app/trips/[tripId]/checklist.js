import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors } from "../../../constants/colors";
import { typography } from "../../../constants/typography";
import {
  subscribeToChecklist,
  addChecklistItem,
  updateChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  subscribeToReminders,
  deleteReminder
} from "../../../services/tripService";
import { cancelLocalReminder } from "../../../services/notificationService";
import { formatReminderWhen } from "../../../utils/dateUtils";
import { isRequired } from "../../../utils/validators";
import ChecklistRow from "../../../components/ChecklistRow";
import AppInput from "../../../components/AppInput";
import AppButton from "../../../components/AppButton";
import EmptyState from "../../../components/EmptyState";

// Checklist screen: template-generated tasks plus check/uncheck, add, edit,
// delete, an incomplete-item count, and a per-item link to the Reminders
// screen (see app/trips/[tripId]/reminders.js for reminder create/edit).
export default function ChecklistScreen() {
  const { tripId } = useLocalSearchParams();
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    const unsubItems = subscribeToChecklist(tripId, setItems, () => {});
    const unsubReminders = subscribeToReminders(tripId, setReminders, () => {});
    return () => {
      unsubItems();
      unsubReminders();
    };
  }, [tripId]);

  const incompleteCount = items.filter((i) => !i.completed).length;

  // Each checklist item may have at most one linked reminder -- look it up
  // by checklist item id so ChecklistRow can show "Set reminder..." or
  // "Reminder set for ..." without a per-row Firestore query.
  const reminderByItemId = useMemo(() => {
    const map = {};
    reminders.forEach((r) => {
      if (r.linkedChecklistItemId) map[r.linkedChecklistItemId] = r;
    });
    return map;
  }, [reminders]);

  async function handleAddItem() {
    if (!isRequired(newItemTitle)) return;
    await addChecklistItem(tripId, { title: newItemTitle.trim(), category: "custom" });
    setNewItemTitle("");
  }

  function startEditing(item) {
    setEditingId(item.id);
    setEditingTitle(item.title);
  }

  async function saveEdit() {
    if (!isRequired(editingTitle)) return;
    await updateChecklistItem(tripId, editingId, { title: editingTitle.trim() });
    setEditingId(null);
    setEditingTitle("");
  }

  function confirmDeleteItem(item) {
    Alert.alert("Delete this item?", item.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteChecklistItem(tripId, item.id) }
    ]);
  }

  // Toggling completion never touches the reminder automatically (a
  // reminder firing should never silently check off the task, and
  // checking off the task should never silently cancel the reminder) --
  // but per requirement, completing an item WITH a linked reminder offers
  // to remove that reminder, since it's no longer needed.
  async function handleToggleItem(item) {
    const nowCompleted = !item.completed;
    await toggleChecklistItem(tripId, item.id, nowCompleted);

    if (nowCompleted) {
      const linkedReminder = reminderByItemId[item.id];
      if (linkedReminder) {
        Alert.alert("Remove its reminder?", `"${item.title}" is complete. Remove the reminder tied to it too?`, [
          { text: "Keep Reminder", style: "cancel" },
          {
            text: "Remove Reminder",
            style: "destructive",
            onPress: async () => {
              await cancelLocalReminder(linkedReminder.osIdentifier);
              await deleteReminder(tripId, linkedReminder.id);
            }
          }
        ]);
      }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {incompleteCount} item{incompleteCount === 1 ? "" : "s"} left
        </Text>
        <Pressable onPress={() => router.push(`/trips/${tripId}/reminders`)} hitSlop={8}>
          <Text style={styles.manageRemindersLink}>Manage Reminders</Text>
        </Pressable>
      </View>

      <View style={styles.addRow}>
        <View style={{ flex: 1 }}>
          <AppInput value={newItemTitle} onChangeText={setNewItemTitle} placeholder="Add a checklist item" />
        </View>
        <AppButton title="Add" onPress={handleAddItem} style={styles.addButton} />
      </View>

      {items.length === 0 ? (
        <EmptyState icon="checkbox-outline" title="No checklist items" subtitle="Add your first task above." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            if (editingId === item.id) {
              return (
                <View style={styles.editRow}>
                  <View style={{ flex: 1 }}>
                    <AppInput value={editingTitle} onChangeText={setEditingTitle} />
                  </View>
                  <AppButton title="Save" onPress={saveEdit} style={styles.editSaveButton} />
                </View>
              );
            }

            const linkedReminder = reminderByItemId[item.id];
            return (
              <ChecklistRow
                item={item}
                onToggle={() => handleToggleItem(item)}
                onEdit={() => startEditing(item)}
                onDelete={() => confirmDeleteItem(item)}
                footer={
                  linkedReminder ? (
                    <Pressable onPress={() => router.push(`/trips/${tripId}/reminders`)}>
                      <Text style={styles.reminderSetText}>
                        Reminder set for {formatReminderWhen(new Date(linkedReminder.dateTime))}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() =>
                        router.push(`/trips/${tripId}/reminders?linkItemId=${item.id}&linkItemTitle=${encodeURIComponent(item.title)}`)
                      }
                    >
                      <Text style={styles.setReminderText}>Set reminder...</Text>
                    </Pressable>
                  )
                }
              />
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray, padding: 20 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  summaryText: { ...typography.sectionTitle, color: colors.black },
  manageRemindersLink: { ...typography.caption, color: colors.primaryPink },
  addRow: { flexDirection: "row", alignItems: "flex-start" },
  addButton: { marginLeft: 10, marginTop: 2, minWidth: 70 },
  list: { paddingBottom: 40 },
  editRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  editSaveButton: { marginLeft: 10, marginTop: 2, minWidth: 70 },
  setReminderText: { ...typography.caption, color: colors.primaryPink },
  reminderSetText: { ...typography.caption, color: colors.darkGray }
});
