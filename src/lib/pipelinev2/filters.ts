// Per-column faceted filters for the Pipeline v2 table.
// Only BOUNDED-value columns are filterable; free-text columns (applicant, phone,
// email, id_number, notes, vehicle, bank_reference, gross, deposit, date) are not.
// Options are FACETED — derived from the applications currently in view, never a
// hardcoded enum — and each row is read with the SAME accessor used to build the
// options, so a cell's displayed value and its filter option always agree.

import type { FinanceApplication } from '@/hooks/useFinanceApplications';
import { sourceLabel } from './source';

/** Column keys that get a header filter (must be a subset of TABLE_COLUMNS keys). */
export const FILTERABLE_KEYS = [
  'status',        // Finance Status
  'client_status', // Client Status
  'source',        // Submission source
  'fni',           // F&I owner
  'rep',           // Creator / rep
  'bank',          // Bank name
  'deal_type',     // Deal type
] as const;

export type FilterableKey = (typeof FILTERABLE_KEYS)[number];

const FILTERABLE_SET = new Set<string>(FILTERABLE_KEYS);
export const isFilterable = (key: string): key is FilterableKey => FILTERABLE_SET.has(key);

/** Label/style dictionaries the accessors need to render options like the cells. */
export interface FilterLabelMaps {
  statusLabels: Record<string, string>;
  clientLabels: Record<string, string>;
}

/** One resolved {value,label} for a row+column. `value` is the comparison key
 *  (options and rows are compared on it); `label` is what the cell/option shows. */
export interface FacetValue {
  value: string;
  label: string;
}

/** A distinct option in a column's filter list, with how many rows carry it. */
export interface FacetOption extends FacetValue {
  count: number;
}

const titleCase = (v: string) =>
  v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The filter value+label for one application in one filterable column, or `null`
 * when the row has no value there (such rows are excluded from the option list
 * AND never match an active selection). Mirrors ApplicationTable's cell accessors
 * so options match exactly what the cells show. `source` collapses by LABEL, so
 * legacy 'whatsapp_parser' and 'whatsapp' merge into a single "WhatsApp" option.
 */
export function facetValue(
  key: FilterableKey,
  a: FinanceApplication,
  maps: FilterLabelMaps,
): FacetValue | null {
  const any = a as any;
  switch (key) {
    case 'status': {
      const slug = any.status;
      if (!slug) return null;
      return { value: String(slug), label: maps.statusLabels[slug] || String(slug) };
    }
    case 'client_status': {
      const slug = any.client_status;
      if (!slug) return null;
      return { value: String(slug), label: maps.clientLabels[slug] || String(slug) };
    }
    case 'source': {
      const raw = any.submission_source;
      if (raw == null || String(raw).trim() === '') return null;
      const label = sourceLabel(raw); // collapses whatsapp_parser → WhatsApp, etc.
      return { value: label, label };
    }
    case 'fni': {
      const name = a.fni_owner?.full_name || a.fni_owner?.email;
      if (!name) return null;
      return { value: name, label: name };
    }
    case 'rep': {
      const name = a.creator?.full_name || a.creator?.email;
      if (!name) return null;
      return { value: name, label: name };
    }
    case 'bank': {
      const raw = any.bank_name;
      if (raw == null || String(raw).trim() === '') return null;
      return { value: String(raw), label: String(raw) };
    }
    case 'deal_type': {
      const raw = any.deal_type;
      if (raw == null || String(raw).trim() === '') return null;
      return { value: String(raw), label: titleCase(String(raw)) };
    }
    default:
      return null;
  }
}

/**
 * Build the faceted option list for each filterable column from `rows`. Derive
 * these from the set BEFORE per-column filters are applied so option lists stay
 * stable as selections change. Options are sorted by label; each carries a count.
 */
export function buildFacets(
  rows: FinanceApplication[],
  keys: readonly FilterableKey[],
  maps: FilterLabelMaps,
): Record<string, FacetOption[]> {
  const acc: Record<string, Map<string, FacetOption>> = {};
  for (const k of keys) acc[k] = new Map();
  for (const a of rows) {
    for (const k of keys) {
      const fv = facetValue(k, a, maps);
      if (!fv) continue;
      const bucket = acc[k];
      const existing = bucket.get(fv.value);
      if (existing) existing.count += 1;
      else bucket.set(fv.value, { value: fv.value, label: fv.label, count: 1 });
    }
  }
  const out: Record<string, FacetOption[]> = {};
  for (const k of keys) {
    out[k] = Array.from(acc[k].values()).sort((x, y) =>
      x.label.localeCompare(y.label, undefined, { sensitivity: 'base' }),
    );
  }
  return out;
}

/**
 * Whether a row passes the active per-column selections. AND across columns
 * (every column with a selection must match), OR within a column (any selected
 * value matches). Columns with an empty/missing selection impose no filter.
 */
export function rowPassesColumnFilters(
  a: FinanceApplication,
  columnFilters: Record<string, string[]>,
  maps: FilterLabelMaps,
): boolean {
  for (const [key, selected] of Object.entries(columnFilters)) {
    if (!selected || selected.length === 0) continue;
    if (!isFilterable(key)) continue; // ignore any stray non-filterable keys
    const fv = facetValue(key, a, maps);
    if (!fv || !selected.includes(fv.value)) return false;
  }
  return true;
}

/** Number of columns that currently have a non-empty selection. */
export const activeColumnFilterCount = (columnFilters: Record<string, string[]>): number =>
  Object.values(columnFilters).filter((v) => v && v.length > 0).length;

/** Stable serialization of the active selections (for render-window reset keys). */
export const columnFiltersKey = (columnFilters: Record<string, string[]>): string =>
  Object.entries(columnFilters)
    .filter(([, v]) => v && v.length > 0)
    .map(([k, v]) => `${k}:${[...v].sort().join(',')}`)
    .sort()
    .join('|');
