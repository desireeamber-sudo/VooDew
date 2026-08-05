import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";

// Lightweight expand/collapse section used for optional, lower-priority
// form groups (Travelers, Notes on Create/Edit Trip) so a long form reads
// as more compact without hiding anything required. Defaults to expanded
// -- every field inside remains immediately visible and interactable out
// of the box; collapsing is purely an opt-in "tidy this up" affordance for
// the user, never a way the app itself hides required content.
export default function CollapsibleSection({ title, subtitle, defaultExpanded = true, children, testID }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        testID={testID}
        hitSlop={4}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.darkGray} />
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4
  },
  title: { ...typography.cardTitle, fontSize: 15, color: colors.black },
  subtitle: { ...typography.caption, color: colors.darkGray, marginTop: 2 },
  body: { marginTop: 10 }
});
