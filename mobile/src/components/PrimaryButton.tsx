import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps
} from "react-native";

import { colors, radii } from "@/lib/theme";

interface PrimaryButtonProps extends PressableProps {
  label: string;
  loading?: boolean;
  tone?: "primary" | "secondary" | "ghost" | "danger";
}

export function PrimaryButton({
  label,
  loading = false,
  tone = "primary",
  disabled,
  style,
  ...props
}: PrimaryButtonProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled || loading}
      style={(state) => [
        styles.base,
        styles[tone],
        (disabled || loading) && styles.disabled,
        state.pressed && !disabled ? styles.pressed : null,
        typeof style === "function" ? style(state) : style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone === "primary" ? "#fff" : colors.primary} />
      ) : (
        <Text style={[styles.label, tone !== "primary" && styles.darkLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    paddingHorizontal: 18
  },
  primary: {
    backgroundColor: colors.primary
  },
  secondary: {
    backgroundColor: colors.primarySoft
  },
  ghost: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  danger: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3"
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900"
  },
  darkLabel: {
    color: colors.primary
  },
  disabled: {
    opacity: 0.55
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  }
});
