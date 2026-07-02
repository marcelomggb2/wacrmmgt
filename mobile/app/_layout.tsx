import * as Notifications from "expo-notifications";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/hooks/useAuth";

Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true
    }) as Notifications.NotificationBehavior
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Slot />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
