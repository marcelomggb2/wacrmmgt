import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { crmBaseUrl, supabase } from "@/lib/supabase";
import { colors, radii } from "@/lib/theme";
import type { ExternalInboxChannel } from "@/types/domain";

const providerCopy = {
  instagram: {
    title: "Instagram Inbox",
    text: "Conexao preparada para Meta Developers: recebe comentarios, DMs e leads quando o webhook estiver ativo.",
    icon: "logo-instagram",
    color: colors.instagram
  },
  uazapi: {
    title: "UAZAPI",
    text: "Canal nao oficial separado do WhatsApp Cloud API. Ideal para operacao paralela sem tocar nas conexoes Meta.",
    icon: "chatbubbles-outline",
    color: colors.primary
  }
} as const;

export default function ConnectionsScreen() {
  const { profile } = useAuth();
  const [channels, setChannels] = useState<ExternalInboxChannel[]>([]);
  const [officialCount, setOfficialCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.account_id) return;
    setLoading(true);
    setError(null);
    try {
      const [externalRes, officialRes] = await Promise.all([
        supabase
          .from("external_inbox_channels")
          .select("id, account_id, provider, label, status, display_identifier, connected_at, last_error")
          .eq("account_id", profile.account_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("whatsapp_config")
          .select("id", { count: "exact", head: true })
          .eq("account_id", profile.account_id)
      ]);

      if (externalRes.error) throw externalRes.error;
      if (officialRes.error) throw officialRes.error;

      setChannels((externalRes.data || []) as ExternalInboxChannel[]);
      setOfficialCount(officialRes.count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar canais");
    } finally {
      setLoading(false);
    }
  }, [profile?.account_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(
    () => ({
      instagram: channels.filter((channel) => channel.provider === "instagram"),
      uazapi: channels.filter((channel) => channel.provider === "uazapi")
    }),
    [channels]
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading && !channels.length) {
    return <LoadingState label="Lendo canais..." />;
  }

  return (
    <Screen scroll={false}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader
          eyebrow="Canais"
          title="Inbox conectado"
          subtitle="O mobile mostra o estado dos canais. Configuracao sensivel continua no CRM web."
        />

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.officialCard}>
          <View style={styles.officialIcon}>
            <Ionicons name="logo-whatsapp" size={22} color={colors.whatsapp} />
          </View>
          <View style={styles.channelCopy}>
            <Text style={styles.channelTitle}>WhatsApp Cloud API oficial</Text>
            <Text style={styles.channelText}>
              {officialCount} numero(s) Meta conectados no WACRM. Eles permanecem separados de UAZAPI e Instagram.
            </Text>
          </View>
        </View>

        <ProviderBlock provider="instagram" channels={grouped.instagram} />
        <ProviderBlock provider="uazapi" channels={grouped.uazapi} />

        <Pressable
          onPress={() => Linking.openURL(`${crmBaseUrl}/settings`)}
          style={styles.openCrm}
        >
          <Text style={styles.openCrmText}>Abrir configuracoes no CRM web</Text>
          <Ionicons name="open-outline" size={18} color="#fff" />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function ProviderBlock({
  provider,
  channels
}: {
  provider: keyof typeof providerCopy;
  channels: ExternalInboxChannel[];
}) {
  const copy = providerCopy[provider];

  return (
    <View style={styles.providerBlock}>
      <View style={styles.providerHeader}>
        <View style={[styles.providerIcon, { backgroundColor: `${copy.color}18` }]}>
          <Ionicons name={copy.icon as keyof typeof Ionicons.glyphMap} size={21} color={copy.color} />
        </View>
        <View style={styles.channelCopy}>
          <Text style={styles.channelTitle}>{copy.title}</Text>
          <Text style={styles.channelText}>{copy.text}</Text>
        </View>
      </View>

      {channels.length ? (
        channels.map((channel) => (
          <View key={channel.id} style={styles.channelRow}>
            <View>
              <Text style={styles.rowTitle}>{channel.label || channel.display_identifier || copy.title}</Text>
              <Text style={styles.rowText}>{channel.display_identifier || "sem identificador publico"}</Text>
            </View>
            <StatusPill status={channel.status} />
          </View>
        ))
      ) : (
        <Text style={styles.emptyProvider}>Nenhum canal {copy.title.toLowerCase()} salvo ainda.</Text>
      )}
    </View>
  );
}

function StatusPill({ status }: { status: ExternalInboxChannel["status"] }) {
  const color =
    status === "connected"
      ? colors.whatsapp
      : status === "error"
        ? colors.danger
        : status === "setup_pending"
          ? colors.amber
          : colors.muted;

  return (
    <View style={[styles.status, { backgroundColor: `${color}18` }]}>
      <Text style={[styles.statusText, { color }]}>{status.replace("_", " ")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 110
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fecdd3",
    backgroundColor: "#fff1f2",
    padding: 12
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800"
  },
  officialCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16
  },
  officialIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: "#dcfce7"
  },
  providerBlock: {
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16
  },
  providerHeader: {
    flexDirection: "row",
    gap: 12
  },
  providerIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md
  },
  channelCopy: {
    flex: 1,
    gap: 5
  },
  channelTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  channelText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 16,
    backgroundColor: colors.cardMuted,
    padding: 12
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  rowText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  status: {
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  emptyProvider: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  openCrm: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary
  },
  openCrmText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900"
  }
});
