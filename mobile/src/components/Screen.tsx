import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";

import { colors } from "@/lib/theme";

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}

export function Screen({ children, scroll = true, contentStyle }: ScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, contentStyle]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    flexGrow: 1,
    padding: 18
  }
});
