import { useAuth } from '@/contexts/AuthContext';

/**
 * Deal Desk has two halves: a DELIVERY side (deals list, Natis, customer
 * follow-ups) and a MONEY side (profit ledger, cost sheets, expenses,
 * payables). Sales agents get the delivery side only.
 *
 * This mirrors the database, where deal_costsheet / deal_expense_items /
 * deal_payees are blocked for sales agents by RLS and deal_records financial
 * columns are write-protected by the deal_records_guard_financials trigger.
 * Hiding these surfaces therefore prevents dead panels rather than merely
 * masking numbers the user could otherwise load.
 */
export function useCanSeeDealProfit(): boolean {
  const { isSuperAdmin, isSeniorFAndI, isAccountant } = useAuth();
  return isSuperAdmin || isSeniorFAndI || isAccountant;
}
