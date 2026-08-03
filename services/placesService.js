// Thin wrapper around the Places API (New) Text Search REST endpoint.
//
// This is a plain fetch() call, not the native Places SDK -- deliberately,
// so venue search works on both Android and iOS without adding another
// native module (and another native rebuild cycle, after the Maps SDK and
// date picker debugging already gone through on this project).
//
// Uses its OWN api key: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY. This is
// intentionally separate from the key baked into AndroidManifest.xml for
// the embedded map. That map key is restricted to "Android apps"
// (package + SHA-1 cert), which is validated by Google Play Services'
// native Maps SDK network layer -- a plain JS fetch() doesn't carry those
// Android attribution headers, so it can't use an Android-restricted key
// directly. See the project README for exactly how to create and restrict
// this second key.

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.addressComponents"
].join(",");

function getApiKey() {
  return process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
}

/**
 * Searches Google Places by free text (venue name, landmark, address...).
 * Returns a normalized array of place results. Returns [] for a too-short
 * query. Throws an Error with a user-presentable message on failure --
 * callers are expected to catch it and show `error.message`.
 */
export async function searchPlaces(query) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Venue search isn't configured yet (missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY).");
  }
  if (!query || query.trim().length < 2) return [];

  let response;
  try {
    response = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK
      },
      body: JSON.stringify({ textQuery: query.trim(), pageSize: 8 })
    });
  } catch (networkError) {
    throw new Error("Couldn't reach Google Places -- check your internet connection.");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errorBody = await response.json();
      detail = errorBody && errorBody.error ? errorBody.error.message : "";
    } catch (parseError) {
      // response body wasn't JSON -- fall through with no extra detail
    }
    throw new Error(detail || `Places search failed (${response.status}).`);
  }

  const data = await response.json();
  return (data.places || []).map(normalizePlace);
}

function normalizePlace(place) {
  const components = place.addressComponents || [];
  const city = findComponent(components, ["locality", "postal_town", "sublocality"]);
  const state = findComponent(components, ["administrative_area_level_1"]);

  return {
    placeId: place.id || null,
    name: place.displayName ? place.displayName.text : "",
    formattedAddress: place.formattedAddress || "",
    latitude: place.location ? place.location.latitude : null,
    longitude: place.location ? place.location.longitude : null,
    city: city ? city.longText : "",
    state: state ? state.shortText : ""
  };
}

function findComponent(components, types) {
  return components.find((component) => (component.types || []).some((t) => types.includes(t))) || null;
}
