import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii } from "@/lib/theme";

export function MetricTile({
  label,
  value,
  icon,
  accent = colors.primary
}: {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  accent?: string;
}) {
  return (
    <View style={[styles.card, { borderTopColor: accent }]}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{label}</Text>
        {icon ? <Ionicons name={icon} size={16} color={accent} /> : null}
      </View>
      <Text numberOfLines={1} style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 82,
    padding: 12,
    borderTopWidth: 3,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  value: {
    marginTop: 7,
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  }
});
