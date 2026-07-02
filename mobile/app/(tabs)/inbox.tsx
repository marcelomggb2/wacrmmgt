import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { ConversationRow } from "@/components/ConversationRow";
import { LoadingState } from "@/components/LoadingState";
import { MetricTile } from "@/components/MetricTile";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/hooks/useInbox";
import { colors, radii } from "@/lib/theme";

export default function InboxScreen() {
  const { profile } = useAuth();
  const { conversations, loading, error, unreadTotal, refresh } = useConversations(profile?.account_id);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return conversations;
    return conversations.filter((conversation) => {
      const contact = conversation.contact;
      return [
        contact?.name,
        contact?.phone,
        contact?.email,
        conversation.last_message_text,
        conversation.channel_provider
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value);
    });
  }, [conversations, query]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (loading && !conversations.length) {
    return <LoadingState label="Sincronizando inbox..." />;
  }

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <AppHeader
              eyebrow="Inbox ao vivo"
              title="Conversas"
              subtitle="WhatsApp, Instagram e UAZAPI separados por canal, no mesmo fluxo."
            />

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.metrics}>
              <MetricTile label="Conversas" value={String(conversations.length)} icon="chatbubbles-outline" />
              <MetricTile label="Nao lidas" value={String(unreadTotal)} icon="notifications-outline" accent={colors.instagram} />
            </View>

            <View style={styles.search}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar por nome, telefone ou mensagem"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                autoCapitalize="none"
              />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            onPress={() =>
              router.push({
                pathname: "/conversation/[id]",
                params: { id: item.id }
              })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubble-ellipses-outline" size={34} color={colors.primary} />
            <Text style={styles.emptyTitle}>Nada por aqui ainda</Text>
            <Text style={styles.emptyText}>As mensagens que chegarem pelos webhooks aparecem aqui automaticamente.</Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 18,
    paddingBottom: 110
  },
  headerContent: {
    gap: 16,
    marginBottom: 12
  },
  metrics: {
    flexDirection: "row",
    gap: 12
  },
  search: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
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
  separator: {
    height: 10
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 260,
    paddingHorizontal: 24
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  }
});
