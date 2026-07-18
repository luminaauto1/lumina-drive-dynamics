// Column registry + per-user localStorage config for the Deal Desk "Deals" table.
// Mirrors the Pipeline v2 pattern (src/lib/pipelinev2/columns.ts) but is scoped to
// the Deal Desk: a single table (no per-lane tabs) with its own storage key so it
// never collides with the pipeline's config. Column keys map to the `Deal` shape
// produced by fromDealRecord.ts.

export type ColumnWidth = 'narrow' | 'normal' | 'wide' | 'xwide';

export interface DealColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  defaultWidth: ColumnWidth;
  align?: 'left' | 'right';
  wrap?: boolean;
}

// Default-visible columns fill the full desktop width (the ledger used to run
// half-empty): client, vehicle, status, natis, delivery, next_action, sale_date,
// sold_price, gp, actions. Everything else is hideable/addable. Order here is
// the default column order.
export const DEAL_COLUMNS: DealColumnDef[] = [
  { key: 'client',      label: 'Client',      defaultVisible: true,  defaultWidth: 'wide', wrap: true },
  { key: 'vehicle',     label: 'Vehicle',     defaultVisible: true,  defaultWidth: 'wide', wrap: true },
  { key: 'vin',         label: 'VIN',         defaultVisible: false, defaultWidth: 'normal' },
  { key: 'stock_no',    label: 'Stock #',     defaultVisible: false, defaultWidth: 'narrow' },
  { key: 'status',      label: 'Status',      defaultVisible: true,  defaultWidth: 'wide', wrap: true },
  { key: 'deal_stage',  label: 'Deal stage',  defaultVisible: false, defaultWidth: 'normal' },
  { key: 'natis',       label: 'Natis',       defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'delivery',    label: 'Delivered',   defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'next_action', label: 'Next action', defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'sale_date',   label: 'Sale date',   defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'sold_price',  label: 'Sold price',  defaultVisible: true,  defaultWidth: 'normal', align: 'right' },
  { key: 'gp',          label: 'GP (ledger)', defaultVisible: true,  defaultWidth: 'normal', align: 'right' },
  { key: 'actions',     label: '',            defaultVisible: true,  defaultWidth: 'narrow', align: 'right' },
];

const DEFAULT_VISIBLE = DEAL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);

export const WIDTH_MIN: Record<ColumnWidth, string> = {
  narrow: 'min-w-[80px]', normal: 'min-w-[120px]', wide: 'min-w-[180px]', xwide: 'min-w-[260px]',
};
export const WIDTH_MAX: Record<ColumnWidth, string> = {
  narrow: 'max-w-[160px]', normal: 'max-w-[240px]', wide: 'max-w-[320px]', xwide: 'max-w-[480px]',
};

export function columnClass(def: DealColumnDef | undefined, width: ColumnWidth): string {
  const min = WIDTH_MIN[width];
  if (def?.wrap) return `${min} ${WIDTH_MAX[width]} whitespace-normal break-words`;
  return `${min} whitespace-nowrap`;
}

export interface DealTableConfig {
  visible: string[];
  widths: Record<string, ColumnWidth>;
}

// Namespaced distinctly from the pipeline's 'lumina.pipelinev2.table.config.v1'.
// v2: full-width redesign added delivery / next_action / actions + sold_price to
// the defaults — key bumped so saved v1 layouts pick up the new default set.
const STORAGE_KEY = 'lumina.dealdesk.table.config.v2';

export function defaultConfig(): DealTableConfig {
  return {
    visible: [...DEFAULT_VISIBLE],
    widths: Object.fromEntries(DEAL_COLUMNS.map((c) => [c.key, c.defaultWidth])),
  };
}

const KNOWN_KEYS = new Set(DEAL_COLUMNS.map((c) => c.key));

function normalize(cfg: Partial<DealTableConfig> | undefined): DealTableConfig {
  const def = defaultConfig();
  if (!cfg) return def;
  const visible = Array.isArray(cfg.visible)
    ? cfg.visible.filter((k) => KNOWN_KEYS.has(k))
    : [];
  return {
    visible: visible.length > 0 ? visible : def.visible,
    widths: { ...def.widths, ...(cfg.widths ?? {}) },
  };
}

export function loadConfig(): DealTableConfig {
  if (typeof window === 'undefined') return defaultConfig();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    return normalize(JSON.parse(raw));
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(cfg: DealTableConfig) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* ignore quota */ }
}
