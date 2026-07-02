import { useMemo } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { colors, currencyFormat, radii, relativeTime, shadow } from "@/lib/theme";
import type { Deal, PipelineStage } from "@/types/domain";

interface DealActionCardProps {
  deal: Deal;
  stages: PipelineStage[];
  currency: string;
  onAdvance: (deal: Deal) => void;
  onOpenInbox?: (conversationId: string) => void;
}

export function DealActionCard({
  deal,
  stages,
  currency,
  onAdvance,
  onOpenInbox
}: DealActionCardProps) {
  const currentIndex = stages.findIndex((stage) => stage.id === deal.stage_id);
  const currentStage = stages[currentIndex] || deal.stage;
  const nextStage = stages[currentIndex + 1];
  const contactName = deal.contact?.name || deal.contact?.phone || "Lead sem nome";

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 22 && Math.abs(gesture.dy) < 14,
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx > 70 && nextStage) onAdvance(deal);
      }
      }).panHandlers,
    [deal, nextStage, onAdvance]
  );

  const tags = useMemo(() => {
    const text = `${deal.title} ${deal.notes || ""} ${currentStage?.name || ""}`.toLowerCase();
    return [
      /instagram|insta|reels|integrar/.test(text) ? "Instagram" : null,
      /contrato|pagamento|proposta|fech/.test(text) ? "Fechamento" : null,
      Number(deal.value || 0) > 0 ? "Valor" : null
    ].filter(Boolean) as string[];
  }, [currentStage?.name, deal.notes, deal.title, deal.value]);

  return (
    <View style={styles.card} {...panHandlers}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <View style={[styles.stageDot, { backgroundColor: currentStage?.color || colors.primary }]} />
          <View style={styles.titleWrap}>
            <Text numberOfLines={1} style={styles.title}>
              {deal.title || contactName}
            </Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {contactName}
            </Text>
          </View>
        </View>
        <Text style={styles.value}>{currencyFormat(Number(deal.value || 0), deal.currency || currency)}</Text>
      </View>

      <Text numberOfLines={2} style={styles.preview}>
        {deal.notes || deal.contact?.company || "Sem anotacao. Toque para mover ou abrir o atendimento."}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.stage}>{currentStage?.name || "Sem etapa"}</Text>
        <Text style={styles.time}>{relativeTime(deal.updated_at)}</Text>
      </View>

      {tags.length ? (
        <View style={styles.tags}>
          {tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              {tag}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          label={nextStage ? `Mover para ${nextStage.name}` : "Ultima etapa"}
          tone={nextStage ? "secondary" : "ghost"}
          disabled={!nextStage}
          onPress={() => nextStage && onAdvance(deal)}
          style={styles.actionButton}
        />
        {deal.conversation_id ? (
          <Pressable
            onPress={() => onOpenInbox?.(deal.conversation_id!)}
            style={styles.inboxButton}
          >
            <Text style={styles.inboxButtonText}>Inbox</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadow
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  stageDot: {
    width: 10,
    height: 42,
    borderRadius: radii.pill
  },
  titleWrap: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  value: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900"
  },
  preview: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 19
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  stage: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  time: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  tag: {
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.cardMuted,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900"
  },
  actions: {
    flexDirection: "row",
    gap: 8
  },
  actionButton: {
    flex: 1
  },
  inboxButton: {
    minWidth: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  inboxButtonText: {
    color: colors.primary,
    fontWeight: "900"
  }
});
