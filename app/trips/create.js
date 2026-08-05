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
import { useRouter, useLocalSearchParams } from "expo-router";
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

    const tripData = {
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
        router.replace(`/trips/${editId}`);
      } else {
        const newId = await createTrip(tripData);
        router.replace(`/trips/${newId}`);
      }
    } catch (e) {
      Alert.alert("Couldn't save trip", e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingTrip) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primaryPink} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppInput label="Trip Title" value={title} onChangeText={setTitle} placeholder="e.g. Karaoke Night Downtown" error={errors.title} />

        <CoverPhotoField uri={coverPhotoUri} onChange={setCoverPhotoUri} testID="cover-photo" />

        <Text style={styles.sectionLabel}>Event Type</Text>
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

        <DateField
          label="Start Date"
          value={startDate}
          onChange={handleStartDateChange}
          error={errors.startDate}
          testID="start-date"
        />
        <DateField
          label="End Date (optional -- defaults to start date)"
          value={endDate}
          onChange={setEndDate}
          onClear={() => setEndDate("")}
          minimumDate={startDate}
          placeholder="Same as start date"
          error={errors.endDate}
          testID="end-date"
        />
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

        <AppInput label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything else worth remembering" multiline />

        <Text style={styles.sectionLabel}>Travelers</Text>
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

        <AppButton title={isEditing ? "Save Changes" : "Create Trip"} onPress={handleSave} loading={saving} style={styles.saveButton} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.lightGray },
  content: { padding: 20, paddingBottom: 60 },
  sectionLabel: { ...typography.cardTitle, fontSize: 15, color: colors.black, marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  helperText: { ...typography.caption, color: colors.darkGray, marginBottom: 8 },
  error: { ...typography.caption, color: colors.danger, marginBottom: 8 },
  quickAddRow: { flexDirection: "row", alignItems: "flex-end" },
  quickAddButton: { marginBottom: 16, marginLeft: 10, minWidth: 80 },
  saveButton: { marginTop: 12 },
  manualToggle: { alignSelf: "flex-start", marginTop: -8, marginBottom: 16 },
  manualToggleText: { ...typography.caption, color: colors.primaryPink }
});
