import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Quick-create modal: add a client with ONLY name, surname and cell number.
 * Everything else stays open (null/empty) and can be filled in later from the
 * Deal Room / Finance table. Deliberately silent — no email/WhatsApp/notify
 * calls fire; the row simply appears in the "New Applications" lane
 * (status 'pending') tagged as a manual entry.
 */
interface AddManualEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddManualEntryModal = ({ open, onOpenChange }: AddManualEntryModalProps) => {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ first?: string; last?: string; phone?: string }>({});

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setErrors({});
  };

  // Never dismiss (ESC / overlay click) while the insert is in flight — a
  // mid-flight close hides the outcome and invites a duplicate resubmit.
  const guardedOpenChange = (o: boolean) => {
    if (isSubmitting && !o) return;
    onOpenChange(o);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const first = firstName.trim();
    const last = lastName.trim();
    // Stored digits-only (the wizard validates digits but stores the raw
    // trimmed value; digits-only matches how CRM/WA matching normalises).
    const phoneDigits = phone.replace(/\D/g, '');

    const nextErrors: typeof errors = {};
    if (!first) nextErrors.first = 'First name is required';
    if (!last) nextErrors.last = 'Surname is required';
    if (phoneDigits.length < 9 || phoneDigits.length > 15) nextErrors.phone = 'Enter a valid cell number (9–15 digits)';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      // Capture the staff member who created this entry (mirrors the wizard).
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('finance_applications')
        .insert({
          // Shadow ID for admin-created applications (same as the full wizard
          // when no client profile exists — no email to match a profile here).
          user_id: '00000000-0000-0000-0000-000000000000',
          created_by: authUser?.id || null,
          full_name: `${first} ${last}`,
          first_name: first,
          last_name: last,
          // email is NOT NULL in the schema; stored empty until filled in
          // later (list/drawer cells fall back to an em-dash when blank).
          email: '',
          phone: phoneDigits,
          notes: 'Manual quick entry (name + cell only)',
          status: 'pending',
          submission_source: 'manual',
        } as any)
        .select('id')
        .maybeSingle();

      if (error) {
        toast.error(`Could not add entry: ${error.message}`);
        return;
      }

      // Internal activity trail only — no client-facing notifications.
      void logActivity({
        actionType: 'application_created',
        note: `Manual entry created for ${first} ${last}`,
        applicationId: data?.id ?? null,
        clientEmail: null,
        clientPhone: phoneDigits,
      });

      queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
      toast.success(`${first} ${last} added to New Applications`);
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Error: ${err?.message || 'Something went wrong'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={guardedOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Manual Entry</DialogTitle>
          <DialogDescription>
            Quick-add a client with just their name and cell number. All other details can be filled in later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="manual_first_name">First Name *</Label>
              <Input
                id="manual_first_name"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); if (errors.first) setErrors((p) => ({ ...p, first: undefined })); }}
                placeholder="e.g. Thabo"
                autoFocus
                aria-invalid={!!errors.first}
                className={errors.first ? 'border-destructive' : undefined}
              />
              {errors.first && <p className="text-xs text-destructive">{errors.first}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual_last_name">Surname *</Label>
              <Input
                id="manual_last_name"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); if (errors.last) setErrors((p) => ({ ...p, last: undefined })); }}
                placeholder="e.g. Mokoena"
                aria-invalid={!!errors.last}
                className={errors.last ? 'border-destructive' : undefined}
              />
              {errors.last && <p className="text-xs text-destructive">{errors.last}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual_phone">Cell Number *</Label>
            <Input
              id="manual_phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s+()-]/g, '')); if (errors.phone) setErrors((p) => ({ ...p, phone: undefined })); }}
              placeholder="0721234567"
              aria-invalid={!!errors.phone}
              className={errors.phone ? 'border-destructive' : undefined}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => guardedOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Entry
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddManualEntryModal;
