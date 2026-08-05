// Verifies tripService.js calls the Firestore SDK with the right
// collection/document paths and payload shapes. "firebase/firestore" is
// the manual mock at __mocks__/firebase/firestore.js -- every call here is
// tracked in memory only; nothing ever reaches a real Firestore project.
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, orderBy } from "firebase/firestore";
import {
  createTrip,
  updateTrip,
  deleteTrip,
  getTrip,
  subscribeToTrip,
  subscribeToChecklist,
  addChecklistItem,
  updateChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  subscribeToReminders,
  addReminder,
  updateReminder,
  deleteReminder,
  subscribeToSettlements,
  addSettlement,
  deleteSettlement
} from "../tripService";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createTrip", () => {
  test("writes the trip document, then seeds its checklist subcollection from the event type's template", async () => {
    addDoc.mockImplementationOnce(async (ref, data) => ({ id: "trip-abc", __ref: ref, __data: data }));

    const tripId = await createTrip({
      title: "Karaoke Night",
      eventType: "inTownConcert",
      travelRequired: false,
      travelMode: null,
      startDate: "2026-08-14"
    });

    expect(tripId).toBe("trip-abc");

    const [tripsRef, tripPayload] = addDoc.mock.calls[0];
    expect(tripsRef.path).toBe("trips");
    expect(tripPayload).toEqual(
      expect.objectContaining({ title: "Karaoke Night", eventType: "inTownConcert", travelerIds: [] })
    );
    expect(tripPayload.createdAt).toEqual({ __type: "serverTimestamp" });

    // In-Town Concert's template has 9 items -- each seeded as its own addDoc
    // call into trips/trip-abc/checklistItems.
    const checklistCalls = addDoc.mock.calls.slice(1);
    expect(checklistCalls.length).toBe(9);
    checklistCalls.forEach(([ref]) => expect(ref.path).toBe("trips/trip-abc/checklistItems"));
    expect(checklistCalls[0][1].title).toBe("Purchase or confirm ticket");
  });

  test("defaults travelerIds to an empty array when none are given", async () => {
    await createTrip({ title: "Solo Trip", eventType: "inTownConcert", travelRequired: false, startDate: "2026-08-14" });
    expect(addDoc.mock.calls[0][1].travelerIds).toEqual([]);
  });
});

describe("updateTrip / deleteTrip", () => {
  test("updateTrip updates the trip document at trips/{tripId}", async () => {
    await updateTrip("trip-1", { title: "New Title" });
    expect(doc).toHaveBeenCalledWith(expect.anything(), "trips", "trip-1");
    expect(updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: "trips/trip-1" }), { title: "New Title" });
  });

  test("deleteTrip removes every item in each subcollection (including settlements) before deleting the trip document itself", async () => {
    const twoDocs = { docs: [{ ref: { path: "stub/1" } }, { ref: { path: "stub/2" } }] };
    getDocs
      .mockResolvedValueOnce(twoDocs) // checklistItems
      .mockResolvedValueOnce(twoDocs) // reservationLinks
      .mockResolvedValueOnce(twoDocs) // expenses
      .mockResolvedValueOnce(twoDocs) // settlements
      .mockResolvedValueOnce(twoDocs); // reminders

    await deleteTrip("trip-1");

    expect(getDocs).toHaveBeenCalledTimes(5);
    // 5 subcollections x 2 stub docs each = 10 subcollection deletes, plus 1 for the trip doc.
    expect(deleteDoc).toHaveBeenCalledTimes(11);
    expect(deleteDoc).toHaveBeenLastCalledWith(expect.objectContaining({ path: "trips/trip-1" }));
  });
});

describe("getTrip / subscribeToTrip", () => {
  test("getTrip returns null when the document doesn't exist", async () => {
    const trip = await getTrip("missing-trip");
    expect(trip).toBeNull();
  });

  test("getTrip returns the trip data merged with its id when it exists", async () => {
    getDoc.mockResolvedValueOnce({ exists: () => true, id: "trip-1", data: () => ({ title: "Karaoke Night" }) });
    const trip = await getTrip("trip-1");
    expect(trip).toEqual({ id: "trip-1", title: "Karaoke Night" });
  });

  test("subscribeToTrip reads from doc(trips/{tripId}), not a query", () => {
    const onChange = jest.fn();
    subscribeToTrip("trip-1", onChange, jest.fn());
    expect(doc).toHaveBeenCalledWith(expect.anything(), "trips", "trip-1");
    // The mock fires onSnapshot once, synchronously, with a non-existent doc.
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("checklist item calls", () => {
  test("subscribeToChecklist queries trips/{tripId}/checklistItems ordered by 'order'", () => {
    const onChange = jest.fn();
    subscribeToChecklist("trip-1", onChange, jest.fn());
    expect(collection).toHaveBeenCalledWith(expect.anything(), "trips", "trip-1", "checklistItems");
    expect(orderBy).toHaveBeenCalledWith("order", "asc");
    expect(onChange).toHaveBeenCalledWith([]);
  });

  test("addChecklistItem writes into trips/{tripId}/checklistItems with completed/isDefault defaults", async () => {
    await addChecklistItem("trip-1", { title: "Pack sunscreen", category: "custom" });
    const [ref, payload] = addDoc.mock.calls[0];
    expect(ref.path).toBe("trips/trip-1/checklistItems");
    expect(payload).toEqual(
      expect.objectContaining({ title: "Pack sunscreen", category: "custom", completed: false, isDefault: false })
    );
  });

  test("toggleChecklistItem updates only the completed field", async () => {
    await toggleChecklistItem("trip-1", "item-1", true);
    expect(doc).toHaveBeenCalledWith(expect.anything(), "trips", "trip-1", "checklistItems", "item-1");
    expect(updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: "trips/trip-1/checklistItems/item-1" }), {
      completed: true
    });
  });

  test("updateChecklistItem passes the given updates through unchanged", async () => {
    await updateChecklistItem("trip-1", "item-1", { title: "Renamed task" });
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { title: "Renamed task" });
  });

  test("deleteChecklistItem deletes trips/{tripId}/checklistItems/{itemId}", async () => {
    await deleteChecklistItem("trip-1", "item-1");
    expect(deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: "trips/trip-1/checklistItems/item-1" }));
  });
});

describe("reminder calls", () => {
  test("subscribeToReminders orders by dateTime", () => {
    const onChange = jest.fn();
    subscribeToReminders("trip-1", onChange, jest.fn());
    expect(collection).toHaveBeenCalledWith(expect.anything(), "trips", "trip-1", "reminders");
    expect(orderBy).toHaveBeenCalledWith("dateTime", "asc");
    expect(onChange).toHaveBeenCalledWith([]);
  });

  test("addReminder stores the reminder with its tripId included in the document", async () => {
    const reminder = {
      title: "Buy tickets",
      description: "",
      dateTime: "2026-08-14T09:00:00.000Z",
      enabled: true,
      linkedChecklistItemId: null,
      osIdentifier: "os-1"
    };
    await addReminder("trip-1", reminder);
    const [ref, payload] = addDoc.mock.calls[0];
    expect(ref.path).toBe("trips/trip-1/reminders");
    expect(payload).toEqual({ tripId: "trip-1", ...reminder });
  });

  test("updateReminder updates trips/{tripId}/reminders/{reminderId}", async () => {
    await updateReminder("trip-1", "rem-1", { enabled: false, osIdentifier: null });
    expect(updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: "trips/trip-1/reminders/rem-1" }), {
      enabled: false,
      osIdentifier: null
    });
  });

  test("deleteReminder deletes trips/{tripId}/reminders/{reminderId}", async () => {
    await deleteReminder("trip-1", "rem-1");
    expect(deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: "trips/trip-1/reminders/rem-1" }));
  });
});

describe("settlement calls", () => {
  test("subscribeToSettlements reads trips/{tripId}/settlements", () => {
    const onChange = jest.fn();
    subscribeToSettlements("trip-1", onChange, jest.fn());
    expect(collection).toHaveBeenCalledWith(expect.anything(), "trips", "trip-1", "settlements");
    expect(onChange).toHaveBeenCalledWith([]);
  });

  test("addSettlement writes into trips/{tripId}/settlements with a createdAt timestamp", async () => {
    const settlement = { paidByTravelerId: "boomer", paidToTravelerId: "des", amount: 100, date: "2026-08-14", note: "" };
    await addSettlement("trip-1", settlement);
    const [ref, payload] = addDoc.mock.calls[0];
    expect(ref.path).toBe("trips/trip-1/settlements");
    expect(payload).toEqual(expect.objectContaining(settlement));
    expect(payload.createdAt).toEqual({ __type: "serverTimestamp" });
  });

  test("deleteSettlement deletes trips/{tripId}/settlements/{settlementId}", async () => {
    await deleteSettlement("trip-1", "settle-1");
    expect(deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: "trips/trip-1/settlements/settle-1" }));
  });
});
