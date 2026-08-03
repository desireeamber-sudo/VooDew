import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import { searchPlaces } from "../services/placesService";

const DEBOUNCE_MS = 450;
const MIN_QUERY_LENGTH = 2;

// Google Places venue/location search field.
//
// Two visual states:
//  - No selection yet: a search box + live results list as the user types
//    (debounced), with loading/error/no-results states and a "enter
//    manually instead" fallback link.
//  - A place is selected (`value` is set): collapses into a compact
//    summary card (name + formatted address) with a "Change" action --
//    this replaces having separate Venue and Address inputs on screen.
export default function PlaceSearchField({
  label,
  value, // { name, formattedAddress } or null/undefined
  onSelect, // (place) => void -- place is the normalized object from placesService
  onClear, // () => void
  onManualEntry, // optional () => void -- shows a "enter manually" fallback link
  placeholder = "Search for a venue or address"
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError(null);
      setSearched(false);
      return undefined;
    }

    setLoading(true);
    setError(null);
    const thisRequestId = ++requestIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const places = await searchPlaces(query);
        if (thisRequestId !== requestIdRef.current) return; // superseded by a newer keystroke
        setResults(places);
        setSearched(true);
      } catch (e) {
        if (thisRequestId !== requestIdRef.current) return;
        setError(e.message || "Couldn't search right now.");
        setResults([]);
      } finally {
        if (thisRequestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handleSelect(place) {
    onSelect(place);
    setQuery("");
    setResults([]);
    setSearched(false);
  }

  if (value) {
    return (
      <View style={styles.wrapper}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.summaryCard}>
          <Ionicons name="location" size={18} color={colors.primaryPink} style={styles.summaryIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryName} numberOfLines={1}>
              {value.name || "Selected location"}
            </Text>
            {value.formattedAddress ? (
              <Text style={styles.summaryAddress} numberOfLines={2}>
                {value.formattedAddress}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onClear} hitSlop={8}>
            <Text style={styles.changeText}>Change</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.darkGray} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.darkGray}
          style={styles.searchInput}
        />
        {loading ? <ActivityIndicator size="small" color={colors.primaryPink} /> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !error && searched && results.length === 0 ? (
        <Text style={styles.hint}>No matches found. Try a different search, or enter the location manually.</Text>
      ) : null}

      {results.length > 0 ? (
        <View style={styles.resultsSection}>
          <Text style={styles.resultsHeading}>Select a location.</Text>
          {results.map((place, index) => (
            <Pressable
              key={place.placeId || `${place.formattedAddress}-${index}`}
              onPress={() => handleSelect(place)}
              style={({ pressed }) => [styles.resultCard, pressed && styles.resultCardPressed]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {place.name}
                </Text>
                <Text style={styles.resultAddress} numberOfLines={2}>
                  {place.formattedAddress}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.primaryPink} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {onManualEntry ? (
        <Pressable onPress={onManualEntry} hitSlop={8} style={styles.manualLink}>
          <Text style={styles.manualLinkText}>Enter location manually instead</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    ...typography.caption,
    color: colors.darkGray,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, ...typography.body, color: colors.black, paddingVertical: 2 },
  error: { ...typography.caption, color: colors.danger, marginTop: 6 },
  hint: { ...typography.caption, color: colors.darkGray, marginTop: 6 },
  resultsSection: { marginTop: 12 },
  resultsHeading: {
    ...typography.caption,
    color: colors.darkGray,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  resultCardPressed: { backgroundColor: colors.softPink, borderColor: colors.primaryPink },
  resultName: { ...typography.body, color: colors.black, fontWeight: "600" },
  resultAddress: { ...typography.caption, color: colors.darkGray, marginTop: 2 },
  manualLink: { marginTop: 8, alignSelf: "flex-start" },
  manualLinkText: { ...typography.caption, color: colors.primaryPink },
  summaryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.softPink,
    borderRadius: 12,
    padding: 12
  },
  summaryIcon: { marginTop: 2, marginRight: 8 },
  summaryName: { ...typography.body, color: colors.black, fontWeight: "600" },
  summaryAddress: { ...typography.caption, color: colors.darkGray, marginTop: 2 },
  changeText: { ...typography.caption, color: colors.primaryPink, marginLeft: 8 }
});
