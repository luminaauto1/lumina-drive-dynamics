import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface BankReferenceBadgeProps {
  reference: string;
  className?: string;
}

const BankReferenceBadge = ({ reference, className = '' }: BankReferenceBadgeProps) => {
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy bank reference: ${reference}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] tracking-wider bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white hover:border-white/20 transition-colors ${className}`}
    >
      <span>{reference}</span>
      <Copy className="w-3 h-3 opacity-50" />
    </button>
  );
};

export default BankReferenceBadge;
