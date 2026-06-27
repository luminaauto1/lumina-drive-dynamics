// Reusable comment gate for status changes.
//
// When a status has `comment_required` set (status_overrides), the status-change
// surfaces that use an inline dropdown (Finance list, Deal Room, CRM table) pop
// this dialog INSTEAD of writing immediately. The dialog NEVER writes status
// itself — on confirm it returns the trimmed comment to the caller, which then
// performs the existing status write and (if a comment was entered) an
// addPipelineNote. This keeps the gate purely in the UI layer.

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function CommentGateModal({
  open,
  required,
  prompt,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** When true, Confirm stays disabled until a non-blank comment is entered. */
  required: boolean;
  /** Label shown above the box (status_overrides.comment_prompt). */
  prompt?: string | null;
  /** Receives the trimmed comment (may be '' when not required). */
  onConfirm: (comment: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState('');
  const label = (prompt && prompt.trim()) || 'Comment';
  const canConfirm = !required || !!comment.trim();

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm(comment.trim());
    setComment('');
  };
  const cancel = () => { setComment(''); onCancel(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && cancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{required ? 'Add a comment to continue' : 'Add a comment'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <label className="text-sm font-medium text-foreground">
            {label}{required && <span className="text-red-400"> *</span>}
          </label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={required ? 'A comment is required for this status…' : 'Optional comment…'}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <Button onClick={confirm} disabled={!canConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
