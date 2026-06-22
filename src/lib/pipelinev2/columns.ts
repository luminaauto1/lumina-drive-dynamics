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
  { key: 'status',         label: 'Status',         defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'internal',       label: 'Internal Note',  defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'phone',          label: 'Phone',          defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'email',          label: 'Email',          defaultVisible: false, defaultWidth: 'wide', wrap: true },
  { key: 'id_number',      label: 'ID Number',      defaultVisible: false, defaultWidth: 'normal' },
  { key: 'vehicle',        label: 'Vehicle',        defaultVisible: true,  defaultWidth: 'wide', wrap: true },
  { key: 'bank',           label: 'Bank',           defaultVisible: false, defaultWidth: 'normal' },
  { key: 'gross',          label: 'Gross',          defaultVisible: false, defaultWidth: 'narrow', align: 'right' },
  { key: 'deposit',        label: 'Deposit',        defaultVisible: false, defaultWidth: 'narrow', align: 'right' },
  { key: 'fni',            label: 'F&I',            defaultVisible: true,  defaultWidth: 'normal' },
  { key: 'rep',            label: 'Rep',            defaultVisible: false, defaultWidth: 'normal' },
  { key: 'bank_reference', label: 'Bank Ref',       defaultVisible: false, defaultWidth: 'normal' },
  { key: 'deal_type',      label: 'Deal Type',      defaultVisible: false, defaultWidth: 'narrow' },
  { key: 'created',        label: 'Date',           defaultVisible: true,  defaultWidth: 'normal' },
];

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

const STORAGE_KEY = 'lumina.pipelinev2.table.config.v1';
type AllConfigs = Record<string, TableConfig>;

export function defaultConfig(): TableConfig {
  return {
    visible: TABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key),
    widths: Object.fromEntries(TABLE_COLUMNS.map((c) => [c.key, c.defaultWidth])),
  };
}

function normalize(cfg: Partial<TableConfig> | undefined): TableConfig {
  const def = defaultConfig();
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

export const loadConfig = (tabKey: string): TableConfig => normalize(readAll()[tabKey]);
export function saveConfig(tabKey: string, cfg: TableConfig) {
  const all = readAll(); all[tabKey] = cfg; writeAll(all);
}
export function saveConfigForTabs(tabKeys: string[], cfg: TableConfig) {
  const all = readAll(); for (const k of tabKeys) all[k] = cfg; writeAll(all);
}
