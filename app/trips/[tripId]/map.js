import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Linking, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import MapView, { Marker } from "react-native-maps";
import { colors } from "../../../constants/colors";
import { typography } from "../../../constants/typography";
import { subscribeToTrip, updateTrip } from "../../../services/tripService";
import { geocodeAddress } from "../../../services/locationService";
import AppButton from "../../../components/AppButton";
import EmptyState from "../../../components/EmptyState";

// Map screen: shows the trip's venue/destination with a marker on an
// interactive map, plus a directions action for local events and trips.
export default function MapScreen() {
  const { tripId } = useLocalSearchParams();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToTrip(tripId, (data) => {
      setTrip(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [tripId]);

  useEffect(() => {
    // If the trip has an address but no coordinates yet, geocode it once
    // and persist the result so the map doesn't re-geocode every visit.
    if (trip && trip.address && !trip.latitude && !geocoding) {
      setGeocoding(true);
      geocodeAddress(trip.address).then((coords) => {
        if (coords) {
          updateTrip(tripId, { latitude: coords.latitude, longitude: coords.longitude });
        }
        setGeocoding(false);
      });
    }
  }, [trip]);

  function openDirections() {
    if (!trip || !trip.latitude || !trip.longitude) return;
    const destination = `${trip.latitude},${trip.longitude}`;
    const url = Platform.select({
      ios: `maps://?daddr=${destination}`,
      android: `google.navigation:q=${destination}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${destination}`
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`);
    });
  }

  if (loading || geocoding) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryPink} size="large" />
      </View>
    );
  }

  if (!trip || !trip.latitude || !trip.longitude) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="map-outline"
          title="No location set"
          subtitle="Add a venue address from the trip's edit screen to see it here on the map."
        />
      </View>
    );
  }

  const region = {
    latitude: trip.latitude,
    longitude: trip.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region}>
        <Marker
          coordinate={{ latitude: trip.latitude, longitude: trip.longitude }}
          title={trip.venue || trip.title}
          description={trip.address}
        />
      </MapView>
      <View style={styles.detailsCard}>
        <Text style={styles.venue}>{trip.venue || trip.destination || "Destination"}</Text>
        {trip.address ? <Text style={styles.address}>{trip.address}</Text> : null}
        <AppButton title="Get Directions" onPress={openDirections} style={styles.directionsButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.lightGray },
  map: { flex: 1 },
  detailsCard: {
    backgroundColor: colors.white,
    padding: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 4
  },
  venue: { ...typography.sectionTitle, color: colors.black },
  address: { ...typography.body, color: colors.darkGray, marginTop: 4, marginBottom: 12 },
  directionsButton: { marginTop: 4 }
});
