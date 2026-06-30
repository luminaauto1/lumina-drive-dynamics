import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PIPELINE_TABS, type PipelineTabDef } from '@/lib/pipelinev2/tabs';

// pipeline_lane_overrides isn't in the generated Supabase types yet (mirrors the
// status_overrides pattern — all access goes through the any-cast client).
const db = supabase as any;

/* ---------------- Pipeline lane presentation overrides ----------------
   One row per Pipeline v2 lane id (PIPELINE_TABS.key). ONLY presentation is
   overridable — label (tab caption) + color (HEX accent). The per-lane status
   routing (statuses[]) stays hardcoded in src/lib/pipelinev2/tabs.ts, so a user
   can never break which applications land in a lane. NULL label/color or a
   missing row => fall back to the hardcoded PIPELINE_TABS default (fully
   reversible; empty table === current behaviour). */
export interface PipelineLaneOverride {
  lane_key: string;
  label: string | null;
  color: string | null; // HEX string (e.g. '#3b82f6'); applied via inline style.
}

export const usePipelineLaneOverrides = () =>
  useQuery({
    queryKey: ['pipeline-lane-overrides'],
    queryFn: async (): Promise<PipelineLaneOverride[]> => {
      const { data, error } = await db
        .from('pipeline_lane_overrides')
        .select('lane_key, label, color');
      if (error) throw error;
      return data ?? [];
    },
  });

export const useUpsertPipelineLane = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: Partial<PipelineLaneOverride> & { lane_key: string }) => {
      const { error } = await db
        .from('pipeline_lane_overrides')
        .upsert({ ...o, updated_at: new Date().toISOString() }, { onConflict: 'lane_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-lane-overrides'] });
      toast.success('Lane saved');
    },
    onError: (e: any) => toast.error('Save failed: ' + e.message),
  });
};

/* ---------------- Effective lanes (defaults + overrides) ----------------
   Merges the override rows onto the hardcoded PIPELINE_TABS, producing the
   EFFECTIVE lane list the Pipeline view renders from. The routing-critical
   fields (key + statuses) ALWAYS come from the hardcoded default — overrides
   can ONLY change label + colour, never which slugs land in a lane. */
export interface EffectivePipelineLane extends PipelineTabDef {
  /** Override HEX accent colour, or undefined when none is set. When present the
   *  tab bar applies it via inline style; otherwise the default `accent` class. */
  color?: string;
}

/** Merge override rows onto PIPELINE_TABS. label = override.label || default;
 *  color = override.color (hex) || undefined (=> caller uses the `accent` class).
 *  key + statuses are taken verbatim from the hardcoded default — never overridden. */
export const mergePipelineLanes = (
  overrides: PipelineLaneOverride[],
): EffectivePipelineLane[] => {
  const byKey = new Map(overrides.map((o) => [o.lane_key, o]));
  return PIPELINE_TABS.map((t) => {
    const ov = byKey.get(t.key);
    const label = ov?.label?.trim() ? ov.label.trim() : t.label;
    const color = ov?.color?.trim() ? ov.color.trim() : undefined;
    // key + statuses are NEVER overridden — routing stays hardcoded.
    return { ...t, label, color };
  });
};

/**
 * Effective Pipeline v2 lanes (hardcoded defaults with label/colour overrides
 * applied). Consume this anywhere a lane's label or accent colour is rendered.
 * Empty/missing overrides => byte-for-byte the hardcoded PIPELINE_TABS.
 */
export const usePipelineLanes = (): EffectivePipelineLane[] => {
  const { data: overrides = [] } = usePipelineLaneOverrides();
  return mergePipelineLanes(overrides);
};
