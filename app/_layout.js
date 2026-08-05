import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../constants/colors";
import * as Notifications from "expo-notifications";

// Root stack for the whole app. Every trip-specific screen (dashboard,
// checklist, links, map, expenses, travelers) lives under app/trips/[tripId]
// and inherits this header styling.
export default function RootLayout() {
  useEffect(() => {
    // Foreground notification behavior is configured once, here, so it
    // applies no matter which screen is active when a reminder fires.
    const sub = Notifications.addNotificationReceivedListener(() => {});
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.black,
          headerTitleStyle: { fontWeight: "700" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.lightGray }
        }}
      >
        <Stack.Screen name="index" options={{ title: "Trip VooDew" }} />
        <Stack.Screen name="trips/create" options={{ title: "Create Trip" }} />
        <Stack.Screen name="trips/[tripId]/index" options={{ title: "Trip Dashboard" }} />
        <Stack.Screen name="trips/[tripId]/checklist" options={{ title: "Checklist" }} />
        <Stack.Screen name="trips/[tripId]/links" options={{ title: "Reservations & Links" }} />
        <Stack.Screen name="trips/[tripId]/map" options={{ title: "Map" }} />
        <Stack.Screen name="trips/[tripId]/expenses" options={{ title: "Expenses" }} />
        <Stack.Screen name="trips/[tripId]/travelers" options={{ title: "Travelers" }} />
        <Stack.Screen name="trips/[tripId]/reminders" options={{ title: "Reminders" }} />
      </Stack>
    </>
  );
}
