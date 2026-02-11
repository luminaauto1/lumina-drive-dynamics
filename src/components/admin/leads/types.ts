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
  vehicle?: {
    make: string;
    model: string;
    year: number;
  } | null;
}

export const PIPELINE_COLUMNS = [
  { id: 'new', title: '📥 NEW / INBOX', color: 'border-t-red-500', headerBg: 'bg-red-500/10 text-red-400' },
  { id: 'contacted', title: '🗣️ CONTACTED', color: 'border-t-blue-500', headerBg: 'bg-blue-500/10 text-blue-400' },
  { id: 'finance', title: '📝 APPLIED / FINANCE', color: 'border-t-purple-500', headerBg: 'bg-purple-500/10 text-purple-400' },
  { id: 'approved', title: '✅ APPROVED / CLOSING', color: 'border-t-emerald-500', headerBg: 'bg-emerald-500/10 text-emerald-400' },
  { id: 'cold', title: '❄️ COLD / FUTURE', color: 'border-t-gray-500', headerBg: 'bg-gray-500/10 text-gray-400' },
] as const;

export type PipelineStage = typeof PIPELINE_COLUMNS[number]['id'];
