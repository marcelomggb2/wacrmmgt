import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { messageFromError } from "@/lib/errors";
import { colors, radii, shadow } from "@/lib/theme";

export default function LoginScreen() {
  const { signIn, signingIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(messageFromError(err, "Nao foi possivel entrar"));
    }
  }

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={styles.keyboard}
      >
        <View style={styles.card}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>MG</Text>
          </View>
          <Text style={styles.title}>MG Team Mobile</Text>
          <Text style={styles.subtitle}>
            Use o mesmo acesso do WACRM. A sessao fica salva no dispositivo com
            SecureStore e as leituras passam pela RLS do Supabase.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="voce@empresa.com"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              autoComplete="current-password"
              placeholder="Sua senha"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            label="Entrar"
            loading={signingIn}
            disabled={!email || !password}
            onPress={handleSubmit}
            style={styles.submit}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: "center"
  },
  keyboard: {
    flex: 1,
    justifyContent: "center"
  },
  card: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow
  },
  logo: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.primary
  },
  logoText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900"
  },
  title: {
    marginTop: 18,
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0
  },
  subtitle: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21
  },
  field: {
    marginTop: 18,
    gap: 8
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15
  },
  error: {
    marginTop: 14,
    padding: 12,
    overflow: "hidden",
    borderRadius: radii.md,
    backgroundColor: "#fff1f2",
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700"
  },
  submit: {
    marginTop: 18
  }
});
