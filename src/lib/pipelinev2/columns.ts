// Column registry + per-tab localStorage config for the Pipeline v2 table.
// Adapted from ZTC's table-columns.ts pattern; column keys map to Lumina's
// finance_applications fields. Storage key is namespaced to avoid any collision.

export type ColumnWidth = 'narrow' | 'normal' | 'wide' | 'xwide';

export interface TableColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  defaultWidth: ColumnWidth;
  align?: 'left' | 'right';
  wrap?: boolean;
}

export const TABLE_COLUMNS: TableColumnDef[] = [
  { key: 'applicant',      label: 'Applicant',      defaultVisible: true,  defaultWidth: 'wide', wrap: true },
  { key: 'status',         label: 'Finance Status', defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'client_status',  label: 'Client Status',  defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'internal',       label: 'Notes',          defaultVisible: true,  defaultWidth: 'wide', wrap: true },
  { key: 'phone',          label: 'Phone',          defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'email',          label: 'Email',          defaultVisible: false, defaultWidth: 'wide', wrap: true },
  { key: 'id_number',      label: 'ID Number',      defaultVisible: false, defaultWidth: 'normal' },
  { key: 'vehicle',        label: 'Vehicle',        defaultVisible: true,  defaultWidth: 'wide', wrap: true },
  { key: 'bank',           label: 'Bank',           defaultVisible: false, defaultWidth: 'normal' },
  { key: 'gross',          label: 'Gross',          defaultVisible: false, defaultWidth: 'narrow', align: 'right' },
  { key: 'net',            label: 'Net Income',     defaultVisible: false, defaultWidth: 'narrow', align: 'right' },
  { key: 'deposit',        label: 'Deposit',        defaultVisible: false, defaultWidth: 'narrow', align: 'right' },
  { key: 'fni',            label: 'F&I',            defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'rep',            label: 'Rep',            defaultVisible: false, defaultWidth: 'normal' },
  { key: 'bank_reference', label: 'Bank Ref',       defaultVisible: false, defaultWidth: 'normal' },
  { key: 'deal_type',      label: 'Deal Type',      defaultVisible: false, defaultWidth: 'narrow' },
  { key: 'source',         label: 'Source',         defaultVisible: true,  defaultWidth: 'narrow' },
  { key: 'created',        label: 'Date',           defaultVisible: true,  defaultWidth: 'normal' },
  // Finance-preset columns (redesign P3). Rendered by the page's renderExtraCell —
  // default-hidden everywhere else, so Pipeline v2's defaults are unchanged (they
  // appear in its ColumnsPicker as opt-ins; without a page renderer they show "—").
  { key: 'docs',           label: 'Docs',           defaultVisible: false, defaultWidth: 'narrow' },
  { key: 'age',            label: 'Age',            defaultVisible: false, defaultWidth: 'narrow' },
  { key: 'credit',         label: 'Credit Check',   defaultVisible: false, defaultWidth: 'wide' },
  { key: 'actions',        label: 'Actions',        defaultVisible: false, defaultWidth: 'normal', align: 'right' },
];

// Per-lane default visible columns. The 'internal' (latest note) column is
// default-visible everywhere so the Notes column isn't a wall of "—". Each lane
// then surfaces the columns that are usually populated for that stage; users can
// still hide/show any column via ColumnsPicker (these are only the DEFAULTS).
// Lanes omitted here fall back to GLOBAL_DEFAULT_VISIBLE.
const GLOBAL_DEFAULT_VISIBLE = TABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);

// Client Status sits right next to Finance Status in EVERY lane (owner rule
// 2026-07-16: "client status must show standard on pipeline").
const LANE_DEFAULT_VISIBLE: Record<string, string[]> = {
  // Fresh leads: who/what + latest note + how to reach them + where they came from.
  intake:      ['applicant', 'status', 'client_status', 'internal', 'phone', 'vehicle', 'source', 'created'],
  // Credit check passed / ready to load: who + how to reach them + F&I owner.
  credit_passed: ['applicant', 'status', 'client_status', 'internal', 'phone', 'vehicle', 'fni', 'source', 'created'],
  // Submitted to banks: add the bank in play.
  submitted:   ['applicant', 'status', 'client_status', 'internal', 'phone', 'vehicle', 'bank', 'fni', 'source', 'created'],
  // Approved/working: bank + F&I owner matter most.
  approved:    ['applicant', 'status', 'client_status', 'internal', 'vehicle', 'bank', 'fni', 'source', 'created'],
  // Validations / contract: bank + F&I + bank ref.
  validations: ['applicant', 'status', 'client_status', 'internal', 'vehicle', 'bank', 'bank_reference', 'fni', 'source', 'created'],
  // Delivered: the win — vehicle + F&I + date.
  delivered:   ['applicant', 'status', 'client_status', 'internal', 'vehicle', 'fni', 'source', 'created'],
  // Declined: keep it lean — reason lives in the note.
  declined:    ['applicant', 'status', 'client_status', 'internal', 'phone', 'source', 'created'],
  // Closed/archived: minimal.
  closed:      ['applicant', 'status', 'client_status', 'internal', 'source', 'created'],
  // The Finance page's table (redesign P3) — mirrors its long-standing hand-rolled
  // column order (Name/Mobile/Status/CREDIT CHECK/Internal/Date/Actions — credit
  // sits CENTER, owner rule 2026-07-15) + the new docs & age chips.
  finance:     ['applicant', 'phone', 'status', 'client_status', 'credit', 'internal', 'docs', 'age', 'created', 'actions'],
};

const KNOWN_KEYS = new Set(TABLE_COLUMNS.map((c) => c.key));
const visibleForTab = (tabKey?: string): string[] => {
  const lane = tabKey ? LANE_DEFAULT_VISIBLE[tabKey] : undefined;
  const list = (lane ?? GLOBAL_DEFAULT_VISIBLE).filter((k) => KNOWN_KEYS.has(k));
  return list.length > 0 ? list : GLOBAL_DEFAULT_VISIBLE;
};

export const WIDTH_MIN: Record<ColumnWidth, string> = {
  narrow: 'min-w-[80px]', normal: 'min-w-[120px]', wide: 'min-w-[180px]', xwide: 'min-w-[260px]',
};
export const WIDTH_MAX: Record<ColumnWidth, string> = {
  narrow: 'max-w-[160px]', normal: 'max-w-[240px]', wide: 'max-w-[320px]', xwide: 'max-w-[480px]',
};

export function columnClass(def: TableColumnDef | undefined, width: ColumnWidth): string {
  const min = WIDTH_MIN[width];
  if (def?.wrap) return `${min} ${WIDTH_MAX[width]} whitespace-normal break-words`;
  return `${min} whitespace-nowrap`;
}

export interface TableConfig {
  visible: string[];
  widths: Record<string, ColumnWidth>;
}

// Bumped v2 → v3 when Client Status joined every lane's defaults (owner rule
// 2026-07-16), so persisted configs re-default and surface the new column.
// Column widths/visibility reset to per-lane defaults on a bump; saved views
// are stored separately and survive.
const STORAGE_KEY = 'lumina.pipelinev2.table.config.v3';
type AllConfigs = Record<string, TableConfig>;

/** Default table config. Pass a lane key for per-lane default-visible columns;
 *  omit it for the global defaults. */
export function defaultConfig(tabKey?: string): TableConfig {
  return {
    visible: visibleForTab(tabKey),
    widths: Object.fromEntries(TABLE_COLUMNS.map((c) => [c.key, c.defaultWidth])),
  };
}

function normalize(cfg: Partial<TableConfig> | undefined, tabKey?: string): TableConfig {
  const def = defaultConfig(tabKey);
  if (!cfg) return def;
  return {
    visible: Array.isArray(cfg.visible) && cfg.visible.length > 0 ? cfg.visible : def.visible,
    widths: { ...def.widths, ...(cfg.widths ?? {}) },
  };
}

function readAll(): AllConfigs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function writeAll(all: AllConfigs) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* ignore quota */ }
}

export const loadConfig = (tabKey: string): TableConfig => normalize(readAll()[tabKey], tabKey);
export function saveConfig(tabKey: string, cfg: TableConfig) {
  const all = readAll(); all[tabKey] = cfg; writeAll(all);
}
export function saveConfigForTabs(tabKeys: string[], cfg: TableConfig) {
  const all = readAll(); for (const k of tabKeys) all[k] = cfg; writeAll(all);
}
