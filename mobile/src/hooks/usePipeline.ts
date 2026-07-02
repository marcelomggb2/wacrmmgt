import { useCallback, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { Deal, PipelineStage } from "@/types/domain";

function normalizeDeal(row: unknown): Deal {
  const deal = row as Deal & {
    contact?: Deal["contact"] | Deal["contact"][];
    stage?: Deal["stage"] | Deal["stage"][];
  };
  const contact = Array.isArray(deal.contact) ? deal.contact[0] ?? null : deal.contact ?? null;
  const stage = Array.isArray(deal.stage) ? deal.stage[0] ?? null : deal.stage ?? null;
  return { ...deal, contact, stage };
}

export function usePipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  );

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stagesRes, dealsRes] = await Promise.all([
        supabase
          .from("pipeline_stages")
          .select("id, pipeline_id, name, position, color")
          .order("position", { ascending: true }),
        supabase
          .from("deals")
          .select(
            "id, account_id, pipeline_id, stage_id, contact_id, conversation_id, title, value, currency, notes, expected_close_date, status, created_at, updated_at, contact:contacts(id, account_id, phone, name, email, company, avatar_url), stage:pipeline_stages(id, pipeline_id, name, position, color)"
          )
          .order("updated_at", { ascending: false })
          .limit(120)
      ]);

      if (stagesRes.error) throw stagesRes.error;
      if (dealsRes.error) throw dealsRes.error;

      setStages((stagesRes.data || []) as PipelineStage[]);
      setDeals((dealsRes.data || []).map(normalizeDeal));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar pipeline");
    } finally {
      setLoading(false);
    }
  }, []);

  const moveDealToStage = useCallback(
    async (deal: Deal, nextStage: PipelineStage) => {
      const previous = deals;
      setDeals((current) =>
        current.map((item) =>
          item.id === deal.id
            ? {
                ...item,
                stage_id: nextStage.id,
                stage: nextStage,
                updated_at: new Date().toISOString()
              }
            : item
        )
      );

      const { error: updateError } = await supabase
        .from("deals")
        .update({
          stage_id: nextStage.id,
          updated_at: new Date().toISOString()
        })
        .eq("id", deal.id);

      if (updateError) {
        setDeals(previous);
        throw updateError;
      }
    },
    [deals]
  );

  const advanceDeal = useCallback(
    async (deal: Deal) => {
      const currentIndex = sortedStages.findIndex((stage) => stage.id === deal.stage_id);
      const nextStage = sortedStages[currentIndex + 1];
      if (!nextStage) return;
      await moveDealToStage(deal, nextStage);
    },
    [moveDealToStage, sortedStages]
  );

  const reopenDeal = useCallback(async (deal: Deal) => {
    const firstStage = sortedStages[0];
    if (!firstStage) return;
    await moveDealToStage(deal, firstStage);
  }, [moveDealToStage, sortedStages]);

  return {
    deals,
    stages: sortedStages,
    loading,
    error,
    loadPipeline,
    moveDealToStage,
    advanceDeal,
    reopenDeal
  };
}
