import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { colors, radii } from "@/lib/theme";
import type { PipelineStage } from "@/types/domain";

interface StageTabsProps {
  stages: PipelineStage[];
  activeStageId: string | null;
  counts: Map<string, number>;
  onChange: (stageId: string | null) => void;
}

export function StageTabs({ stages, activeStageId, counts, onChange }: StageTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <StageChip
        active={!activeStageId}
        label="Todos"
        count={[...counts.values()].reduce((sum, count) => sum + count, 0)}
        onPress={() => onChange(null)}
      />
      {stages.map((stage) => (
        <StageChip
          key={stage.id}
          active={activeStageId === stage.id}
          label={stage.name}
          count={counts.get(stage.id) || 0}
          color={stage.color}
          onPress={() => onChange(stage.id)}
        />
      ))}
    </ScrollView>
  );
}

function StageChip({
  active,
  label,
  count,
  color,
  onPress
}: {
  active: boolean;
  label: string;
  count: number;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.active, color ? { borderColor: color } : null]}
    >
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
      <Text style={[styles.count, active && styles.activeLabel]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
    paddingBottom: 8
  },
  chip: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 13
  },
  active: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  count: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  activeLabel: {
    color: "#fff"
  }
});
