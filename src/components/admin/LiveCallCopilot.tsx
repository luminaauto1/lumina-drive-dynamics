import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LiveCallCopilotProps {
  clientEmail?: string;
  clientPhone?: string;
  clientName?: string;
  onCallEnd?: () => void;
}

export default function LiveCallCopilot({ clientEmail, clientPhone, clientName, onCallEnd }: LiveCallCopilotProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [liveHint, setLiveHint] = useState('Start the call. I will listen and provide live suggestions here.');
  const [isProcessing, setIsProcessing] = useState(false);
  const [language, setLanguage] = useState<'en-ZA' | 'af-ZA'>('en-ZA');
  const recognitionRef = useRef<any>(null);
  const lastHintTimeRef = useRef(Date.now());

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);

        if (currentTranscript.length > 50 && Date.now() - lastHintTimeRef.current > 15000) {
          fetchHint(currentTranscript);
          lastHintTimeRef.current = Date.now();
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied. Please allow microphone permissions.');
        }
      };

      recognitionRef.current = recognition;
    }
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const fetchHint = async (currentText: string) => {
    try {
      const { data } = await supabase.functions.invoke('sales-copilot', {
        body: { action: 'hint', transcript: currentText.slice(-300), clientName },
      });
      if (data?.result) setLiveHint(data.result);
    } catch {
      console.error('Hint fetch failed');
    }
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  const startListening = () => {
    setTranscript('');
    setLiveHint('Listening... waiting for conversation context.');
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
      recognitionRef.current.start();
      setIsListening(true);
    } else {
      toast.error('Your browser does not support live dictation. Use Chrome.');
    }
  };

  const stopListening = async () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);

    if (transcript.length > 50) {
      setIsProcessing(true);
      toast.info('Call ended. AI is writing your CRM summary...');
      try {
        const { data, error } = await supabase.functions.invoke('sales-copilot', {
          body: { action: 'summarize', transcript, clientEmail, clientPhone, clientName },
        });
        if (error) throw error;
        toast.success('Call summarized and saved to timeline.');
        if (onCallEnd) onCallEnd();
      } catch {
        toast.error('Failed to auto-summarize call.');
      }
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-semibold text-primary">AI Co-Pilot Live</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(lang => lang === 'en-ZA' ? 'af-ZA' : 'en-ZA')}
            disabled={isListening}
            className="text-[10px] px-2 py-1 rounded bg-black/50 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            {language === 'en-ZA' ? '🇬🇧 EN' : '🇿🇦 AF'}
          </button>
          <Button
            onClick={toggleListening}
            size="sm"
            variant={isListening ? 'destructive' : 'default'}
            className="h-7 text-[10px] gap-1"
            disabled={isProcessing}
          >
          {isProcessing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isListening ? (
            <><Square className="w-3 h-3" /> End Call &amp; Auto-Log</>
          ) : (
            <><Mic className="w-3 h-3" /> Start Call / Listen</>
          )}
          </Button>
        </div>
      </div>

      {/* Live Coach Display */}
      <div className="p-2 rounded bg-primary/5 border border-primary/10">
        <p className="text-[11px] text-foreground/80 leading-relaxed italic">{liveHint}</p>
      </div>

      {/* Live Transcript */}
      <div className="max-h-20 overflow-y-auto text-[9px] text-muted-foreground font-mono p-2 rounded bg-muted/30 border border-border">
        {transcript || 'Awaiting voice input... (Put call on speakerphone)'}
      </div>
    </div>
  );
}
