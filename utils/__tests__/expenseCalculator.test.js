import {
  calculateShares,
  calculateNetBalances,
  buildSettlementSummary,
  formatCurrency
} from "../expenseCalculator";

describe("calculateShares", () => {
  test("splits evenly between two travelers", () => {
    expect(calculateShares(120, ["des", "boomer"])).toEqual([
      { travelerId: "des", share: 60 },
      { travelerId: "boomer", share: 60 }
    ]);
  });

  test("splits among three travelers, rounding each share to the cent", () => {
    expect(calculateShares(100, ["a", "b", "c"])).toEqual([
      { travelerId: "a", share: 33.33 },
      { travelerId: "b", share: 33.33 },
      { travelerId: "c", share: 33.33 }
    ]);
  });

  test("returns an empty array when no one is selected to split with", () => {
    expect(calculateShares(100, [])).toEqual([]);
  });

  test("returns an empty array when the split list is missing", () => {
    expect(calculateShares(100, null)).toEqual([]);
  });
});

describe("calculateNetBalances + buildSettlementSummary", () => {
  const nameById = { des: "Des", boomer: "Boomer", amber: "Amber" };

  test("$120 paid by Des, split between Des and Boomer, produces 'Boomer owes Des $60'", () => {
    const expenses = [{ amount: 120, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer"] }];
    const balances = calculateNetBalances(expenses);
    expect(buildSettlementSummary(balances, nameById)).toEqual(["Boomer owes Des $60.00"]);
  });

  test("a selected-travelers-only split excludes anyone left out of the split", () => {
    // Amber is on the trip but wasn't included in this particular expense's split.
    const expenses = [{ amount: 60, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer"] }];
    const balances = calculateNetBalances(expenses);
    expect(balances.amber).toBeUndefined();
  });

  test("a three-person split divides the expense evenly", () => {
    const expenses = [{ amount: 90, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer", "amber"] }];
    const balances = calculateNetBalances(expenses);
    expect(balances.des).toBeCloseTo(60); // paid 90, owes 30 of it himself
    expect(balances.boomer).toBeCloseTo(-30);
    expect(balances.amber).toBeCloseTo(-30);
  });

  test("multiple expenses net out correctly across a trip", () => {
    const expenses = [
      { amount: 120, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer"] }, // Boomer owes Des 60
      { amount: 40, paidByTravelerId: "boomer", splitTravelerIds: ["des", "boomer"] } // Des owes Boomer 20
    ];
    const balances = calculateNetBalances(expenses);
    expect(buildSettlementSummary(balances, nameById)).toEqual(["Boomer owes Des $40.00"]);
  });

  test("rounding: an uneven three-way split of $100 rounds each share to the cent independently", () => {
    // 100 / 3 = 33.333..., which rounds to 33.33 for each traveler -- this
    // documents the real, current rounding behavior (a fraction of a cent
    // is not redistributed), rather than asserting an approximate "close to
    // zero" that would mask it.
    const expenses = [{ amount: 100, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer", "amber"] }];
    const balances = calculateNetBalances(expenses);
    expect(balances.boomer).toBe(-33.33);
    expect(balances.amber).toBe(-33.33);
    expect(balances.des).toBe(66.67);
  });

  test("an expense with a zero amount contributes no balance", () => {
    const expenses = [{ amount: 0, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer"] }];
    expect(calculateNetBalances(expenses)).toEqual({});
  });

  test("an expense with an invalid (NaN) amount is ignored", () => {
    const expenses = [{ amount: NaN, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer"] }];
    expect(calculateNetBalances(expenses)).toEqual({});
  });

  test("an expense with a missing payer is ignored", () => {
    const expenses = [{ amount: 50, paidByTravelerId: null, splitTravelerIds: ["des", "boomer"] }];
    expect(calculateNetBalances(expenses)).toEqual({});
  });

  test("an expense with an empty split selection is ignored", () => {
    const expenses = [{ amount: 50, paidByTravelerId: "des", splitTravelerIds: [] }];
    expect(calculateNetBalances(expenses)).toEqual({});
  });

  test("everyone settled up produces no settlement lines", () => {
    expect(buildSettlementSummary({ des: 0, boomer: 0 }, nameById)).toEqual([]);
  });
});

describe("calculateNetBalances with settlements", () => {
  const nameById = { des: "Des", boomer: "Boomer", janae: "Janae" };

  test("a full settlement clears the debt between exactly two travelers", () => {
    const expenses = [{ amount: 120, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer"] }];
    // Boomer owes Des $60 from the expense alone.
    const settlements = [{ amount: 60, paidByTravelerId: "boomer", paidToTravelerId: "des" }];
    const balances = calculateNetBalances(expenses, settlements);
    expect(balances.boomer).toBe(0);
    expect(balances.des).toBe(0);
    expect(buildSettlementSummary(balances, nameById)).toEqual([]);
  });

  test("a partial settlement reduces, but doesn't clear, what's owed", () => {
    const expenses = [{ amount: 120, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer"] }];
    const settlements = [{ amount: 20, paidByTravelerId: "boomer", paidToTravelerId: "des" }];
    const balances = calculateNetBalances(expenses, settlements);
    expect(buildSettlementSummary(balances, nameById)).toEqual(["Boomer owes Des $40.00"]);
  });

  test("multiple settlements against a multi-person debt only clear what's actually been paid (worked example)", () => {
    // $300 paid by Des, split among Des, Boomer, and Janae -- Boomer and
    // Janae each owe Des $100.
    const expenses = [{ amount: 300, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer", "janae"] }];
    let balances = calculateNetBalances(expenses);
    expect(buildSettlementSummary(balances, nameById)).toEqual([
      "Boomer owes Des $100.00",
      "Janae owes Des $100.00"
    ]);

    // Boomer pays Des the full $100 -- only Janae should still owe anything.
    const settlements = [{ amount: 100, paidByTravelerId: "boomer", paidToTravelerId: "des" }];
    balances = calculateNetBalances(expenses, settlements);
    expect(buildSettlementSummary(balances, nameById)).toEqual(["Janae owes Des $100.00"]);
  });

  test("settlements accumulate across multiple records for the same pair", () => {
    const expenses = [{ amount: 100, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer"] }];
    // Boomer owes Des $50 -- paid off in two installments.
    const settlements = [
      { amount: 20, paidByTravelerId: "boomer", paidToTravelerId: "des" },
      { amount: 30, paidByTravelerId: "boomer", paidToTravelerId: "des" }
    ];
    const balances = calculateNetBalances(expenses, settlements);
    expect(balances.boomer).toBe(0);
    expect(balances.des).toBe(0);
  });

  test("a settlement with a missing payer or recipient is ignored", () => {
    const expenses = [{ amount: 100, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer"] }];
    const settlements = [{ amount: 50, paidByTravelerId: "boomer", paidToTravelerId: null }];
    const balances = calculateNetBalances(expenses, settlements);
    expect(buildSettlementSummary(balances, nameById)).toEqual(["Boomer owes Des $50.00"]);
  });

  test("recording a settlement never mutates or removes the original expenses", () => {
    const expenses = [{ amount: 100, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer"] }];
    const settlements = [{ amount: 50, paidByTravelerId: "boomer", paidToTravelerId: "des" }];
    const before = JSON.stringify(expenses);
    calculateNetBalances(expenses, settlements);
    expect(JSON.stringify(expenses)).toBe(before);
    expect(expenses.length).toBe(1);
  });

  test("calling calculateNetBalances with no settlements argument still works", () => {
    const expenses = [{ amount: 100, paidByTravelerId: "des", splitTravelerIds: ["des", "boomer"] }];
    expect(() => calculateNetBalances(expenses)).not.toThrow();
  });
});

describe("formatCurrency", () => {
  test("formats a whole number with two decimal places", () => {
    expect(formatCurrency(60)).toBe("$60.00");
  });

  test("formats an invalid amount as $0.00", () => {
    expect(formatCurrency(undefined)).toBe("$0.00");
    expect(formatCurrency(NaN)).toBe("$0.00");
  });
});
