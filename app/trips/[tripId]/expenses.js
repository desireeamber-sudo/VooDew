import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors } from "../../../constants/colors";
import { typography } from "../../../constants/typography";
import { subscribeToTrip, subscribeToExpenses, subscribeToTravelers, addExpense, deleteExpense } from "../../../services/tripService";
import { calculateNetBalances, buildSettlementSummary, formatCurrency } from "../../../utils/expenseCalculator";
import { validateFields, isRequired, isValidAmount } from "../../../utils/validators";
import { getTodayDateString } from "../../../utils/dateUtils";
import AppInput from "../../../components/AppInput";
import AppButton from "../../../components/AppButton";
import Chip from "../../../components/Chip";
import ExpenseRow from "../../../components/ExpenseRow";
import EmptyState from "../../../components/EmptyState";
import DateField from "../../../components/DateField";

// Expenses: add an expense with description/amount/date/payer/split,
// calculate each traveler's share, and net balances into "who owes whom".
export default function ExpensesScreen() {
  const { tripId } = useLocalSearchParams();
  const [trip, setTrip] = useState(null);
  const [allTravelers, setAllTravelers] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  // Local-date-safe default -- toISOString() is UTC-based and can land on
  // the wrong calendar day depending on timezone/time of day.
  const [date, setDate] = useState(getTodayDateString());
  const [payerId, setPayerId] = useState(null);
  const [splitIds, setSplitIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubTrip = subscribeToTrip(tripId, setTrip, () => {});
    const unsubTravelers = subscribeToTravelers(setAllTravelers, () => {});
    const unsubExpenses = subscribeToExpenses(tripId, setExpenses, () => {});
    return () => {
      unsubTrip();
      unsubTravelers();
      unsubExpenses();
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
    if (tripTravelers.length && splitIds.length === 0) {
      setSplitIds(tripTravelers.map((t) => t.id));
    }
  }, [tripTravelers]);

  function toggleSplit(id) {
    setSplitIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleAddExpense() {
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

    setSaving(true);
    try {
      await addExpense(tripId, {
        description: description.trim(),
        amount: Number(amount),
        date,
        paidByTravelerId: payerId,
        splitTravelerIds: splitIds
      });
      setDescription("");
      setAmount("");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(expense) {
    Alert.alert("Delete this expense?", expense.description, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteExpense(tripId, expense.id) }
    ]);
  }

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const balances = calculateNetBalances(expenses);
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
              <Text style={styles.summaryValue}>{formatCurrency(total)}</Text>
              {settlementLines.length > 0 ? (
                settlementLines.map((line, idx) => (
                  <Text key={idx} style={styles.settlementLine}>{line}</Text>
                ))
              ) : (
                <Text style={styles.settlementLine}>Everyone is settled up.</Text>
              )}
            </View>

            <Text style={styles.sectionLabel}>Add Expense</Text>
            <AppInput label="Description" value={description} onChangeText={setDescription} placeholder="e.g. Hotel room" error={errors.description} />
            <AppInput label="Amount" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" error={errors.amount} />
            <DateField label="Date" value={date} onChange={setDate} />

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

            <AppButton title="Add Expense" onPress={handleAddExpense} loading={saving} style={styles.addButton} />

            {expenses.length > 0 && <Text style={styles.sectionLabel}>All Expenses</Text>}
          </View>
        }
        ListEmptyComponent={null}
        renderItem={({ item }) => (
          <ExpenseRow
            expense={item}
            payerName={nameById[item.paidByTravelerId]}
            participantCount={(item.splitTravelerIds || []).length}
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
  sectionLabel: { ...typography.sectionTitle, fontSize: 16, color: colors.black, marginBottom: 8, marginTop: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  error: { ...typography.caption, color: colors.danger, marginBottom: 8 },
  addButton: { marginTop: 12, marginBottom: 4 }
});
