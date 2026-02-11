import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PIPELINE_COLUMNS, type Lead } from './types';

interface LeadEditModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const LeadEditModal = ({ lead, open, onOpenChange, onSaved }: LeadEditModalProps) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState(lead?.pipeline_stage || 'new');
  const [nextDate, setNextDate] = useState(lead?.next_action_date?.split('T')[0] || '');
  const [nextNote, setNextNote] = useState(lead?.next_action_note || '');
  const [notes, setNotes] = useState(lead?.notes || '');

  // Reset form when lead changes
  if (lead && stage !== lead.pipeline_stage && !saving) {
    setStage(lead.pipeline_stage || 'new');
    setNextDate(lead.next_action_date?.split('T')[0] || '');
    setNextNote(lead.next_action_note || '');
    setNotes(lead.notes || '');
  }

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          pipeline_stage: stage,
          next_action_date: nextDate || null,
          next_action_note: nextNote || null,
          notes,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (error) throw error;
      toast.success('Lead updated');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickConvert = () => {
    if (!lead) return;
    navigate('/admin/finance/create', {
      state: {
        prefill: {
          full_name: lead.client_name,
          phone: lead.client_phone,
          email: lead.client_email,
        },
      },
    });
    onOpenChange(false);
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Lead: {lead.client_name || 'Unknown'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pipeline Stage */}
          <div>
            <Label>Pipeline Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIPELINE_COLUMNS.map(col => (
                  <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Next Action */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Next Action Date</Label>
              <Input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} />
            </div>
            <div>
              <Label>Action Note</Label>
              <Input placeholder="e.g. Call back" value={nextNote} onChange={e => setNextNote(e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Client said..." />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={handleQuickConvert} className="text-primary border-primary/30">
              <Rocket className="w-4 h-4 mr-1" /> Convert to Application
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadEditModal;
