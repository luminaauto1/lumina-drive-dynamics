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
  waInfoEnabled = false,
  waInfoRequired = false,
  waInfoPrompt,
  fniEnabled = false,
  fniRequired = false,
  fniPrompt,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** When true, Confirm stays disabled until a non-blank comment is entered. */
  required: boolean;
  /** Label shown above the box (status_overrides.comment_prompt). */
  prompt?: string | null;
  /** When true, a dedicated "WhatsApp To Client Info" box is shown (opt-in per caller). */
  waInfoEnabled?: boolean;
  /** When true, Confirm stays disabled until the WhatsApp box is filled. */
  waInfoRequired?: boolean;
  /** Label shown above the WhatsApp box (status_overrides.wa_client_info_prompt). */
  waInfoPrompt?: string | null;
  /** When true, a dedicated "F&I notes" box is shown (opt-in per caller). */
  fniEnabled?: boolean;
  /** When true, Confirm stays disabled until the F&I note box is filled. */
  fniRequired?: boolean;
  /** Label shown above the F&I notes box (status_overrides.fni_note_prompt). */
  fniPrompt?: string | null;
  /** Receives trimmed comment + WhatsApp-info + F&I note (any may be ''). */
  onConfirm: (comment: string, waClientInfo: string, fniNote: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState('');
  const [waClientInfo, setWaClientInfo] = useState('');
  const [fniNote, setFniNote] = useState('');
  const label = (prompt && prompt.trim()) || 'Comment';
  const waLabel = (waInfoPrompt && waInfoPrompt.trim()) || 'WhatsApp To Client Info';
  const fniLabel = (fniPrompt && fniPrompt.trim()) || 'F&I notes';
  const commentOk = !required || !!comment.trim();
  const waInfoOk = !waInfoEnabled || !waInfoRequired || !!waClientInfo.trim();
  const fniOk = !fniEnabled || !fniRequired || !!fniNote.trim();
  const canConfirm = commentOk && waInfoOk && fniOk;

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm(comment.trim(), waClientInfo.trim(), fniNote.trim());
    setComment('');
    setWaClientInfo('');
    setFniNote('');
  };
  const cancel = () => { setComment(''); setWaClientInfo(''); setFniNote(''); onCancel(); };

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
          {/* WhatsApp To Client Info — dedicated box, opt-in per caller. */}
          {waInfoEnabled && (
            <div className="space-y-2 pt-1">
              <label className="text-sm font-medium text-foreground">
                {waLabel}{waInfoRequired && <span className="text-red-400"> *</span>}
              </label>
              <Textarea
                value={waClientInfo}
                onChange={(e) => setWaClientInfo(e.target.value)}
                rows={3}
                placeholder={waInfoRequired ? 'A WhatsApp message is required for this status…' : 'Message to send the client on WhatsApp…'}
              />
            </div>
          )}
          {/* F&I notes — dedicated internal box, opt-in per caller. */}
          {fniEnabled && (
            <div className="space-y-2 pt-1">
              <label className="text-sm font-medium text-foreground">
                {fniLabel}{fniRequired && <span className="text-red-400"> *</span>}
              </label>
              <Textarea
                value={fniNote}
                onChange={(e) => setFniNote(e.target.value)}
                rows={3}
                placeholder={fniRequired ? 'An F&I note is required for this status…' : 'Internal F&I note (e.g. deposit needed)…'}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <Button onClick={confirm} disabled={!canConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
