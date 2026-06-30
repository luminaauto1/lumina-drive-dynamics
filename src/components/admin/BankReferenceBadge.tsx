import { Copy, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface BankReferenceBadgeProps {
  reference: string;
  className?: string;
  onEdit?: () => void;
}

const BankReferenceBadge = ({ reference, className = '', onEdit }: BankReferenceBadgeProps) => {
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(reference);
      toast('Reference copied', {
        style: {
          background: '#0a0a0a',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
        },
      });
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] tracking-wider bg-muted border border-border text-foreground/80 hover:border-foreground/20 transition-colors ${className}`}
    >
      <span className="text-foreground/80">{reference}</span>
      <button
        type="button"
        onClick={handleCopy}
        title={`Copy bank reference: ${reference}`}
        className="p-0.5 rounded hover:bg-muted transition-colors"
      >
        <Copy className="w-3 h-3 opacity-50" />
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Edit bank reference"
          className="p-0.5 rounded hover:bg-muted transition-colors"
        >
          <Pencil className="w-3 h-3 opacity-50" />
        </button>
      )}
    </div>
  );
};

export default BankReferenceBadge;
