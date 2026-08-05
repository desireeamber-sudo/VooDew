import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import ChecklistScreen from "../checklist";
import {
  subscribeToChecklist,
  addChecklistItem,
  updateChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  subscribeToReminders,
  deleteReminder
} from "../../../../services/tripService";
import { cancelLocalReminder } from "../../../../services/notificationService";

jest.mock("../../../../services/tripService");
jest.mock("../../../../services/notificationService");

const ITEMS = [
  { id: "item-1", title: "Purchase or confirm ticket", completed: false, order: 0 },
  { id: "item-2", title: "Download ticket", completed: true, order: 1 }
];

const REMINDER_FOR_ITEM_1 = {
  id: "rem-1",
  title: "Buy tickets",
  dateTime: "2026-08-10T15:00:00.000Z",
  enabled: true,
  linkedChecklistItemId: "item-1",
  osIdentifier: "os-id-1"
};

describe("Checklist screen", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ tripId: "trip-1" });
    subscribeToChecklist.mockReset().mockImplementation((tripId, onChange) => {
      onChange(ITEMS);
      return () => {};
    });
    subscribeToReminders.mockReset().mockImplementation((tripId, onChange) => {
      onChange([]);
      return () => {};
    });
    addChecklistItem.mockReset().mockResolvedValue(undefined);
    updateChecklistItem.mockReset().mockResolvedValue(undefined);
    toggleChecklistItem.mockReset().mockResolvedValue(undefined);
    deleteChecklistItem.mockReset().mockResolvedValue(undefined);
    deleteReminder.mockReset().mockResolvedValue(undefined);
    cancelLocalReminder.mockReset().mockResolvedValue(undefined);
    useRouter().push.mockClear();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  test("shows the incomplete-item count", () => {
    render(<ChecklistScreen />);
    expect(screen.getByText("1 item left")).toBeTruthy();
  });

  test("adding a new item calls addChecklistItem and clears the input", async () => {
    render(<ChecklistScreen />);
    const input = screen.getByPlaceholderText("Add a checklist item");
    fireEvent.changeText(input, "Pack sunscreen");
    fireEvent.press(screen.getByText("Add"));

    await waitFor(() =>
      expect(addChecklistItem).toHaveBeenCalledWith("trip-1", { title: "Pack sunscreen", category: "custom" })
    );
  });

  test("toggling an item with no linked reminder just toggles -- no alert, no reminder touched", async () => {
    render(<ChecklistScreen />);
    fireEvent.press(screen.getByTestId("checklist-item-toggle-item-1"));

    await waitFor(() => expect(toggleChecklistItem).toHaveBeenCalledWith("trip-1", "item-1", true));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test("completing an item WITH a linked reminder offers to remove the reminder, but doesn't remove it until confirmed", async () => {
    subscribeToReminders.mockImplementation((tripId, onChange) => {
      onChange([REMINDER_FOR_ITEM_1]);
      return () => {};
    });
    render(<ChecklistScreen />);

    fireEvent.press(screen.getByTestId("checklist-item-toggle-item-1"));

    await waitFor(() => expect(toggleChecklistItem).toHaveBeenCalledWith("trip-1", "item-1", true));
    // The item is checked off regardless -- toggling never auto-touches the reminder.
    expect(deleteReminder).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Remove its reminder?",
      expect.stringContaining("Purchase or confirm ticket"),
      expect.any(Array)
    );

    // Simulate the user tapping "Remove Reminder" in the alert.
    const buttons = Alert.alert.mock.calls[0][2];
    const removeButton = buttons.find((b) => b.text === "Remove Reminder");
    await removeButton.onPress();
    expect(cancelLocalReminder).toHaveBeenCalledWith("os-id-1");
    expect(deleteReminder).toHaveBeenCalledWith("trip-1", "rem-1");
  });

  test("an item without a reminder shows no default reminder text, only the bell action", () => {
    render(<ChecklistScreen />);
    // No "Set reminder..." call-to-action cluttering every row by default.
    expect(screen.queryByText(/Set reminder/)).toBeNull();
    expect(screen.queryByText(/Reminder:/)).toBeNull();
    // The bell action is still there so a reminder can be added on demand.
    expect(screen.getByTestId("checklist-item-reminder-item-1")).toBeTruthy();
  });

  test("an item with a linked reminder shows a concise 'Reminder: ...' summary", () => {
    subscribeToReminders.mockImplementation((tripId, onChange) => {
      onChange([REMINDER_FOR_ITEM_1]);
      return () => {};
    });
    render(<ChecklistScreen />);
    expect(screen.getByText(/^Reminder: /)).toBeTruthy();
  });

  test("pressing the bell on an item with no reminder starts creating one linked to it", () => {
    render(<ChecklistScreen />);
    fireEvent.press(screen.getByTestId("checklist-item-reminder-item-1"));
    expect(useRouter().push).toHaveBeenCalledWith(
      "/trips/trip-1/reminders?linkItemId=item-1&linkItemTitle=Purchase%20or%20confirm%20ticket"
    );
  });

  test("pressing the bell on an item that already has a reminder opens Reminders instead of creating a new one", () => {
    subscribeToReminders.mockImplementation((tripId, onChange) => {
      onChange([REMINDER_FOR_ITEM_1]);
      return () => {};
    });
    render(<ChecklistScreen />);
    fireEvent.press(screen.getByTestId("checklist-item-reminder-item-1"));
    expect(useRouter().push).toHaveBeenCalledWith("/trips/trip-1/reminders");
  });
});
