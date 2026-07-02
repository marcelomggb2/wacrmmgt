import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  const { loading, user } = useAuth();

  if (loading) return <LoadingState label="Preparando sua area mobile..." />;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 74,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          paddingBottom: 12,
          paddingTop: 8
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800"
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Pipeline",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="albums-outline" color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: "Canais",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="git-network-outline" color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Conta",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size} />
          )
        }}
      />
    </Tabs>
  );
}
