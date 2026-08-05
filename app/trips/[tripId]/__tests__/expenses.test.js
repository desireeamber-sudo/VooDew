import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import ExpensesScreen from "../expenses";
import {
  subscribeToTrip,
  subscribeToExpenses,
  subscribeToTravelers,
  subscribeToSettlements,
  addExpense,
  updateExpense,
  deleteExpense,
  addSettlement,
  deleteSettlement
} from "../../../../services/tripService";

jest.mock("../../../../services/tripService");

const TRAVELERS = [
  { id: "des", name: "Des" },
  { id: "boomer", name: "Boomer" }
];

const TRIP = { id: "trip-1", travelerIds: ["des", "boomer"] };

const EXPENSE = {
  id: "exp-1",
  description: "Hotel room",
  amount: 120,
  date: "2026-08-10",
  paidByTravelerId: "des",
  splitTravelerIds: ["des", "boomer"]
};

describe("Expenses screen", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ tripId: "trip-1" });
    subscribeToTrip.mockReset().mockImplementation((tripId, onChange) => {
      onChange(TRIP);
      return () => {};
    });
    subscribeToTravelers.mockReset().mockImplementation((onChange) => {
      onChange(TRAVELERS);
      return () => {};
    });
    subscribeToExpenses.mockReset().mockImplementation((tripId, onChange) => {
      onChange([EXPENSE]);
      return () => {};
    });
    subscribeToSettlements.mockReset().mockImplementation((tripId, onChange) => {
      onChange([]);
      return () => {};
    });
    addExpense.mockReset().mockResolvedValue(undefined);
    updateExpense.mockReset().mockResolvedValue(undefined);
    deleteExpense.mockReset().mockResolvedValue(undefined);
    addSettlement.mockReset().mockResolvedValue(undefined);
    deleteSettlement.mockReset().mockResolvedValue(undefined);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  test("shows the total spent and who-owes-whom summary", () => {
    render(<ExpensesScreen />);
    // "$120.00" also appears on the expense's own row further down the
    // list, so the summary total is targeted by its own stable testID
    // rather than by (now-ambiguous) text. (This RNTL setup doesn't have
    // the jest-native toHaveTextContent matcher registered, so read the
    // Text node's own children directly instead.)
    expect(screen.getByTestId("expense-total-amount").props.children).toBe("$120.00");
    expect(screen.getByText("Boomer owes Des $60.00")).toBeTruthy();
  });

  test("adding a new expense calls addExpense and resets the form", async () => {
    render(<ExpensesScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Hotel room"), "Dinner");
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "40");
    // "Des" appears in both the Paid By and Split Between chip rows -- the
    // first is Paid By.
    fireEvent.press(screen.getAllByText("Des")[0]);
    // "Add Expense" is both the section heading and this submit button's
    // label -- target the button by its stable testID instead.
    fireEvent.press(screen.getByTestId("expense-form-submit"));

    await waitFor(() =>
      expect(addExpense).toHaveBeenCalledWith(
        "trip-1",
        expect.objectContaining({ description: "Dinner", amount: 40, paidByTravelerId: "des" })
      )
    );
    expect(updateExpense).not.toHaveBeenCalled();
  });

  test("editing an expense pre-fills the form and saves via updateExpense, not addExpense", async () => {
    render(<ExpensesScreen />);
    fireEvent.press(screen.getByTestId("expense-edit-exp-1"));

    expect(screen.getByText("Edit Expense")).toBeTruthy();
    expect(screen.getByDisplayValue("Hotel room")).toBeTruthy();
    expect(screen.getByDisplayValue("120")).toBeTruthy();

    fireEvent.changeText(screen.getByDisplayValue("120"), "150");
    fireEvent.press(screen.getByText("Save Changes"));

    await waitFor(() =>
      expect(updateExpense).toHaveBeenCalledWith(
        "trip-1",
        "exp-1",
        expect.objectContaining({ description: "Hotel room", amount: 150 })
      )
    );
    expect(addExpense).not.toHaveBeenCalled();
  });

  test("canceling an edit returns the form to Add Expense mode without saving", () => {
    render(<ExpensesScreen />);
    fireEvent.press(screen.getByTestId("expense-edit-exp-1"));
    expect(screen.getByText("Edit Expense")).toBeTruthy();

    fireEvent.press(screen.getByTestId("expense-form-cancel"));
    // "Add Expense" is both the heading and the submit button's label once
    // back in add mode -- assert on the heading's stable testID.
    expect(screen.getByTestId("expense-form-heading").props.children).toBe("Add Expense");
    expect(updateExpense).not.toHaveBeenCalled();
  });

  test("Record Payment opens the settlement form and saves via addSettlement", async () => {
    render(<ExpensesScreen />);
    fireEvent.press(screen.getByText("Record Payment"));

    // With the settlement form open, "Des"/"Boomer" each appear 4 times
    // top-to-bottom: settlement Paid By, settlement Paid To, expense form's
    // Paid By, expense form's Split Between.
    fireEvent.press(screen.getAllByText("Des")[0]); // settlement Paid By
    fireEvent.press(screen.getAllByText("Boomer")[1]); // settlement Paid To
    fireEvent.changeText(screen.getAllByPlaceholderText("0.00")[0], "60"); // settlement Amount
    fireEvent.press(screen.getByText("Save Payment"));

    await waitFor(() =>
      expect(addSettlement).toHaveBeenCalledWith(
        "trip-1",
        expect.objectContaining({ paidByTravelerId: "des", paidToTravelerId: "boomer", amount: 60 })
      )
    );
  });

  test("recording a payment to yourself is rejected", async () => {
    render(<ExpensesScreen />);
    fireEvent.press(screen.getByText("Record Payment"));

    fireEvent.press(screen.getAllByText("Des")[0]); // settlement Paid By = Des
    fireEvent.press(screen.getAllByText("Des")[1]); // settlement Paid To = Des too
    fireEvent.changeText(screen.getAllByPlaceholderText("0.00")[0], "20");
    fireEvent.press(screen.getByText("Save Payment"));

    await waitFor(() => expect(screen.getByText("Choose a different traveler to pay.")).toBeTruthy());
    expect(addSettlement).not.toHaveBeenCalled();
  });

  test("deleting a settlement asks for confirmation before removing it", async () => {
    subscribeToSettlements.mockImplementation((tripId, onChange) => {
      onChange([{ id: "settle-1", paidByTravelerId: "boomer", paidToTravelerId: "des", amount: 60, date: "2026-08-12", note: "" }]);
      return () => {};
    });
    render(<ExpensesScreen />);

    fireEvent.press(screen.getByTestId("settlement-delete-settle-1"));
    expect(Alert.alert).toHaveBeenCalledWith("Delete this payment record?", expect.any(String), expect.any(Array));
    expect(deleteSettlement).not.toHaveBeenCalled();

    const buttons = Alert.alert.mock.calls[0][2];
    const deleteButton = buttons.find((b) => b.text === "Delete");
    await deleteButton.onPress();
    expect(deleteSettlement).toHaveBeenCalledWith("trip-1", "settle-1");
  });

  test("a settlement is reflected in the balance summary (Boomer's debt shrinks)", () => {
    subscribeToSettlements.mockImplementation((tripId, onChange) => {
      onChange([{ id: "settle-1", paidByTravelerId: "boomer", paidToTravelerId: "des", amount: 20, date: "2026-08-12", note: "" }]);
      return () => {};
    });
    render(<ExpensesScreen />);
    // Expense alone: Boomer owes Des $60. After a $20 settlement: $40.
    expect(screen.getByText("Boomer owes Des $40.00")).toBeTruthy();
  });
});
