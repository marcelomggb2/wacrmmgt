import { StyleSheet, Text, View } from "react-native";

import { colors, radii, shortTime } from "@/lib/theme";
import type { Message } from "@/types/domain";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const outgoing = message.sender_type === "agent" || message.sender_type === "bot";
  const label = message.content_text || (message.media_url ? `[${message.content_type}]` : "Mensagem sem texto");

  return (
    <View style={[styles.wrap, outgoing ? styles.outgoingWrap : styles.incomingWrap]}>
      <View style={[styles.bubble, outgoing ? styles.outgoing : styles.incoming]}>
        {message.sender_type === "bot" ? <Text style={styles.sender}>Automacao</Text> : null}
        <Text style={styles.text}>{label}</Text>
        <Text style={styles.time}>{shortTime(message.created_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginVertical: 4
  },
  incomingWrap: {
    alignItems: "flex-start"
  },
  outgoingWrap: {
    alignItems: "flex-end"
  },
  bubble: {
    maxWidth: "82%",
    minWidth: 84,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1
  },
  incoming: {
    borderTopLeftRadius: radii.sm,
    borderColor: colors.border,
    backgroundColor: colors.bubbleCustomer
  },
  outgoing: {
    borderTopRightRadius: radii.sm,
    borderColor: "#c7f0bf",
    backgroundColor: colors.bubbleAgent
  },
  sender: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  text: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21
  },
  time: {
    alignSelf: "flex-end",
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700"
  }
});
