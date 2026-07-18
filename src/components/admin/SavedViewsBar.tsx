import { useState } from 'react';
import { Bookmark, Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { SavedView } from '@/hooks/useSavedViews';

/**
 * A compact chip row for named filter presets. Click a chip to apply it; the
 * "Save view" popover captures the current filter state under a name. Purely
 * additive — when there are no saved views, only the save affordance shows.
 */
export function SavedViewsBar<P>({
  views, activeId, onApply, onSave, onDelete,
}: {
  views: SavedView<P>[];
  /** id of the currently-applied view (highlighted), if any. */
  activeId?: string | null;
  onApply: (view: SavedView<P>) => void;
  /** Persist the *current* filter state under `name`. */
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const commit = () => {
    const n = name.trim();
    if (!n) return;
    onSave(n);
    setName('');
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {views.length > 0 && <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />}
      {views.map((v) => {
        const active = v.id === activeId;
        return (
          <span key={v.id}
            className={'group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ' +
              (active ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground')}>
            <button type="button" onClick={() => onApply(v)} className="font-medium">
              {active && <Check className="mr-1 inline h-3 w-3" />}{v.name}
            </button>
            <button type="button" title="Delete view" onClick={() => onDelete(v.id)}
              className="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-muted-foreground">
            <Plus className="h-3.5 w-3.5" /> Save view
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-2 p-3">
          <p className="text-xs font-medium">Save current filters as a view</p>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
            placeholder="View name…" className="h-8" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" className="h-7" disabled={!name.trim()} onClick={commit}>Save</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
