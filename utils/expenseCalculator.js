// Expense split + balance-netting logic, kept separate from any UI code
// so it can be reasoned about (and unit tested) on its own.
//
// Version 1 rule: an expense is split EQUALLY among the selected
// travelers. The payer is credited the full amount; everyone included
// in the split (including the payer, if they're in the split list)
// owes their equal share.

/**
 * Calculates each traveler's share for a single expense.
 * @param {number} amount
 * @param {string[]} splitTravelerIds
 * @returns {{travelerId: string, share: number}[]}
 */
export function calculateShares(amount, splitTravelerIds) {
  if (!splitTravelerIds || splitTravelerIds.length === 0) return [];
  const rawShare = amount / splitTravelerIds.length;
  const share = Math.round(rawShare * 100) / 100;
  return splitTravelerIds.map((travelerId) => ({ travelerId, share }));
}

/**
 * Nets balances across a full list of trip expenses, then applies any
 * recorded settlements (direct repayments between two travelers) on top.
 * Positive balance = this traveler is owed money overall.
 * Negative balance = this traveler owes money overall.
 * @param {Array} expenses - [{ amount, paidByTravelerId, splitTravelerIds }]
 * @param {Array} [settlements] - [{ amount, paidByTravelerId, paidToTravelerId }]
 *   -- e.g. "Boomer paid Des $100" reduces what Boomer owes (their balance
 *   moves toward 0) and reduces what Des is owed (their balance moves
 *   toward 0 too), the same way paying down any debt would. Settlements
 *   never alter or remove the original expenses -- they're a separate,
 *   additive adjustment.
 * @returns {Record<string, number>} travelerId -> net balance
 */
export function calculateNetBalances(expenses, settlements = []) {
  const balances = {};

  const addBalance = (travelerId, delta) => {
    balances[travelerId] = Math.round(((balances[travelerId] || 0) + delta) * 100) / 100;
  };

  expenses.forEach((expense) => {
    const { amount, paidByTravelerId, splitTravelerIds } = expense;
    if (!amount || !paidByTravelerId || !splitTravelerIds || splitTravelerIds.length === 0) return;

    // Payer is credited the full amount they fronted.
    addBalance(paidByTravelerId, amount);

    // Everyone in the split owes their equal share.
    const shares = calculateShares(amount, splitTravelerIds);
    shares.forEach(({ travelerId, share }) => addBalance(travelerId, -share));
  });

  settlements.forEach((settlement) => {
    const { amount, paidByTravelerId, paidToTravelerId } = settlement;
    if (!amount || !paidByTravelerId || !paidToTravelerId) return;

    // The payer has paid down that much of what they owed.
    addBalance(paidByTravelerId, amount);
    // The recipient has now collected that much of what they were owed.
    addBalance(paidToTravelerId, -amount);
  });

  return balances;
}

/**
 * Turns net balances into simple human-readable "who owes whom" lines,
 * e.g. "Amber owes Des $266.00". Uses a straightforward greedy settlement
 * (largest debtor pays largest creditor first) so the list stays short.
 * @param {Record<string, number>} balances - travelerId -> net balance
 * @param {Record<string, string>} nameById - travelerId -> display name
 * @returns {string[]}
 */
export function buildSettlementSummary(balances, nameById) {
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([travelerId, balance]) => {
    if (balance > 0.01) creditors.push({ travelerId, amount: balance });
    else if (balance < -0.01) debtors.push({ travelerId, amount: -balance });
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const lines = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settled = Math.min(debtor.amount, creditor.amount);

    if (settled > 0.01) {
      const debtorName = nameById[debtor.travelerId] || "Someone";
      const creditorName = nameById[creditor.travelerId] || "someone";
      lines.push(`${debtorName} owes ${creditorName} $${settled.toFixed(2)}`);
    }

    debtor.amount = Math.round((debtor.amount - settled) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - settled) * 100) / 100;

    if (debtor.amount <= 0.01) i += 1;
    if (creditor.amount <= 0.01) j += 1;
  }

  return lines;
}

export function formatCurrency(amount) {
  const n = Number(amount) || 0;
  return `$${n.toFixed(2)}`;
}
