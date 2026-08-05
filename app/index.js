import React, { useEffect, useState } from "react";
import { View, Text, Image, FlatList, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import { subscribeToTrips } from "../services/tripService";
import TripCard from "../components/TripCard";
import EmptyState from "../components/EmptyState";

// Home / Saved Trips: branding header, upcoming trip cards, and a Create
// Trip action. This is the app's entry screen (app/index.js).
export default function HomeScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToTrips(
      (data) => {
        setTrips(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.logo}
            accessibilityLabel="Trip VooDew logo"
          />
          <View style={styles.brandText}>
            <Text style={styles.brand}>Trip VooDew</Text>
            <Text style={styles.tagline}>Your next event, organized.</Text>
          </View>
        </View>
        <Pressable style={styles.createButton} onPress={() => router.push("/trips/create")}>
          <Ionicons name="add" size={26} color={colors.white} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={colors.primaryPink} size="large" />
      ) : error ? (
        <Text style={styles.errorText}>Couldn't load trips: {error}</Text>
      ) : trips.length === 0 ? (
        <EmptyState
          icon="airplane-outline"
          title="No trips yet"
          subtitle="Create your first trip or event to get a smart checklist, map, expenses, and reminders in one place."
          actionLabel="Create Trip"
          onAction={() => router.push("/trips/create")}
        />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TripCard trip={item} onPress={() => router.push(`/trips/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12
  },
  // flexShrink on brandRow/brandText: "Trip VooDew" is longer than the old
  // "VooDew" -- letting this side of the header shrink (rather than push
  // the fixed-size create button off-screen) is the only layout change
  // needed for the longer title; colors, sizing, and spacing are otherwise
  // unchanged.
  brandRow: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  brandText: { flexShrink: 1 },
  logo: { width: 38, height: 38, borderRadius: 10, marginRight: 10 },
  brand: { ...typography.screenTitle, color: colors.primaryPink },
  tagline: { ...typography.body, color: colors.darkGray, marginTop: 2 },
  createButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryPink,
    alignItems: "center",
    justifyContent: "center"
  },
  loading: { marginTop: 60 },
  errorText: { ...typography.body, color: colors.danger, textAlign: "center", marginTop: 40, paddingHorizontal: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 24 }
});
