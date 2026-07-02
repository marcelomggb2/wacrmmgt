import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors } from "@/lib/theme";

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.background
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  }
});
