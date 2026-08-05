import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import { formatCurrency } from "../utils/expenseCalculator";

// Single expense row showing description, payer, amount, and who it's split
// between, with edit and delete actions.
export default function ExpenseRow({ expense, payerName, participantCount, onEdit, onDelete }) {
  return (
    <View style={styles.row}>
      <View style={styles.iconCircle}>
        <Ionicons name="cash-outline" size={18} color={colors.primaryPink} />
      </View>
      <View style={styles.info}>
        <Text style={styles.description} numberOfLines={1}>
          {expense.description || "Expense"}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          Paid by {payerName || "Unknown"} · split {participantCount} way{participantCount === 1 ? "" : "s"}
        </Text>
      </View>
      <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
      <Pressable
        onPress={onEdit}
        hitSlop={8}
        style={styles.editButton}
        testID={`expense-edit-${expense.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Edit "${expense.description || "expense"}"`}
      >
        <Ionicons name="create-outline" size={18} color={colors.darkGray} />
      </Pressable>
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        style={styles.deleteButton}
        testID={`expense-delete-${expense.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Delete "${expense.description || "expense"}"`}
      >
        <Ionicons name="trash-outline" size={18} color={colors.darkGray} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8
  },
  iconCircle: {
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
  editButton: { paddingHorizontal: 8 },
  deleteButton: { paddingLeft: 2 }
});
