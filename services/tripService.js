// All Firestore reads/writes for trips and everything that belongs to a
// trip (checklist items, reservation links, expenses, reminders) plus the
// shared travelers collection. Screens should never call Firestore
// directly -- they call functions from this file.
//
// Data model:
//   trips/{tripId}                                primary trip record
//   trips/{tripId}/checklistItems/{itemId}         belongs to one trip
//   trips/{tripId}/reservationLinks/{linkId}        belongs to one trip
//   trips/{tripId}/expenses/{expenseId}             belongs to one trip
//   trips/{tripId}/reminders/{reminderId}           belongs to one trip;
//     { title, description, tripId, dateTime (ISO string), enabled,
//       linkedChecklistItemId, osIdentifier } -- osIdentifier is the
//       expo-notifications schedule id, needed to cancel/reschedule the
//       actual OS notification when a reminder is edited, disabled, or
//       its trip is deleted. It isn't part of the reminder "shape" the
//       user thinks about, just bookkeeping for services/notificationService.js.
//   travelers/{travelerId}                          shared across trips;
//     trips.travelerIds (array) tracks who is assigned to a given trip
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { generateChecklist } from "../utils/checklistTemplates";

// ---------- Trips ----------

export function subscribeToTrips(onChange, onError) {
  const q = query(collection(db, "trips"), orderBy("startDate", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export async function getTrip(tripId) {
  const snap = await getDoc(doc(db, "trips", tripId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribeToTrip(tripId, onChange, onError) {
  return onSnapshot(
    doc(db, "trips", tripId),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

/**
 * Creates a trip and seeds its checklist subcollection from the default
 * template for the chosen event type / travel mode. The template file
 * itself is never mutated -- only the copies written to Firestore.
 */
export async function createTrip(tripData) {
  const tripRef = await addDoc(collection(db, "trips"), {
    ...tripData,
    travelerIds: tripData.travelerIds || [],
    createdAt: serverTimestamp()
  });

  const templateItems = generateChecklist(
    tripData.eventType,
    tripData.travelRequired,
    tripData.travelMode || null
  );

  await Promise.all(
    templateItems.map((item) => addDoc(collection(db, "trips", tripRef.id, "checklistItems"), item))
  );

  return tripRef.id;
}

export async function updateTrip(tripId, updates) {
  await updateDoc(doc(db, "trips", tripId), updates);
}

async function deleteAllInSubcollection(tripId, subcollectionName) {
  const snap = await getDocs(collection(db, "trips", tripId, subcollectionName));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export async function deleteTrip(tripId) {
  // Clean up every subcollection before removing the trip document so no
  // orphaned checklist/links/expenses/reminders are left behind. Note: this
  // only removes the Firestore records -- callers are responsible for
  // cancelling any OS-scheduled notifications first (see the reminders
  // list already loaded on the Trip Dashboard, which cancels each one via
  // notificationService.cancelLocalReminder before calling this).
  await Promise.all([
    deleteAllInSubcollection(tripId, "checklistItems"),
    deleteAllInSubcollection(tripId, "reservationLinks"),
    deleteAllInSubcollection(tripId, "expenses"),
    deleteAllInSubcollection(tripId, "settlements"),
    deleteAllInSubcollection(tripId, "reminders")
  ]);
  await deleteDoc(doc(db, "trips", tripId));
}

// ---------- Travelers (shared, top-level collection) ----------

export function subscribeToTravelers(onChange, onError) {
  const q = query(collection(db, "travelers"), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export async function createTraveler(traveler) {
  const ref = await addDoc(collection(db, "travelers"), traveler);
  return ref.id;
}

export async function updateTraveler(travelerId, updates) {
  await updateDoc(doc(db, "travelers", travelerId), updates);
}

export async function deleteTraveler(travelerId) {
  await deleteDoc(doc(db, "travelers", travelerId));
}

export async function assignTravelerToTrip(tripId, travelerId) {
  await updateDoc(doc(db, "trips", tripId), { travelerIds: arrayUnion(travelerId) });
}

export async function removeTravelerFromTrip(tripId, travelerId) {
  await updateDoc(doc(db, "trips", tripId), { travelerIds: arrayRemove(travelerId) });
}

// ---------- Generic subcollection helpers (checklist / links / expenses / reminders) ----------

function subRef(tripId, name) {
  return collection(db, "trips", tripId, name);
}

function subscribeToSubcollection(tripId, name, onChange, onError, orderField) {
  const q = orderField ? query(subRef(tripId, name), orderBy(orderField, "asc")) : subRef(tripId, name);
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

// Checklist items
export const subscribeToChecklist = (tripId, onChange, onError) =>
  subscribeToSubcollection(tripId, "checklistItems", onChange, onError, "order");

export const addChecklistItem = (tripId, item) =>
  addDoc(subRef(tripId, "checklistItems"), { completed: false, isDefault: false, order: Date.now(), ...item });

export const updateChecklistItem = (tripId, itemId, updates) =>
  updateDoc(doc(db, "trips", tripId, "checklistItems", itemId), updates);

export const toggleChecklistItem = (tripId, itemId, completed) =>
  updateChecklistItem(tripId, itemId, { completed });

export const deleteChecklistItem = (tripId, itemId) =>
  deleteDoc(doc(db, "trips", tripId, "checklistItems", itemId));

// Reservation links
export const subscribeToLinks = (tripId, onChange, onError) =>
  subscribeToSubcollection(tripId, "reservationLinks", onChange, onError, null);

export const addLink = (tripId, link) => addDoc(subRef(tripId, "reservationLinks"), link);

export const updateLink = (tripId, linkId, updates) =>
  updateDoc(doc(db, "trips", tripId, "reservationLinks", linkId), updates);

export const deleteLink = (tripId, linkId) =>
  deleteDoc(doc(db, "trips", tripId, "reservationLinks", linkId));

// Expenses
export const subscribeToExpenses = (tripId, onChange, onError) =>
  subscribeToSubcollection(tripId, "expenses", onChange, onError, null);

export const addExpense = (tripId, expense) =>
  addDoc(subRef(tripId, "expenses"), { ...expense, createdAt: serverTimestamp() });

export const updateExpense = (tripId, expenseId, updates) =>
  updateDoc(doc(db, "trips", tripId, "expenses", expenseId), updates);

export const deleteExpense = (tripId, expenseId) =>
  deleteDoc(doc(db, "trips", tripId, "expenses", expenseId));

// Settlements (direct repayments between two travelers, e.g. "Boomer paid
// Des $100" -- recorded separately from expenses so the original expenses
// are never altered; utils/expenseCalculator.js's calculateNetBalances
// applies these on top of the expense-derived balances)
export const subscribeToSettlements = (tripId, onChange, onError) =>
  subscribeToSubcollection(tripId, "settlements", onChange, onError, null);

export const addSettlement = (tripId, settlement) =>
  addDoc(subRef(tripId, "settlements"), { ...settlement, createdAt: serverTimestamp() });

export const deleteSettlement = (tripId, settlementId) =>
  deleteDoc(doc(db, "trips", tripId, "settlements", settlementId));

// Reminders (user-created, optionally linked to a checklist item; kept in
// sync with the device's scheduled notifications by the screens that call
// these -- see app/trips/[tripId]/reminders.js)
export const subscribeToReminders = (tripId, onChange, onError) =>
  subscribeToSubcollection(tripId, "reminders", onChange, onError, "dateTime");

export const addReminder = (tripId, reminder) => addDoc(subRef(tripId, "reminders"), { tripId, ...reminder });

export const updateReminder = (tripId, reminderId, updates) =>
  updateDoc(doc(db, "trips", tripId, "reminders", reminderId), updates);

export const deleteReminder = (tripId, reminderId) =>
  deleteDoc(doc(db, "trips", tripId, "reminders", reminderId));
