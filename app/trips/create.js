import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Pressable
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { colors } from "../../constants/colors";
import { typography } from "../../constants/typography";
import { EVENT_TYPES, TRAVEL_MODES } from "../../utils/checklistTemplates";
import { validateFields, isRequired } from "../../utils/validators";
import { getTodayDateString, isEndDateValid } from "../../utils/dateUtils";
import {
  createTrip,
  updateTrip,
  getTrip,
  subscribeToTravelers,
  createTraveler
} from "../../services/tripService";
import { deleteCoverPhoto } from "../../services/imageService";
import AppInput from "../../components/AppInput";
import AppButton from "../../components/AppButton";
import Chip from "../../components/Chip";
import DateField from "../../components/DateField";
import PlaceSearchField from "../../components/PlaceSearchField";
import CoverPhotoField from "../../components/CoverPhotoField";
import CollapsibleSection from "../../components/CollapsibleSection";

// Requirement 6: the venue/location field's label (and whether it's framed
// as optional) depends on event type. For cruises specifically, the search
// field is the departure PORT/TERMINAL, never "the venue" -- the cruise
// itself isn't a venue, and the terminal isn't always known/needed.
function getLocationFieldLabel(eventType) {
  if (eventType === "cruise") return "Departure Port or Terminal (optional)";
  if (eventType === "custom") return "Location";
  return "Venue or Event Location";
}

// "Destination" reads oddly for a cruise -- the ship goes many places, and
// what the traveler actually needs to record is where they leave FROM.
function getDestinationFieldLabel(eventType) {
  if (eventType === "cruise") return "Departure City / Port";
  return "Destination";
}

// travelRequired is derived from event type for "never"/"always"/"cruise"
// behaviors; only "ask" (Festival, Custom Event) leaves it up to the
// Local/Traveling chip choice.
function resolveTravelRequired(travelBehavior, travelRequiredState) {
  if (travelBehavior === "never") return false;
  if (travelBehavior === "always" || travelBehavior === "cruise") return true;
  return travelRequiredState;
}

function getTransportQuestionLabel(travelBehavior) {
  if (travelBehavior === "cruise") return "How are you traveling to the departure city?";
  return "How are you getting there?";
}

// Shared shape used both to build the payload actually saved to Firestore
// (handleSave) and to build a comparable snapshot of the trip as it was
// originally loaded (buildOriginalPayload) -- the sticky save button's
// "disabled until changed" state in edit mode is just a structural
// comparison of these two, so keeping both built from the exact same shape
// is what makes that comparison meaningful instead of accidentally always
// (or never) true.
function normalizePayloadForCompare(payload) {
  // travelerIds' order can differ (toggle order vs. however the trip was
  // originally saved) without the *set* of travelers actually having
  // changed -- sorted here so reordering alone never reads as "dirty".
  return JSON.stringify({ ...payload, travelerIds: [...payload.travelerIds].sort() });
}

function isEqualPayload(a, b) {
  return normalizePayloadForCompare(a) === normalizePayloadForCompare(b);
}

// Create / Edit Trip. If an `editId` query param is present, the screen
// loads that trip and saves via updateTrip instead of createTrip -- the
// class project's "Create / Edit Trip" screen is intentionally one screen.
export default function CreateTripScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams();
  const isEditing = Boolean(editId);

  const [loadingTrip, setLoadingTrip] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [title, setTitle] = useState("");
  // Optional cover photo. `coverPhotoUri` is what gets saved on the trip;
  // `originalCoverPhotoUri` tracks whatever was already saved when an
  // existing trip was loaded (null for a new trip), so a successful save
  // can clean up an old persisted file that got replaced or removed --
  // never delete it before the save that actually drops the reference to
  // it has succeeded.
  const [coverPhotoUri, setCoverPhotoUri] = useState(null);
  const [originalCoverPhotoUri, setOriginalCoverPhotoUri] = useState(null);
  // Snapshot of the trip exactly as loaded, in the same shape buildTripPayload()
  // produces from current form state -- lets the sticky save button stay
  // disabled in edit mode until something has actually changed. Stays null
  // for a brand new trip (there's nothing to compare against, and create
  // mode's disabled state doesn't use it -- see saveDisabled below).
  const [originalPayload, setOriginalPayload] = useState(null);
  const [eventType, setEventType] = useState("inTownConcert");
  const [travelRequired, setTravelRequired] = useState(false);
  const [travelMode, setTravelMode] = useState(null);
  // Start date defaults to the device's current local date (requirement:
  // never blank for a new trip). End date is optional and left unset --
  // "unset" means "same as start date" everywhere it's read.
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState("");
  const [destination, setDestination] = useState("");
  // Cruise-only, optional. Kept as plain text -- there's no useful
  // search/autocomplete source for cruise line or ship name.
  const [cruiseLine, setCruiseLine] = useState("");
  const [shipName, setShipName] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  // Set directly from a selected Places search result so the Map screen
  // doesn't need to geocode the address later. Stay null for trips saved
  // via the manual-entry fallback -- the Map screen's existing
  // geocode-on-open logic already handles that case.
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [placeId, setPlaceId] = useState(null);
  // Shows the plain text Venue/Address inputs instead of the search field,
  // for venues Places search can't find (private residences, informal
  // locations) or when the user just prefers typing.
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [notes, setNotes] = useState("");

  const [travelers, setTravelers] = useState([]);
  const [selectedTravelerIds, setSelectedTravelerIds] = useState([]);
  const [newTravelerName, setNewTravelerName] = useState("");

  const selectedEventType = EVENT_TYPES.find((e) => e.key === eventType);
  const travelBehavior = selectedEventType ? selectedEventType.travelBehavior : "ask";
  // True whenever transportation chips (Driving/Flying/Other) should be
  // shown -- always for "always"/"cruise" behaviors, and for "ask" only
  // once the user has picked "Traveling".
  const showsTransportChoices =
    travelBehavior === "always" || travelBehavior === "cruise" || (travelBehavior === "ask" && travelRequired);
  // The Travel section has nothing to show for "never" (e.g. In-Town
  // Concert) -- collapsing it away entirely for that case *is* the
  // "Travel section may collapse when not required" behavior, rather than
  // a separate expand/collapse control on top of it.
  const showsTravelSection = travelBehavior !== "never";
  // Editing an existing trip means the user is more likely revisiting one
  // specific thing than reviewing the whole form top to bottom -- Event
  // Type / Travelers / Notes default collapsed (with a summary still
  // visible) so Save Changes is reachable without scrolling past sections
  // that already have a value. Create mode has nothing to summarize yet,
  // so everything starts expanded and visible.
  const sectionDefaultExpanded = !isEditing;

  useEffect(() => {
    const unsubscribe = subscribeToTravelers(setTravelers, () => {});
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const trip = await getTrip(editId);
      if (trip) {
        setTitle(trip.title || "");
        setEventType(trip.eventType || "inTownConcert");
        setTravelRequired(Boolean(trip.travelRequired));
        setTravelMode(trip.travelMode || null);
        setStartDate(trip.startDate || "");
        setEndDate(trip.endDate || "");
        setDestination(trip.destination || "");
        setCoverPhotoUri(trip.coverPhotoUri || null);
        setOriginalCoverPhotoUri(trip.coverPhotoUri || null);
        setCruiseLine(trip.cruiseLine || "");
        setShipName(trip.shipName || "");
        setVenue(trip.venue || "");
        setAddress(trip.address || "");
        setLatitude(trip.latitude ?? null);
        setLongitude(trip.longitude ?? null);
        setPlaceId(trip.placeId ?? null);
        setNotes(trip.notes || "");
        setSelectedTravelerIds(trip.travelerIds || []);
        setOriginalPayload({
          title: (trip.title || "").trim(),
          eventType: trip.eventType || "inTownConcert",
          travelRequired: Boolean(trip.travelRequired),
          travelMode: trip.travelMode || null,
          startDate: trip.startDate || "",
          endDate: trip.endDate || trip.startDate || "",
          destination: (trip.destination || "").trim(),
          coverPhotoUri: trip.coverPhotoUri || null,
          cruiseLine: (trip.cruiseLine || "").trim(),
          shipName: (trip.shipName || "").trim(),
          venue: (trip.venue || "").trim(),
          address: (trip.address || "").trim(),
          latitude: trip.latitude ?? null,
          longitude: trip.longitude ?? null,
          placeId: trip.placeId ?? null,
          notes: (trip.notes || "").trim(),
          travelerIds: trip.travelerIds || []
        });
      }
      setLoadingTrip(false);
    })();
  }, [editId]);

  function handleStartDateChange(newStartDate) {
    setStartDate(newStartDate);
    // If the previously chosen end date is now before the new start date,
    // clear it rather than silently saving an invalid range.
    if (endDate && !isEndDateValid(newStartDate, endDate)) {
      setEndDate("");
    }
  }

  function handlePlaceSelect(place) {
    setVenue(place.name || "");
    setAddress(place.formattedAddress || "");
    setLatitude(place.latitude ?? null);
    setLongitude(place.longitude ?? null);
    setPlaceId(place.placeId || null);
    // Only auto-fill Destination if the user hasn't already typed one --
    // never overwrite something they entered on purpose.
    if (!destination.trim() && (place.city || place.state)) {
      setDestination([place.city, place.state].filter(Boolean).join(", "));
    }
  }

  function handlePlaceClear() {
    setVenue("");
    setAddress("");
    setLatitude(null);
    setLongitude(null);
    setPlaceId(null);
  }

  function toggleTraveler(id) {
    setSelectedTravelerIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function handleQuickAddTraveler() {
    const name = newTravelerName.trim();
    if (!name) return;
    const id = await createTraveler({ name });
    setSelectedTravelerIds((prev) => [...prev, id]);
    setNewTravelerName("");
  }

  // Same payload shape handleSave sends to Firestore, factored out so the
  // live "has this changed?" check below (used to gate the sticky save
  // button in edit mode) can never silently drift out of sync with what
  // actually gets saved.
  function buildTripPayload() {
    return {
      title: title.trim(),
      eventType,
      travelRequired: resolveTravelRequired(travelBehavior, travelRequired),
      travelMode: showsTransportChoices ? travelMode : null,
      startDate,
      endDate: endDate || startDate,
      destination: destination.trim(),
      coverPhotoUri: coverPhotoUri || null,
      cruiseLine: eventType === "cruise" ? cruiseLine.trim() : "",
      shipName: eventType === "cruise" ? shipName.trim() : "",
      venue: venue.trim(),
      address: address.trim(),
      latitude,
      longitude,
      placeId,
      notes: notes.trim(),
      travelerIds: selectedTravelerIds
    };
  }

  // Mirrors handleSave's own required-field checks, kept in sync
  // deliberately (not derived from validateFields' output directly) so the
  // sticky button's disabled state never needs to run validateFields --
  // and therefore never needs to set/clear `errors` -- just to decide
  // whether it should be interactive.
  const requiredFieldsValid =
    isRequired(title) &&
    isRequired(startDate) &&
    isEndDateValid(startDate, endDate) &&
    (!showsTransportChoices || Boolean(travelMode));

  // Create mode has nothing to compare against -- only whether required
  // fields are filled gates it. Edit mode additionally stays disabled
  // until the form actually differs from the trip as it was loaded, so
  // "Save Changes" never implies there's something new to save when there
  // isn't.
  const hasChanges = !isEditing || !originalPayload || !isEqualPayload(buildTripPayload(), originalPayload);
  const saveDisabled = !requiredFieldsValid || (isEditing && !hasChanges);

  async function handleSave() {
    const fieldErrors = validateFields(
      { title, startDate },
      {
        title: { check: isRequired, message: "Trip title is required." },
        startDate: { check: isRequired, message: "Start date is required." }
      }
    );
    if (showsTransportChoices && !travelMode) {
      fieldErrors.travelMode = "Choose a transportation option -- this customizes your checklist.";
    }
    if (!isEndDateValid(startDate, endDate)) {
      fieldErrors.endDate = "End date can't be before the start date.";
    }
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    const tripData = buildTripPayload();

    setSaving(true);
    try {
      if (isEditing) {
        await updateTrip(editId, tripData);
        // Best-effort cleanup: only once the save that dropped the old
        // reference has actually succeeded, and only for a file this
        // screen itself persisted (never touch a fresh uri from the same
        // session that's still in use).
        if (originalCoverPhotoUri && originalCoverPhotoUri !== coverPhotoUri) {
          await deleteCoverPhoto(originalCoverPhotoUri);
        }
        // Edit is always reached by *pushing* from that trip's own
        // Dashboard (the pencil icon in app/trips/[tripId]/index.js), so
        // the existing Dashboard is already directly underneath this
        // screen on the stack. router.back() pops Edit off and reveals it
        // directly -- router.replace() here would instead push a *second*
        // Dashboard on top of the first, leaving a duplicate entry that
        // needed Back pressed twice to reach Home. The Dashboard already
        // has the fresh data by the time we get there too, since it holds
        // a live subscribeToTrip() listener that's been running the whole
        // time Edit was open on top of it.
        if (router.canGoBack()) {
          router.back();
        } else {
          // Fallback for the rare case Edit was reached some other way
          // (e.g. a deep link straight into edit mode) where there's
          // nothing to go back to -- replace still avoids leaving Edit
          // itself in the stack.
          router.replace(`/trips/${editId}`);
        }
      } else {
        const newId = await createTrip(tripData);
        // Create is reached by pushing from Home, so there's no existing
        // Dashboard to go back to -- replace is correct here, and avoids
        // leaving the blank Create screen in the stack behind the new one.
        router.replace(`/trips/${newId}`);
      }
    } catch (e) {
      Alert.alert("Couldn't save trip", e.message);
    } finally {
      setSaving(false);
    }
  }

  const screenTitle = isEditing ? "Edit Trip" : "Create Trip";

  if (loadingTrip) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: screenTitle }} />
        <ActivityIndicator color={colors.primaryPink} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: screenTitle }} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionHeader}>Trip Details</Text>
        <AppInput label="Trip Title" value={title} onChangeText={setTitle} placeholder="e.g. Karaoke Night Downtown" error={errors.title} />

        <CollapsibleSection
          title="Event Type"
          subtitle={selectedEventType ? selectedEventType.label : undefined}
          defaultExpanded={sectionDefaultExpanded}
          testID="event-type-section-toggle"
        >
          <View style={styles.chipRow}>
            {EVENT_TYPES.map((type) => (
              <Chip
                key={type.key}
                label={type.label}
                selected={eventType === type.key}
                onPress={() => {
                  setEventType(type.key);
                  setTravelMode(null);
                  setTravelRequired(type.travelBehavior === "always" || type.travelBehavior === "cruise");
                }}
              />
            ))}
          </View>
        </CollapsibleSection>

        <View style={styles.dateRow} testID="date-row">
          <View style={styles.dateColumn}>
            <DateField
              label="Start Date"
              value={startDate}
              onChange={handleStartDateChange}
              error={errors.startDate}
              testID="start-date"
            />
          </View>
          <View style={styles.dateColumn}>
            <DateField
              label="End Date (optional)"
              value={endDate}
              onChange={setEndDate}
              onClear={() => setEndDate("")}
              minimumDate={startDate}
              placeholder="Same as start"
              error={errors.endDate}
              testID="end-date"
            />
          </View>
        </View>

        <CoverPhotoField uri={coverPhotoUri} onChange={setCoverPhotoUri} testID="cover-photo" />

        {showsTravelSection && (
          <>
            <Text style={styles.sectionHeader}>Travel</Text>
            {travelBehavior === "ask" && (
              <>
                <Text style={styles.sectionLabel}>Local or Traveling?</Text>
                <View style={styles.chipRow}>
                  <Chip
                    label="Local"
                    selected={!travelRequired}
                    onPress={() => {
                      setTravelRequired(false);
                      setTravelMode(null);
                    }}
                  />
                  <Chip label="Traveling" selected={travelRequired} onPress={() => setTravelRequired(true)} />
                </View>
              </>
            )}

            {showsTransportChoices && (
              <>
                <Text style={styles.sectionLabel}>{getTransportQuestionLabel(travelBehavior)}</Text>
                <Text style={styles.helperText}>This choice customizes your checklist.</Text>
                <View style={styles.chipRow}>
                  {TRAVEL_MODES.map((mode) => (
                    <Chip key={mode.key} label={mode.label} selected={travelMode === mode.key} onPress={() => setTravelMode(mode.key)} />
                  ))}
                </View>
                {errors.travelMode ? <Text style={styles.error}>{errors.travelMode}</Text> : null}
              </>
            )}
          </>
        )}

        <Text style={styles.sectionHeader}>Location</Text>
        <AppInput
          label={getDestinationFieldLabel(eventType)}
          value={destination}
          onChangeText={setDestination}
          placeholder={eventType === "cruise" ? "e.g. Miami, FL" : "e.g. Nashville, TN"}
        />

        {eventType === "cruise" && (
          <>
            <AppInput label="Cruise Line (optional)" value={cruiseLine} onChangeText={setCruiseLine} placeholder="e.g. Royal Caribbean" />
            <AppInput label="Ship Name (optional)" value={shipName} onChangeText={setShipName} placeholder="e.g. Wonder of the Seas" />
          </>
        )}

        {useManualLocation ? (
          <>
            <AppInput label={`${getLocationFieldLabel(eventType)} -- Name`} value={venue} onChangeText={setVenue} placeholder="e.g. Bridgestone Arena" />
            <AppInput label="Address" value={address} onChangeText={setAddress} placeholder="Street address for the map" />
            <Pressable onPress={() => setUseManualLocation(false)} hitSlop={8} style={styles.manualToggle}>
              <Text style={styles.manualToggleText}>Search for a venue instead</Text>
            </Pressable>
          </>
        ) : (
          <PlaceSearchField
            label={getLocationFieldLabel(eventType)}
            value={venue || address ? { name: venue, formattedAddress: address } : null}
            onSelect={handlePlaceSelect}
            onClear={handlePlaceClear}
            onManualEntry={() => setUseManualLocation(true)}
          />
        )}

        <CollapsibleSection title="Travelers" defaultExpanded={sectionDefaultExpanded} testID="travelers-section-toggle">
          <View style={styles.chipRow}>
            {travelers.map((t) => (
              <Chip key={t.id} label={t.name} selected={selectedTravelerIds.includes(t.id)} onPress={() => toggleTraveler(t.id)} />
            ))}
          </View>
          <View style={styles.quickAddRow}>
            <View style={{ flex: 1 }}>
              <AppInput label="Add a traveler" value={newTravelerName} onChangeText={setNewTravelerName} placeholder="Traveler name" />
            </View>
            <AppButton title="Add" variant="secondary" onPress={handleQuickAddTraveler} style={styles.quickAddButton} />
          </View>
        </CollapsibleSection>

        <CollapsibleSection title="Notes" defaultExpanded={sectionDefaultExpanded} testID="notes-section-toggle">
          <AppInput label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything else worth remembering" multiline />
        </CollapsibleSection>
      </ScrollView>

      <View style={styles.bottomBar}>
        <AppButton
          title={isEditing ? "Save Changes" : "Create Trip"}
          onPress={handleSave}
          loading={saving}
          disabled={saveDisabled}
          testID="save-trip-button"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.lightGray },
  content: { padding: 20, paddingBottom: 32 },
  sectionHeader: {
    ...typography.sectionTitle,
    fontSize: 16,
    color: colors.black,
    marginBottom: 10,
    marginTop: 6
  },
  sectionLabel: { ...typography.cardTitle, fontSize: 15, color: colors.black, marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  helperText: { ...typography.caption, color: colors.darkGray, marginBottom: 8 },
  error: { ...typography.caption, color: colors.danger, marginBottom: 8 },
  dateRow: { flexDirection: "row", gap: 12 },
  dateColumn: { flex: 1 },
  quickAddRow: { flexDirection: "row", alignItems: "flex-end" },
  quickAddButton: { marginBottom: 16, marginLeft: 10, minWidth: 80 },
  manualToggle: { alignSelf: "flex-start", marginTop: -8, marginBottom: 16 },
  manualToggleText: { ...typography.caption, color: colors.primaryPink },
  // Sits below the ScrollView as a plain sibling in a flex column, not
  // absolutely positioned over it -- it always occupies its own space at
  // the bottom of the screen (the "sticky" part) without ever overlapping
  // scrollable content, so there's no field it could visually cover.
  bottomBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16
  }
});
