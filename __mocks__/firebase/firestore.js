// Manual mock for `firebase/firestore`. Every function is a trackable
// jest.fn() so Phase 3 service tests can assert on *what would have been
// called* (collection paths, doc ids, update payloads) without ever
// opening a real network connection. Individual tests can override return
// values with `.mockResolvedValueOnce(...)` / `.mockReturnValueOnce(...)`.

export const getFirestore = jest.fn(() => ({ __type: "firestore" }));

export const collection = jest.fn((db, ...pathSegments) => ({
  __type: "collectionRef",
  path: pathSegments.join("/")
}));

export const doc = jest.fn((db, ...pathSegments) => ({
  __type: "docRef",
  path: pathSegments.join("/")
}));

export const addDoc = jest.fn(async (ref, data) => ({
  id: "mock-generated-id",
  __ref: ref,
  __data: data
}));

export const updateDoc = jest.fn(async (ref, updates) => undefined);

export const deleteDoc = jest.fn(async (ref) => undefined);

export const getDoc = jest.fn(async (ref) => ({
  exists: () => false,
  id: (ref && ref.path && ref.path.split("/").pop()) || "mock-id",
  data: () => ({})
}));

export const getDocs = jest.fn(async (refOrQuery) => ({ docs: [] }));

export const onSnapshot = jest.fn((refOrQuery, onNext) => {
  // Fire once, synchronously, with an empty result so subscribers in the
  // component under test don't just hang waiting for a first snapshot.
  if (typeof onNext === "function") {
    if (refOrQuery && refOrQuery.__type === "docRef") {
      onNext({ exists: () => false, id: "mock-id", data: () => ({}) });
    } else {
      onNext({ docs: [] });
    }
  }
  return jest.fn(); // unsubscribe function
});

export const query = jest.fn((ref, ...constraints) => ({ __type: "query", ref, constraints }));
export const orderBy = jest.fn((field, direction) => ({ __type: "orderBy", field, direction }));
export const arrayUnion = jest.fn((...items) => ({ __type: "arrayUnion", items }));
export const arrayRemove = jest.fn((...items) => ({ __type: "arrayRemove", items }));
export const serverTimestamp = jest.fn(() => ({ __type: "serverTimestamp" }));
