import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/domain";

function platformName() {
  if (Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web") {
    return Platform.OS;
  }
  return "unknown";
}

function expoProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    undefined
  );
}

export function usePushNotifications(profile?: Profile | null) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async () => {
    setStatus("requesting");
    setError(null);

    try {
      if (!profile?.account_id) {
        throw new Error("Perfil sem conta vinculada.");
      }

      if (!Device.isDevice) {
        throw new Error("Push notifications precisam de um dispositivo fisico.");
      }

      const current = await Notifications.getPermissionsAsync();
      const permission =
        current.status === "granted"
          ? current
          : await Notifications.requestPermissionsAsync();

      if (permission.status !== "granted") {
        setStatus("denied");
        return null;
      }

      const projectId = expoProjectId();
      const pushToken = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("Sessao nao encontrada.");
      }

      const { error: saveError } = await supabase
        .from("mobile_push_tokens")
        .upsert(
          {
            account_id: profile.account_id,
            user_id: user.id,
            expo_push_token: pushToken.data,
            platform: platformName(),
            device_name: Device.deviceName || null,
            device_id: Device.osBuildId || null,
            enabled: true,
            last_seen_at: new Date().toISOString()
          },
          { onConflict: "user_id,expo_push_token" }
        );

      if (saveError) throw saveError;

      setToken(pushToken.data);
      setStatus("granted");
      return pushToken.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao ativar push";
      setError(message);
      setStatus("error");
      return null;
    }
  }, [profile?.account_id]);

  return { token, status, error, register };
}
