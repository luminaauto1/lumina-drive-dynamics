import { useState } from 'react';
import { Loader2, Save, RotateCcw, Check, Info } from 'lucide-react';
import { hexTint, readableTextOn } from '@/lib/pipelinev2/color';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  usePipelineLaneOverrides,
  useUpsertPipelineLane,
  mergePipelineLanes,
  type EffectivePipelineLane,
} from '@/hooks/usePipelineLanes';

// HEX colour presets the admin can pick per lane (mirrors the StatusEditModal
// swatch UX, but stores a HEX string so the Tailwind JIT can never purge a
// dynamic class — the lane accent is applied via inline style). Values are the
// Tailwind palette hexes matching the lanes' default `accent` text classes.
const LANE_COLOR_PRESETS: { label: string; hex: string }[] = [
  { label: 'Slate', hex: '#94a3b8' },
  { label: 'Blue', hex: '#3b82f6' },
  { label: 'Sky', hex: '#0ea5e9' },
  { label: 'Cyan', hex: '#06b6d4' },
  { label: 'Teal', hex: '#14b8a6' },
  { label: 'Green', hex: '#22c55e' },
  { label: 'Amber', hex: '#f59e0b' },
  { label: 'Orange', hex: '#f97316' },
  { label: 'Red', hex: '#ef4444' },
  { label: 'Rose', hex: '#f43f5e' },
  { label: 'Purple', hex: '#a855f7' },
  { label: 'Indigo', hex: '#6366f1' },
];

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const normalizeHex = (v: string) => v.trim();
const isValidHex = (v: string) => HEX_RE.test(v.trim());

// One editable lane row: key (read-only) + label input + colour picker. Saves to
// pipeline_lane_overrides. Empty label => stored NULL (falls back to the
// hardcoded default); empty/invalid colour => NULL (falls back to the lane's
// default `accent` Tailwind class).
const LaneRow = ({ lane }: { lane: EffectivePipelineLane }) => {
  const upsert = useUpsertPipelineLane();
  // Effective values seed the inputs so a no-op save can't wipe a default.
  const [label, setLabel] = useState(lane.label);
  // `lane.color` is the override hex (undefined when none) — start empty when
  // unset so the swatch row shows "using default accent".
  const [color, setColor] = useState<string>(lane.color ?? '');

  const trimmedLabel = label.trim();
  const trimmedColor = normalizeHex(color);
  const colorValid = !trimmedColor || isValidHex(trimmedColor);
  // 'all' is a view-all pseudo-lane — colour is optional/cosmetic there.
  const isAll = lane.key === 'all';

  const save = async () => {
    if (!colorValid) return;
    await upsert.mutateAsync({
      lane_key: lane.key,
      // Empty => NULL so the hardcoded default label is used (reversible).
      label: trimmedLabel ? trimmedLabel : null,
      // Empty/invalid => NULL so the default `accent` class is used.
      color: trimmedColor && isValidHex(trimmedColor) ? trimmedColor : null,
    });
  };

  // Reset this row's editor to "use defaults" (clears both fields). Persisting
  // requires Save; this only resets the local inputs to the empty/default state.
  const resetToDefault = () => {
    setLabel('');
    setColor('');
  };

  // Whether a valid user hex override is in effect (vs. the lane's own default).
  const hasOverride = !!trimmedColor && isValidHex(trimmedColor);
  // The colour actually shown in the preview chip/underline. Precedence mirrors
  // PipelineTabNav exactly: chosen hex > the lane's semantic defaultColor > gold.
  const effectiveColor = hasOverride ? trimmedColor : (lane.defaultColor || '');
  const previewColor = effectiveColor || 'hsl(var(--desk-accent))';
  const previewTint = effectiveColor ? hexTint(effectiveColor) : null;

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {lane.key}
        </code>
        {/* Live preview: the active-tab caption + translucent lane tint + accent
            underline (2px border + 1px inset shadow) + count chip — mirrors the
            active treatment in PipelineTabNav exactly. */}
        <span
          className={
            'inline-flex items-center gap-2 rounded-t-md border-b-2 px-2.5 py-1 text-sm font-semibold text-foreground' +
            (previewTint ? '' : ' bg-[hsl(var(--desk-accent)/0.12)]')
          }
          style={{
            borderBottomColor: previewColor,
            boxShadow: `inset 0 -1px 0 ${previewColor}`,
            ...(previewTint ? { backgroundColor: previewTint } : null),
          }}
        >
          {trimmedLabel || lane.label}
          {/* Count chip: filled with the effective lane colour (text colour computed
              from the hex via luminance); falls back to the `desk-accent-fill`
              utility only when a lane has no colour at all. Matches PipelineTabNav. */}
          <span
            className={
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ' +
              (effectiveColor ? '' : 'desk-accent-fill')
            }
            style={effectiveColor ? { backgroundColor: effectiveColor, color: readableTextOn(effectiveColor) } : undefined}
          >
            0
          </span>
        </span>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-sm">Tab name</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={lane.label}
          aria-label={`${lane.key} lane name`}
        />
      </div>

      {/* Colour */}
      <div className="space-y-1.5">
        <Label className="text-sm">
          Accent colour{isAll && <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>}
        </Label>
        <div className="flex flex-wrap gap-2">
          {LANE_COLOR_PRESETS.map((p) => {
            const selected = trimmedColor.toLowerCase() === p.hex.toLowerCase();
            return (
              <button
                key={p.hex}
                type="button"
                onClick={() => setColor(p.hex)}
                title={`${p.label} (${p.hex})`}
                aria-label={`${p.label} accent`}
                className={
                  'relative h-7 w-7 rounded-md border border-border transition ' +
                  (selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'hover:scale-110')
                }
                style={{ backgroundColor: p.hex }}
              >
                {selected && (
                  <Check
                    className="absolute inset-0 m-auto h-4 w-4 drop-shadow"
                    style={{ color: readableTextOn(p.hex) }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#3b82f6 — or pick a swatch"
            aria-label={`${lane.key} accent hex`}
            className={'h-8 w-40 font-mono text-sm ' + (!colorValid ? 'border-destructive' : '')}
          />
          {trimmedColor && (
            <span
              className="h-6 w-6 shrink-0 rounded-md border border-border"
              style={{ backgroundColor: colorValid ? trimmedColor : 'transparent' }}
              aria-hidden
            />
          )}
          <span className="text-[11px] text-muted-foreground">
            {color.trim() === '' ? `Empty = this lane's default (${lane.defaultColor}).` : colorValid ? '' : 'Enter a hex like #3b82f6.'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={resetToDefault}>
          <RotateCcw className="h-3.5 w-3.5" /> Use default
        </Button>
        <Button type="button" size="sm" className="gap-1.5" onClick={save} disabled={upsert.isPending || !colorValid}>
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </Button>
      </div>
    </div>
  );
};

/**
 * Pipeline Lanes editor — rename + recolour the Pipeline v2 lane tabs.
 *
 * Lists every lane (PIPELINE_TABS, including the 'all' pseudo-lane — its label is
 * editable, colour optional). Each lane's per-lane status ROUTING (statuses[]) is
 * hardcoded in src/lib/pipelinev2/tabs.ts and is intentionally NOT shown/editable
 * here, so users can never break which applications land in a lane. Saves to
 * pipeline_lane_overrides; empty/missing overrides => the hardcoded defaults.
 */
export default function PipelineLanesTab() {
  const { data: overrides = [], isLoading } = usePipelineLaneOverrides();
  const lanes = mergePipelineLanes(overrides);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Rename a lane and pick its accent colour (the active tab underline + count badge). Which applications appear in
          each lane is fixed by their status and can't be changed here. Leave a field blank to use the built-in default.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading lanes…
        </div>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {/* key+statuses come from the hardcoded default; only label/colour are
              seeded from overrides, so each row is keyed by the stable lane key. */}
          {lanes.map((lane) => (
            <LaneRow key={lane.key} lane={lane} />
          ))}
        </div>
      )}
    </div>
  );
}
