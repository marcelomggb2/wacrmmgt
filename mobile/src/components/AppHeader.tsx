import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { colors, radii } from "@/lib/theme";

interface AppHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function AppHeader({ eyebrow, title, subtitle, right }: AppHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>MG</Text>
      </View>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18
  },
  logo: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: colors.primary
  },
  logoText: {
    color: "#fff",
    fontWeight: "900"
  },
  copy: {
    flex: 1
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  }
});
