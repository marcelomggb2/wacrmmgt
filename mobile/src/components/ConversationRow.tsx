import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, initials, radii, relativeTime } from "@/lib/theme";
import type { Conversation } from "@/types/domain";

interface ConversationRowProps {
  conversation: Conversation;
  onPress: () => void;
}

const providerMeta = {
  whatsapp_official: { label: "WhatsApp", color: colors.whatsapp, icon: "logo-whatsapp" },
  uazapi: { label: "UAZAPI", color: colors.primary, icon: "chatbubbles-outline" },
  instagram: { label: "Instagram", color: colors.instagram, icon: "logo-instagram" }
} as const;

export function ConversationRow({ conversation, onPress }: ConversationRowProps) {
  const contactName = conversation.contact?.name || conversation.contact?.phone || "Contato";
  const provider = conversation.channel_provider || "whatsapp_official";
  const meta = providerMeta[provider] || providerMeta.whatsapp_official;
  const unread = Number(conversation.unread_count || 0);

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(contactName)}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.top}>
          <Text numberOfLines={1} style={styles.name}>
            {contactName}
          </Text>
          <Text style={styles.time}>{relativeTime(conversation.last_message_at)}</Text>
        </View>
        <Text numberOfLines={2} style={styles.preview}>
          {conversation.last_message_text || "Sem mensagens ainda"}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.provider, { backgroundColor: `${meta.color}18` }]}>
            <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={12} color={meta.color} />
            <Text style={[styles.providerText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {unread > 0 ? (
            <View style={styles.unread}>
              <Text style={styles.unreadText}>{unread > 99 ? "99+" : unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  avatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft
  },
  avatarText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900"
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 6
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  time: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  preview: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 18
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  provider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  providerText: {
    fontSize: 11,
    fontWeight: "900"
  },
  unread: {
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.whatsapp
  },
  unreadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900"
  }
});
