// Merges a client's scattered history (audit logs, application status changes,
// lead cockpit activity, bank offers, sale/delivery events) into one ordered,
// de-duplicated timeline. Read-only aggregation — does NOT change any write path.

export type TimelineType =
  | 'note' | 'call' | 'reminder' | 'status' | 'offer' | 'sale' | 'delivery' | 'created' | 'system';

export interface TimelineItem {
  id: string;
  timestamp: string; // ISO
  type: TimelineType;
  source: 'audit_log' | 'status_history' | 'lead_activity' | 'finance_offer' | 'deal_record' | 'application';
  title: string;
  body?: string;
  author?: string;
}

interface BuildArgs {
  auditLogs?: any[];      // client_audit_logs rows
  statusHistory?: any[];  // finance_applications.status_history entries [{status, timestamp}]
  leadActivity?: any[];   // flattened leads.activity_log entries [{id,type,text,date,user}]
  offers?: any[];         // finance_offers rows
  dealRecords?: any[];    // deal_records rows
  application?: { created_at?: string | null; status?: string | null } | null;
}

const norm = (s?: string | null) => (s || '').toLowerCase();

const classifyAudit = (actionType?: string | null): TimelineType => {
  const a = norm(actionType);
  if (a.includes('call')) return 'call';
  if (a.includes('remind')) return 'reminder';
  if (a.includes('status') || a.includes('bank') || a.includes('sent')) return 'status';
  return 'note';
};

// Date-only strings (YYYY-MM-DD) → local noon ISO, so day doesn't shift in SAST.
const toIso = (raw: string): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`).toISOString() : new Date(raw).toISOString();

export function buildClientTimeline(args: BuildArgs): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const log of args.auditLogs || []) {
    if (!log?.created_at) continue;
    items.push({
      id: `audit:${log.id}`,
      timestamp: new Date(log.created_at).toISOString(),
      type: classifyAudit(log.action_type),
      source: 'audit_log',
      title: (log.action_type || 'Note').replace(/_/g, ' '),
      body: log.note || '',
      author: log.author_name || undefined,
    });
  }

  // Times where an audit log already captured a status change (dedupe window ±1 min).
  const auditStatusTimes = items.filter(i => i.type === 'status').map(i => new Date(i.timestamp).getTime());

  for (const sh of args.statusHistory || []) {
    const ts = sh?.timestamp || sh?.created_at;
    if (!ts) continue;
    const tms = new Date(ts).getTime();
    if (auditStatusTimes.some(t => Math.abs(t - tms) < 60_000)) continue;
    items.push({
      id: `status:${ts}:${sh.status}`,
      timestamp: new Date(ts).toISOString(),
      type: 'status',
      source: 'status_history',
      title: `Status → ${String(sh.status || '').replace(/_/g, ' ')}`,
      author: 'System',
    });
  }

  for (const a of args.leadActivity || []) {
    if (!a?.date) continue;
    items.push({
      id: `lead:${a.id || a.date}`,
      timestamp: new Date(a.date).toISOString(),
      type: a.type === 'call' ? 'call' : a.type === 'reminder' ? 'reminder' : 'note',
      source: 'lead_activity',
      title: a.type === 'call' ? 'Call' : a.type === 'reminder' ? 'Reminder' : 'Note',
      body: a.text || '',
      author: a.user || undefined,
    });
  }

  for (const o of args.offers || []) {
    if (!o?.created_at) continue;
    items.push({
      id: `offer:${o.id}`,
      timestamp: new Date(o.created_at).toISOString(),
      type: 'offer',
      source: 'finance_offer',
      title: `Bank offer: ${o.bank_name || 'Unknown'}${o.status ? ` (${String(o.status).replace(/_/g, ' ')})` : ''}`,
      author: 'System',
    });
  }

  for (const d of args.dealRecords || []) {
    if (d?.sale_date) {
      items.push({
        id: `sale:${d.id}`, timestamp: toIso(String(d.sale_date)), type: 'sale', source: 'deal_record',
        title: 'Vehicle Sold', body: d.post_deal_notes || '', author: 'System',
      });
    }
    if (d?.delivery_date) {
      items.push({
        id: `delivery:${d.id}`, timestamp: toIso(String(d.delivery_date)), type: 'delivery', source: 'deal_record',
        title: 'Vehicle Delivered', author: 'System',
      });
    }
  }

  if (args.application?.created_at) {
    items.push({
      id: 'app:created',
      timestamp: new Date(args.application.created_at).toISOString(),
      type: 'created',
      source: 'application',
      title: 'Application Created',
      body: args.application.status ? `Status: ${String(args.application.status).replace(/_/g, ' ')}` : '',
      author: 'System',
    });
  }

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
