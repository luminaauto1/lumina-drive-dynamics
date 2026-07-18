import { Inbox, MessageSquare, FileText, CheckCircle2, Snowflake, type LucideIcon } from 'lucide-react';

export interface Lead {
  id: string;
  source: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  vehicle_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  pipeline_stage: string;
  lead_score: number;
  next_action_date: string | null;
  next_action_note: string | null;
  last_activity_at: string | null;
  is_archived?: boolean;
  vehicle?: {
    make: string;
    model: string;
    year: number;
  } | null;
}

export const PIPELINE_COLUMNS = [
  { id: 'new', title: 'NEW / INBOX', icon: Inbox, color: 'border-t-red-500', headerBg: 'bg-red-500/10 text-red-400' },
  { id: 'contacted', title: 'CONTACTED', icon: MessageSquare, color: 'border-t-blue-500', headerBg: 'bg-blue-500/10 text-blue-400' },
  { id: 'finance', title: 'APPLIED / FINANCE', icon: FileText, color: 'border-t-purple-500', headerBg: 'bg-purple-500/10 text-purple-400' },
  { id: 'approved', title: 'APPROVED / CLOSING', icon: CheckCircle2, color: 'border-t-emerald-500', headerBg: 'bg-emerald-500/10 text-emerald-400' },
  { id: 'cold', title: 'COLD / FUTURE', icon: Snowflake, color: 'border-t-muted-foreground/60', headerBg: 'bg-muted/40 text-muted-foreground' },
] as const satisfies readonly { id: string; title: string; icon: LucideIcon; color: string; headerBg: string }[];

export type PipelineStage = typeof PIPELINE_COLUMNS[number]['id'];
