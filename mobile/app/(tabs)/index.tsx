import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { DealActionCard } from "@/components/DealActionCard";
import { LoadingState } from "@/components/LoadingState";
import { MetricTile } from "@/components/MetricTile";
import { Screen } from "@/components/Screen";
import { StageTabs } from "@/components/StageTabs";
import { useAuth } from "@/hooks/useAuth";
import { usePipeline } from "@/hooks/usePipeline";
import { colors, currencyFormat } from "@/lib/theme";
import type { Deal } from "@/types/domain";

export default function PipelineScreen() {
  const { profile, defaultCurrency } = useAuth();
  const {
    deals,
    stages,
    loading,
    error,
    loadPipeline,
    advanceDeal
  } = usePipeline();
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyDealId, setBusyDealId] = useState<string | null>(null);

  useEffect(() => {
    void loadPipeline();
  }, [loadPipeline]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const deal of deals) {
      map.set(deal.stage_id, (map.get(deal.stage_id) || 0) + 1);
    }
    return map;
  }, [deals]);

  const visibleDeals = useMemo(() => {
    const openDeals = deals.filter((deal) => deal.status !== "lost");
    if (!activeStageId) return openDeals;
    return openDeals.filter((deal) => deal.stage_id === activeStageId);
  }, [activeStageId, deals]);

  const totalValue = useMemo(
    () => visibleDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0),
    [visibleDeals]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPipeline();
    setRefreshing(false);
  }, [loadPipeline]);

  const handleAdvance = useCallback(
    async (deal: Deal) => {
      setBusyDealId(deal.id);
      try {
        await advanceDeal(deal);
      } catch (err) {
        Alert.alert(
          "Nao consegui mover",
          err instanceof Error ? err.message : "Tente novamente em instantes."
        );
      } finally {
        setBusyDealId(null);
      }
    },
    [advanceDeal]
  );

  if (loading && !deals.length) {
    return <LoadingState label="Carregando seu pipeline..." />;
  }

  return (
    <Screen>
      <FlatList
        data={visibleDeals}
        keyExtractor={(deal) => deal.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <AppHeader
              eyebrow="WACRM Mobile"
              title={`Ola${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
              subtitle="Leads organizados para agir rapido, sem arrastar um Kanban apertado no celular."
            />

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.metrics}>
              <MetricTile label="Leads" value={String(visibleDeals.length)} icon="people-outline" />
              <MetricTile
                label="Valor"
                value={currencyFormat(totalValue, defaultCurrency)}
                icon="cash-outline"
              />
            </View>

            <StageTabs
              stages={stages}
              activeStageId={activeStageId}
              counts={counts}
              onChange={setActiveStageId}
            />
          </View>
        }
        renderItem={({ item }) => (
          <View style={busyDealId === item.id ? styles.busyCard : null}>
            <DealActionCard
              deal={item}
              stages={stages}
              currency={defaultCurrency}
              onAdvance={handleAdvance}
              onOpenInbox={(conversationId) =>
                router.push({
                  pathname: "/conversation/[id]",
                  params: { id: conversationId }
                })
              }
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={32} color={colors.primary} />
            <Text style={styles.emptyTitle}>Nenhum lead nesta etapa</Text>
            <Text style={styles.emptyText}>Quando um lead novo entrar, ele aparece aqui em tempo real no seu bolso.</Text>
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
    height: 12
  },
  busyCard: {
    opacity: 0.62
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
