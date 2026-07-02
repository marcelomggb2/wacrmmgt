import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { colors, radii } from "@/lib/theme";

export default function SettingsScreen() {
  const { profile, account, signOut } = useAuth();
  const { token, status, error, register } = usePushNotifications(profile);
  const [signingOut, setSigningOut] = useState(false);

  async function handleRegisterPush() {
    const nextToken = await register();
    if (nextToken) {
      Alert.alert("Notificacoes ativadas", "Este aparelho ja pode receber alertas de novos leads.");
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        eyebrow="Conta"
        title={profile?.full_name || "Vendedor"}
        subtitle={account?.name || profile?.email || "MG Team"}
      />

      <View style={styles.card}>
        <View style={styles.cardIcon}>
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>Alertas de novos leads</Text>
          <Text style={styles.cardText}>
            Salva o Expo Push Token deste aparelho no Supabase para o worker avisar quando uma conversa ou negócio novo entrar.
          </Text>
          {token ? <Text numberOfLines={1} style={styles.token}>{token}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <PrimaryButton
          label={status === "requesting" ? "Ativando..." : status === "granted" ? "Ativo" : "Ativar"}
          loading={status === "requesting"}
          tone={status === "granted" ? "secondary" : "primary"}
          onPress={handleRegisterPush}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardIcon}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>Sessao segura</Text>
          <Text style={styles.cardText}>
            O app usa Supabase Auth com SecureStore e respeita as mesmas politicas RLS do WACRM web.
          </Text>
        </View>
      </View>

      <Pressable disabled={signingOut} onPress={handleSignOut} style={styles.logout}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>{signingOut ? "Saindo..." : "Sair do app"}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14
  },
  card: {
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16
  },
  cardIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft
  },
  cardCopy: {
    gap: 6
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  cardText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  token: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800"
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800"
  },
  logout: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: "auto",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#fecdd3",
    backgroundColor: "#fff1f2"
  },
  logoutText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "900"
  }
});
