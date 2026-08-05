import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../constants/colors";
import { typography } from "../../../constants/typography";
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
} from "../../../services/tripService";
import { calculateNetBalances, buildSettlementSummary, formatCurrency } from "../../../utils/expenseCalculator";
import { validateFields, isRequired, isValidAmount } from "../../../utils/validators";
import { getTodayDateString, formatDateForDisplay } from "../../../utils/dateUtils";
import AppInput from "../../../components/AppInput";
import AppButton from "../../../components/AppButton";
import Chip from "../../../components/Chip";
import ExpenseRow from "../../../components/ExpenseRow";
import EmptyState from "../../../components/EmptyState";
import DateField from "../../../components/DateField";

// Expenses: add/edit an expense with description/amount/date/payer/split,
// calculate each traveler's share, net balances into "who owes whom", and
// record direct repayments (settlements) between travelers on top of that.
export default function ExpensesScreen() {
  const { tripId } = useLocalSearchParams();
  const [trip, setTrip] = useState(null);
  const [allTravelers, setAllTravelers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  // Local-date-safe default -- toISOString() is UTC-based and can land on
  // the wrong calendar day depending on timezone/time of day.
  const [date, setDate] = useState(getTodayDateString());
  const [payerId, setPayerId] = useState(null);
  const [splitIds, setSplitIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const [settlementFormOpen, setSettlementFormOpen] = useState(false);
  const [settlementPaidBy, setSettlementPaidBy] = useState(null);
  const [settlementPaidTo, setSettlementPaidTo] = useState(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementDate, setSettlementDate] = useState(getTodayDateString());
  const [settlementNote, setSettlementNote] = useState("");
  const [settlementErrors, setSettlementErrors] = useState({});
  const [savingSettlement, setSavingSettlement] = useState(false);

  useEffect(() => {
    const unsubTrip = subscribeToTrip(tripId, setTrip, () => {});
    const unsubTravelers = subscribeToTravelers(setAllTravelers, () => {});
    const unsubExpenses = subscribeToExpenses(tripId, setExpenses, () => {});
    const unsubSettlements = subscribeToSettlements(tripId, setSettlements, () => {});
    return () => {
      unsubTrip();
      unsubTravelers();
      unsubExpenses();
      unsubSettlements();
    };
  }, [tripId]);

  const tripTravelers = useMemo(() => {
    if (!trip || !trip.travelerIds) return [];
    return allTravelers.filter((t) => trip.travelerIds.includes(t.id));
  }, [trip, allTravelers]);

  const nameById = useMemo(() => {
    const map = {};
    allTravelers.forEach((t) => (map[t.id] = t.name));
    return map;
  }, [allTravelers]);

  useEffect(() => {
    // Default the split to every traveler assigned to the trip.
    if (tripTravelers.length && splitIds.length === 0 && !editingExpenseId) {
      setSplitIds(tripTravelers.map((t) => t.id));
    }
  }, [tripTravelers]);

  function toggleSplit(id) {
    setSplitIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function resetExpenseForm() {
    setEditingExpenseId(null);
    setDescription("");
    setAmount("");
    setDate(getTodayDateString());
    setPayerId(null);
    setSplitIds(tripTravelers.map((t) => t.id));
    setErrors({});
  }

  function startEditingExpense(expense) {
    setEditingExpenseId(expense.id);
    setDescription(expense.description || "");
    setAmount(expense.amount != null ? String(expense.amount) : "");
    setDate(expense.date || getTodayDateString());
    setPayerId(expense.paidByTravelerId || null);
    setSplitIds(expense.splitTravelerIds || []);
    setErrors({});
  }

  async function handleSaveExpense() {
    const fieldErrors = validateFields(
      { description, amount, payerId },
      {
        description: { check: isRequired, message: "Description is required." },
        amount: { check: isValidAmount, message: "Enter a valid amount greater than 0." },
        payerId: { check: isRequired, message: "Choose who paid." }
      }
    );
    if (splitIds.length === 0) fieldErrors.split = "Select at least one traveler to split with.";
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    const expenseData = {
      description: description.trim(),
      amount: Number(amount),
      date,
      paidByTravelerId: payerId,
      splitTravelerIds: splitIds
    };

    setSaving(true);
    try {
      if (editingExpenseId) {
        await updateExpense(tripId, editingExpenseId, expenseData);
      } else {
        await addExpense(tripId, expenseData);
      }
      // Firestore's live subscription (subscribeToExpenses) pushes the
      // updated list back down automatically, so balances -- derived from
      // `expenses` state on every render -- recalculate immediately with
      // no extra step needed here.
      resetExpenseForm();
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(expense) {
    Alert.alert("Delete this expense?", expense.description, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (editingExpenseId === expense.id) resetExpenseForm();
          deleteExpense(tripId, expense.id);
        }
      }
    ]);
  }

  function openSettlementForm() {
    setSettlementFormOpen(true);
    setSettlementPaidBy(null);
    setSettlementPaidTo(null);
    setSettlementAmount("");
    setSettlementDate(getTodayDateString());
    setSettlementNote("");
    setSettlementErrors({});
  }

  function closeSettlementForm() {
    setSettlementFormOpen(false);
  }

  async function handleRecordPayment() {
    const fieldErrors = validateFields(
      { settlementPaidBy, settlementPaidTo, settlementAmount, settlementDate },
      {
        settlementPaidBy: { check: isRequired, message: "Choose who paid." },
        settlementPaidTo: { check: isRequired, message: "Choose who received it." },
        settlementAmount: { check: isValidAmount, message: "Enter a valid amount greater than 0." },
        settlementDate: { check: isRequired, message: "Date is required." }
      }
    );
    if (settlementPaidBy && settlementPaidTo && settlementPaidBy === settlementPaidTo) {
      fieldErrors.settlementPaidTo = "Choose a different traveler to pay.";
    }
    setSettlementErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSavingSettlement(true);
    try {
      await addSettlement(tripId, {
        paidByTravelerId: settlementPaidBy,
        paidToTravelerId: settlementPaidTo,
        amount: Number(settlementAmount),
        date: settlementDate,
        note: settlementNote.trim()
      });
      closeSettlementForm();
    } finally {
      setSavingSettlement(false);
    }
  }

  function confirmDeleteSettlement(settlement) {
    const label = `${nameById[settlement.paidByTravelerId] || "Someone"} paid ${
      nameById[settlement.paidToTravelerId] || "someone"
    } ${formatCurrency(settlement.amount)}`;
    Alert.alert("Delete this payment record?", label, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteSettlement(tripId, settlement.id) }
    ]);
  }

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const balances = calculateNetBalances(expenses, settlements);
  const settlementLines = buildSettlementSummary(balances, nameById);

  if (tripTravelers.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState icon="people-outline" title="Add travelers first" subtitle="Assign travelers to this trip before tracking expenses." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Spent</Text>
              <Text style={styles.summaryValue} testID="expense-total-amount">{formatCurrency(total)}</Text>
              {settlementLines.length > 0 ? (
                settlementLines.map((line, idx) => (
                  <Text key={idx} style={styles.settlementLine}>{line}</Text>
                ))
              ) : (
                <Text style={styles.settlementLine}>Everyone is settled up.</Text>
              )}
              <AppButton
                title="Record Payment"
                variant="secondary"
                onPress={openSettlementForm}
                style={styles.recordPaymentButton}
              />
            </View>

            {settlementFormOpen && (
              <View style={styles.settlementForm}>
                <Text style={styles.sectionLabel}>Record Payment</Text>

                <Text style={styles.subLabel}>Paid By</Text>
                <View style={styles.chipRow}>
                  {tripTravelers.map((t) => (
                    <Chip
                      key={t.id}
                      label={t.name}
                      selected={settlementPaidBy === t.id}
                      onPress={() => setSettlementPaidBy(t.id)}
                    />
                  ))}
                </View>
                {settlementErrors.settlementPaidBy ? <Text style={styles.error}>{settlementErrors.settlementPaidBy}</Text> : null}

                <Text style={styles.subLabel}>Paid To</Text>
                <View style={styles.chipRow}>
                  {tripTravelers.map((t) => (
                    <Chip
                      key={t.id}
                      label={t.name}
                      selected={settlementPaidTo === t.id}
                      onPress={() => setSettlementPaidTo(t.id)}
                    />
                  ))}
                </View>
                {settlementErrors.settlementPaidTo ? <Text style={styles.error}>{settlementErrors.settlementPaidTo}</Text> : null}

                <AppInput
                  label="Amount"
                  value={settlementAmount}
                  onChangeText={setSettlementAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  error={settlementErrors.settlementAmount}
                />
                <DateField
                  label="Date"
                  value={settlementDate}
                  onChange={setSettlementDate}
                  error={settlementErrors.settlementDate}
                  testID="settlement-date"
                />
                <AppInput label="Note (optional)" value={settlementNote} onChangeText={setSettlementNote} placeholder="e.g. Venmo" />

                <View style={styles.formButtonRow}>
                  <AppButton
                    title="Cancel"
                    variant="secondary"
                    onPress={closeSettlementForm}
                    style={styles.formButton}
                    testID="settlement-form-cancel"
                  />
                  <AppButton
                    title="Save Payment"
                    onPress={handleRecordPayment}
                    loading={savingSettlement}
                    style={styles.formButton}
                    testID="settlement-form-submit"
                  />
                </View>
              </View>
            )}

            <Text style={styles.sectionLabel} testID="expense-form-heading">
              {editingExpenseId ? "Edit Expense" : "Add Expense"}
            </Text>
            <AppInput label="Description" value={description} onChangeText={setDescription} placeholder="e.g. Hotel room" error={errors.description} />
            <AppInput label="Amount" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" error={errors.amount} />
            <DateField label="Date" value={date} onChange={setDate} testID="expense-date" />

            <Text style={styles.sectionLabel}>Paid By</Text>
            <View style={styles.chipRow}>
              {tripTravelers.map((t) => (
                <Chip key={t.id} label={t.name} selected={payerId === t.id} onPress={() => setPayerId(t.id)} />
              ))}
            </View>
            {errors.payerId ? <Text style={styles.error}>{errors.payerId}</Text> : null}

            <Text style={styles.sectionLabel}>Split Between</Text>
            <View style={styles.chipRow}>
              {tripTravelers.map((t) => (
                <Chip key={t.id} label={t.name} selected={splitIds.includes(t.id)} onPress={() => toggleSplit(t.id)} />
              ))}
            </View>
            {errors.split ? <Text style={styles.error}>{errors.split}</Text> : null}

            {editingExpenseId ? (
              <View style={styles.formButtonRow}>
                <AppButton
                  title="Cancel"
                  variant="secondary"
                  onPress={resetExpenseForm}
                  style={styles.formButton}
                  testID="expense-form-cancel"
                />
                <AppButton
                  title="Save Changes"
                  onPress={handleSaveExpense}
                  loading={saving}
                  style={styles.formButton}
                  testID="expense-form-submit"
                />
              </View>
            ) : (
              <AppButton
                title="Add Expense"
                onPress={handleSaveExpense}
                loading={saving}
                style={styles.addButton}
                testID="expense-form-submit"
              />
            )}

            {expenses.length > 0 && <Text style={styles.sectionLabel}>All Expenses</Text>}
          </View>
        }
        ListFooterComponent={
          settlements.length > 0 ? (
            <View>
              <Text style={styles.sectionLabel}>Recorded Payments</Text>
              {settlements.map((s) => (
                <View key={s.id} style={styles.settlementRow}>
                  <View style={styles.settlementIconCircle}>
                    <Ionicons name="swap-horizontal" size={16} color={colors.primaryPink} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.description} numberOfLines={1}>
                      {nameById[s.paidByTravelerId] || "Someone"} paid {nameById[s.paidToTravelerId] || "someone"}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {formatDateForDisplay(s.date)}
                      {s.note ? ` · ${s.note}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.amount}>{formatCurrency(s.amount)}</Text>
                  <Pressable
                    onPress={() => confirmDeleteSettlement(s)}
                    hitSlop={8}
                    style={styles.deleteButton}
                    testID={`settlement-delete-${s.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete payment record`}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.darkGray} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={null}
        renderItem={({ item }) => (
          <ExpenseRow
            expense={item}
            payerName={nameById[item.paidByTravelerId]}
            participantCount={(item.splitTravelerIds || []).length}
            onEdit={() => startEditingExpense(item)}
            onDelete={() => confirmDelete(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  list: { padding: 20, paddingBottom: 40 },
  summaryCard: { backgroundColor: colors.softPink, borderRadius: 16, padding: 16, marginBottom: 18 },
  summaryLabel: { ...typography.caption, color: colors.darkGray, textTransform: "uppercase" },
  summaryValue: { ...typography.screenTitle, fontSize: 26, color: colors.primaryPink, marginTop: 2, marginBottom: 8 },
  settlementLine: { ...typography.body, color: colors.black, marginTop: 2 },
  recordPaymentButton: { marginTop: 12 },
  settlementForm: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 18 },
  subLabel: { ...typography.caption, color: colors.darkGray, textTransform: "uppercase", marginBottom: 6, marginTop: 4 },
  sectionLabel: { ...typography.sectionTitle, fontSize: 16, color: colors.black, marginBottom: 8, marginTop: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  error: { ...typography.caption, color: colors.danger, marginBottom: 8 },
  addButton: { marginTop: 12, marginBottom: 4 },
  formButtonRow: { flexDirection: "row", marginTop: 16 },
  formButton: { flex: 1, marginHorizontal: 4 },
  settlementRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8
  },
  settlementIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.softPink,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10
  },
  info: { flex: 1 },
  description: { ...typography.cardTitle, fontSize: 15, color: colors.black },
  meta: { ...typography.caption, color: colors.darkGray, marginTop: 2 },
  amount: { ...typography.cardTitle, fontSize: 15, color: colors.primaryPink, marginLeft: 8 },
  deleteButton: { paddingLeft: 10 }
});
