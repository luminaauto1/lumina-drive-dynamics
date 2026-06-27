import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRightLeft } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { useUpdateLead } from '@/hooks/useLeads';
import { useUpdateFinanceApplication } from '@/hooks/useFinanceApplications';
import { STATUS_OPTIONS as FINANCE_STATUS_OPTIONS } from '@/lib/statusConfig';
import { filterStatusOptionsForRole } from '@/lib/roleStatusFilter';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { CommentGateModal } from '@/components/admin/CommentGateModal';
import { addPipelineNote } from '@/lib/pipelinev2/notes';
import { supabase } from '@/integrations/supabase/client';
import BankReferenceModal from '@/components/admin/BankReferenceModal';
import type { CrmRecord } from '@/hooks/useCrmData';

const LEAD_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted to App' },
  { value: 'lost', label: 'Lost' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'archived', label: 'Archived' },
];

const getStatusColor = (status: string) => {
  const s = (status || '').toLowerCase().trim();
  if (['new', 'draft'].includes(s)) return 'border-zinc-400 bg-zinc-500/10 text-zinc-300';
  if (['contacted'].includes(s)) return 'border-sky-400 bg-sky-500/10 text-sky-400';
  if (['in_progress'].includes(s)) return 'border-yellow-400 bg-yellow-500/10 text-yellow-400';
  if (['pending', 'application_submitted', 'needs_revision', 'revision_submitted', 'under_review'].includes(s)) return 'border-orange-500 bg-orange-500/10 text-orange-400';
  if (['pre_approved', 'documents_received', 'vehicle_selected', 'approved'].includes(s)) return 'border-purple-500 bg-purple-500/10 text-purple-400';
  if (['validations_pending', 'validations_complete', 'contract_sent', 'contract_signed'].includes(s)) return 'border-blue-500 bg-blue-500/10 text-blue-400';
  if (['finalized', 'delivered', 'vehicle_delivered', 'converted', 'qualified'].includes(s)) return 'border-emerald-500 bg-emerald-500/10 text-emerald-400';
  if (['lost', 'declined', 'archived'].includes(s)) return 'border-red-500 bg-red-500/10 text-red-400';
  return 'border-zinc-600 bg-zinc-500/10 text-zinc-300';
};

const getRowBorder = (status: string) => getStatusColor(status).split(' ')[0].replace('border-', 'border-l-');

const thermal = (d: string) => {
  if (!d) return 'text-muted-foreground';
  const days = differenceInDays(new Date(), new Date(d));
  if (days <= 2) return 'text-muted-foreground';
  if (days <= 5) return 'text-amber-400';
  return 'text-red-500 font-semibold';
};

interface CrmTableProps {
  records: CrmRecord[];
  onOpen: (record: CrmRecord) => void;
  onChanged: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  canSelect: boolean;
}

const CrmTable = ({ records, onOpen, onChanged, selectedIds, onToggleSelect, canSelect }: CrmTableProps) => {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const updateLead = useUpdateLead();
  const updateApp = useUpdateFinanceApplication();
  const { commentRequiredFor, commentPromptFor } = useStatusConfig();
  const [bankRefOpen, setBankRefOpen] = useState(false);
  const [bankRefAppId, setBankRefAppId] = useState<string | null>(null);
  // Comment-gate interception (finance rows only — leads have no status rules).
  const [commentGate, setCommentGate] = useState<{ rec: CrmRecord; status: string } | null>(null);

  const handleStatusChange = async (rec: CrmRecord, newStatus: string) => {
    const isFinance = !!rec.appDetails;
    const current = (isFinance ? rec.appDetails.status : rec.status) || 'new';
    if (newStatus === current) return;

    if (newStatus === 'finalized' && current !== 'archived') {
      toast.error('Use the Deal Room / Podium to finalize deals so all delivery data is captured.');
      return;
    }
    // Capture the bank reference before marking a finance app as submitted.
    if (isFinance && newStatus === 'application_submitted') {
      setBankRefAppId(rec.appDetails.id);
      setBankRefOpen(true);
      return;
    }

    // Comment gate — finance rows whose target status requires a comment.
    if (isFinance && commentRequiredFor(newStatus)) {
      setCommentGate({ rec, status: newStatus });
      return;
    }

    await writeStatus(rec, newStatus);
  };

  // The status write (extracted so the comment gate can call it). `comment` is
  // persisted as a status_change pipeline note for finance rows.
  const writeStatus = async (rec: CrmRecord, newStatus: string, comment?: string) => {
    const isFinance = !!rec.appDetails;
    const archiveOnTerminal = ['declined', 'blacklisted', 'lost'].includes(newStatus);
    try {
      if (isFinance) {
        // Side-effects (email / WhatsApp / status_history) fire inside this hook.
        await updateApp.mutateAsync({ id: rec.appDetails.id, updates: { status: newStatus, is_archived: archiveOnTerminal } as any });
        if (comment && comment.trim()) {
          const { data: row } = await supabase
            .from('finance_applications')
            .select('id, pipeline_notes')
            .eq('id', rec.appDetails.id)
            .maybeSingle();
          await addPipelineNote(row ?? { id: rec.appDetails.id }, {
            body: comment.trim(),
            category: 'status_change',
            author_id: user?.id ?? null,
            author_name: (user as any)?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Unknown',
          });
        }
      } else {
        const finalStatus = archiveOnTerminal ? 'archived' : newStatus;
        await updateLead.mutateAsync({ id: rec.id, updates: { status: finalStatus } as any });
      }
      if (archiveOnTerminal) toast.success(`Marked as ${newStatus} and archived.`);
      onChanged();
    } catch {
      /* hook surfaces its own error toast */
    }
  };

  const handleNotesChange = async (rec: CrmRecord, notes: string) => {
    try {
      if (rec.appDetails) await updateApp.mutateAsync({ id: rec.appDetails.id, updates: { notes } as any });
      else await updateLead.mutateAsync({ id: rec.id, updates: { notes } as any });
      toast.success('Comment saved');
      onChanged();
    } catch { /* handled by hook */ }
  };

  return (
    <div className="flex-1 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
          <TableRow className="hover:bg-transparent border-b border-border">
            {canSelect && <TableHead className="w-8" />}
            <TableHead className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground py-2.5 px-3 whitespace-nowrap">Name</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground py-2.5 px-3 whitespace-nowrap">Surname</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground py-2.5 px-3 whitespace-nowrap">Cell No.</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground py-2.5 px-3 whitespace-nowrap">Date</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground py-2.5 px-3 whitespace-nowrap">Status</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground py-2.5 px-3 w-full">Comments</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground py-2.5 px-3 text-right whitespace-nowrap">Act.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow><TableCell colSpan={canSelect ? 8 : 7} className="text-center text-muted-foreground py-10 text-sm">No records found.</TableCell></TableRow>
          ) : (
            records.map((rec) => {
              const name = rec.client_name || rec.appDetails?.full_name || 'Unknown';
              const firstName = name.split(' ')[0];
              const lastName = name.split(' ').slice(1).join(' ');
              const isFinance = !!rec.appDetails;
              const status = (isFinance ? rec.appDetails.status : rec.status) || 'new';
              const options = isFinance ? filterStatusOptionsForRole(FINANCE_STATUS_OPTIONS, role, status) : LEAD_STATUS_OPTIONS;
              return (
                <TableRow key={rec.id} className={`border-l-4 ${getRowBorder(status)} even:bg-white/[0.02] hover:bg-primary/5 cursor-pointer transition-colors`} onClick={() => onOpen(rec)}>
                  {canSelect && (
                    <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                      {!rec.isVirtual && <Checkbox checked={selectedIds.has(rec.id)} onCheckedChange={() => onToggleSelect(rec.id)} className="h-4 w-4" />}
                    </TableCell>
                  )}
                  <TableCell className="py-2 px-3 text-sm font-medium whitespace-nowrap">{firstName}</TableCell>
                  <TableCell className="py-2 px-3 text-sm whitespace-nowrap">{lastName}</TableCell>
                  <TableCell className="py-2 px-3 text-sm font-mono whitespace-nowrap">{rec.client_phone || 'N/A'}</TableCell>
                  <TableCell className={`py-2 px-3 text-xs whitespace-nowrap ${thermal(rec.created_at)}`}>
                    {rec.created_at ? format(new Date(rec.created_at), 'dd MMM') : 'N/A'}
                  </TableCell>
                  <TableCell className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                    <Select value={status} onValueChange={(v) => handleStatusChange(rec, v)}>
                      <SelectTrigger className={`h-8 text-xs w-[150px] rounded-md border px-2 ${getStatusColor(status)}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {options.map((opt) => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2 px-3 w-full" onClick={(e) => e.stopPropagation()}>
                    <Input
                      key={rec.id}
                      defaultValue={rec.notes || ''}
                      onBlur={(e) => { if (e.target.value !== (rec.notes || '')) handleNotesChange(rec, e.target.value); }}
                      className="h-8 text-xs bg-transparent border-transparent hover:border-muted focus:border-primary px-2 w-full rounded-md"
                      placeholder="Add comment…"
                    />
                  </TableCell>
                  <TableCell className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {!isFinance && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7" title="Convert to Finance Application"
                        onClick={() => navigate('/admin/finance/create', { state: { prefillName: name, prefillPhone: rec.client_phone && rec.client_phone !== 'N/A' ? rec.client_phone : '' } })}
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <BankReferenceModal
        open={bankRefOpen}
        onOpenChange={(o) => { setBankRefOpen(o); if (!o) setBankRefAppId(null); }}
        onConfirm={async (reference) => {
          if (!bankRefAppId) return;
          try {
            await updateApp.mutateAsync({ id: bankRefAppId, updates: { status: 'application_submitted', bank_reference: reference } });
            onChanged();
          } catch { /* handled by hook */ }
        }}
      />

      {commentGate && (
        <CommentGateModal
          open
          required={commentRequiredFor(commentGate.status)}
          prompt={commentPromptFor(commentGate.status)}
          onCancel={() => setCommentGate(null)}
          onConfirm={(comment) => {
            const { rec, status } = commentGate;
            setCommentGate(null);
            void writeStatus(rec, status, comment);
          }}
        />
      )}
    </div>
  );
};

export default CrmTable;
