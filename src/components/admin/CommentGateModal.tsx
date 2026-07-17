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
  /** Receives the trimmed comment + trimmed WhatsApp-info text (either may be ''). */
  onConfirm: (comment: string, waClientInfo: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState('');
  const [waClientInfo, setWaClientInfo] = useState('');
  const label = (prompt && prompt.trim()) || 'Comment';
  const waLabel = (waInfoPrompt && waInfoPrompt.trim()) || 'WhatsApp To Client Info';
  const commentOk = !required || !!comment.trim();
  const waInfoOk = !waInfoEnabled || !waInfoRequired || !!waClientInfo.trim();
  const canConfirm = commentOk && waInfoOk;

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm(comment.trim(), waClientInfo.trim());
    setComment('');
    setWaClientInfo('');
  };
  const cancel = () => { setComment(''); setWaClientInfo(''); onCancel(); };

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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <Button onClick={confirm} disabled={!canConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
