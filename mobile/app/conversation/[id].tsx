import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingState } from "@/components/LoadingState";
import { MessageBubble } from "@/components/MessageBubble";
import { useConversationMessages } from "@/hooks/useInbox";
import { colors, initials, radii } from "@/lib/theme";

const providerLabel = {
  whatsapp_official: "WhatsApp oficial",
  uazapi: "UAZAPI",
  instagram: "Instagram"
};

let clockSnapshot = Date.now();
let clockTimer: ReturnType<typeof setInterval> | null = null;
const clockListeners = new Set<() => void>();

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      clockSnapshot = Date.now();
      clockListeners.forEach((callback) => callback());
    }, 60_000);
  }

  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

function getClockSnapshot() {
  return clockSnapshot;
}

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const { conversation, messages, loading, sending, error, refresh, sendMessage } =
    useConversationMessages(id);
  const [draft, setDraft] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const clock = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot);

  const contactName = conversation?.contact?.name || conversation?.contact?.phone || "Conversa";
  const provider = conversation?.channel_provider || "whatsapp_official";

  const sessionBadge =
    provider === "uazapi"
      ? { label: "Texto livre", color: colors.primary }
      : !conversation?.last_message_at
        ? { label: "Sem janela recente", color: colors.amber }
        : clock - new Date(conversation.last_message_at).getTime() <= 24 * 60 * 60 * 1000
          ? { label: "Sessao aberta 24h", color: colors.whatsapp }
          : { label: "Requer template", color: colors.amber };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;

    setDraft("");
    try {
      await sendMessage(text);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setDraft(text);
      Alert.alert(
        "Envio nao concluido",
        err instanceof Error ? err.message : "Nao consegui enviar agora."
      );
    }
  }, [draft, sendMessage]);

  if (loading && !messages.length) {
    return <LoadingState label="Abrindo conversa..." />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.page}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(contactName)}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.title}>
            {contactName}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {providerLabel[provider]} · {conversation?.contact?.phone || "sem telefone"}
          </Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: `${sessionBadge.color}18` }]}>
          <View style={[styles.badgeDot, { backgroundColor: sessionBadge.color }]} />
          <Text style={[styles.badgeText, { color: sessionBadge.color }]}>{sessionBadge.label}</Text>
        </View>
        {error ? <Text numberOfLines={1} style={styles.inlineError}>{error}</Text> : null}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => message.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Mensagem"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.input}
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
          >
            <Ionicons name={sending ? "hourglass-outline" : "send"} size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#e9f1ec"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingBottom: 12
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft
  },
  avatarText: {
    color: colors.primary,
    fontWeight: "900"
  },
  headerCopy: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  badgeRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "900"
  },
  inlineError: {
    flex: 1,
    color: colors.danger,
    fontSize: 11,
    fontWeight: "800"
  },
  messages: {
    flexGrow: 1,
    justifyContent: "flex-end",
    padding: 12,
    paddingBottom: 20
  },
  composerWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingTop: 9
  },
  composer: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderRadius: 24,
    backgroundColor: colors.card,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6
  },
  input: {
    flex: 1,
    maxHeight: 112,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 8
  },
  sendButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.primary
  },
  sendButtonDisabled: {
    opacity: 0.42
  }
});
