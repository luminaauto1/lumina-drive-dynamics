import { useState } from 'react';
import { Brain, X, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AIAssistantWidget = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runAnalysis = async () => {
    if (loading) return;
    setLoading(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-business-state');

      if (error) {
        toast.error(`Analysis failed: ${error.message}`);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setAnalysis(data.analysis);
      setLastRun(new Date());
    } catch (err: any) {
      toast.error('Failed to connect to AI service.');
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <h2 key={i} className="text-base font-bold text-primary mt-5 mb-2 tracking-wide uppercase">
            {line.replace('## ', '')}
          </h2>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <h1 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">
            {line.replace('# ', '')}
          </h1>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <div key={i} className="flex gap-2 py-0.5 text-sm text-muted-foreground">
            <span className="text-primary mt-0.5">—</span>
            <span>{renderInlineFormatting(line.slice(2))}</span>
          </div>
        );
      }
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      return (
        <p key={i} className="text-sm text-muted-foreground leading-relaxed">
          {renderInlineFormatting(line)}
        </p>
      );
    });
  };

  const renderInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <span key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
        >
          <Brain className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:w-[480px] bg-card border-border p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-foreground text-base font-bold tracking-wide">
                Business Brain
              </SheetTitle>
              <p className="text-xs text-muted-foreground">
                {lastRun
                  ? `Last run: ${lastRun.toLocaleTimeString()}`
                  : 'On-demand operational analysis'}
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-6 py-4">
            <Button
              onClick={runAnalysis}
              disabled={loading}
              className="w-full gap-2"
              variant="default"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing operations…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Run System Analysis
                </>
              )}
            </Button>
          </div>

          <ScrollArea className="flex-1 px-6 pb-6">
            {analysis ? (
              <div className="space-y-0">{renderMarkdown(analysis)}</div>
            ) : !loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Brain className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  No analysis loaded
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Press the button above to run a live briefing
                </p>
              </div>
            ) : null}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AIAssistantWidget;
