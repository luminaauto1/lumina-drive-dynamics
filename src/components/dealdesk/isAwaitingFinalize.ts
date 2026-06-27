import type { Deal } from '@/lib/dealdesk/types';

/**
 * An auto-created, not-yet-finalized draft: reads as 'contract_signed' (no sale
 * date / delivery / Natis) and still carries zero recorded profit. These rows
 * are the contract-signed → Deal Desk drafts and are ADMIN-ONLY — non-admins
 * never see un-finalized drafts in the list.
 *
 * Extracted from DealsTable so non-component modules (e.g. lib/dealdesk/stageFlow)
 * can share it without importing a React component (avoids a dependency cycle).
 */
export function isAwaitingFinalize(d: Deal): boolean {
  return d.deal_status === 'contract_signed' && !d.sale_date && (Number(d.gross_profit) || 0) === 0;
}
