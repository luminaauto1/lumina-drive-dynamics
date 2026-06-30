import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Sparkles, Loader2, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { publicApiHeaders } from '@/lib/publicApi';
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
  const [isUploading, setIsUploading] = useState(false);
  const [language, setLanguage] = useState<'en-ZA' | 'af-ZA'>('en-ZA');
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [pastedText, setPastedText] = useState('');
  const [isProcessingText, setIsProcessingText] = useState(false);

  const handleProcessText = async () => {
    const text = pastedText.trim();
    if (text.length < 20) {
      toast.error('Paste at least a sentence or two for the AI to summarize.');
      return;
    }
    setIsProcessingText(true);
    let aiSucceeded = false;
    try {
      const { data, error } = await supabase.functions.invoke('sales-copilot', {
        headers: publicApiHeaders(),
        body: { action: 'summarize', transcript: text, clientEmail, clientPhone, clientName },
      });
      if (error) throw error;
      if (data?.success && data?.result) {
        aiSucceeded = true;
        toast.success('Text summarized and saved to timeline.');
        setPastedText('');
      }
    } catch (err) {
      console.error('AI summarize (text) failed:', err);
    }

    if (!aiSucceeded) {
      try {
        const { error: insertErr } = await supabase.from('client_audit_logs').insert([{
          client_email: clientEmail || null,
          client_phone: clientPhone || null,
          note: `[Raw Text (AI Summary Failed)]:\n${text}`,
          author_name: 'AI Co-Pilot (Fallback)',
          action_type: 'Call Summary',
        }]);
        if (insertErr) throw insertErr;
        toast.warning('AI summary failed — raw text saved to timeline.');
      } catch (e) {
        console.error('Fallback insert failed:', e);
        toast.error('Failed to process text. Your text is preserved in the box.');
        setIsProcessingText(false);
        if (onCallEnd) onCallEnd();
        return;
      }
    }

    if (onCallEnd) onCallEnd();
    setIsProcessingText(false);
  };

  const recognitionRef = useRef<any>(null);
  const lastHintTimeRef = useRef(Date.now());
  const finalTranscriptRef = useRef('');
  const isManuallyStoppedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      recognition.continuous = true;
      recognition.interimResults = !isMobile;

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let newFinal = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            newFinal += text + ' ';
          } else {
            interimTranscript += text;
          }
        }
        finalTranscriptRef.current += newFinal;
        const fullText = finalTranscriptRef.current + interimTranscript;
        setTranscript(fullText);
        if (fullText.length > 50 && Date.now() - lastHintTimeRef.current > 15000) {
          fetchHint(fullText);
          lastHintTimeRef.current = Date.now();
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied. Please allow microphone permissions.');
        }
      };

      recognition.onend = () => {
        if (!isManuallyStoppedRef.current) {
          try { recognition.start(); } catch (e) { console.error('Failed to auto-restart mic', e); }
        }
      };

      recognitionRef.current = recognition;
    }
    return () => {
      isManuallyStoppedRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const fetchHint = async (currentText: string) => {
    try {
      const { data } = await supabase.functions.invoke('sales-copilot', {
        headers: publicApiHeaders(),
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
    isManuallyStoppedRef.current = false;
    finalTranscriptRef.current = '';
    setTranscript('');
    setLiveHint('Listening... waiting for conversation context.');
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) { console.error(e); }
    } else {
      toast.error('Your browser does not support live dictation. Use Chrome.');
    }
  };

  const stopListening = async () => {
    isManuallyStoppedRef.current = true;
    setIsListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    const fullText = finalTranscriptRef.current || transcript;
    if (fullText.length > 50) {
      setIsProcessing(true);
      toast.info('Call ended. AI is writing your CRM summary...');
      let aiSucceeded = false;
      try {
        const { data, error } = await supabase.functions.invoke('sales-copilot', {
          headers: publicApiHeaders(),
          body: { action: 'summarize', transcript: fullText, clientEmail, clientPhone, clientName },
        });
        if (error) throw error;
        if (data?.success && data?.result) {
          aiSucceeded = true;
          toast.success('Call summarized and saved to timeline.');
        }
      } catch (err) {
        console.error('AI summarize failed:', err);
      }

      if (!aiSucceeded) {
        // Fallback: never lose the raw transcript
        try {
          const { error: insertErr } = await supabase.from('client_audit_logs').insert([{
            client_email: clientEmail || null,
            client_phone: clientPhone || null,
            note: `[Raw Transcript (AI Summary Failed)]:\n${fullText}`,
            author_name: 'AI Co-Pilot (Fallback)',
            action_type: 'Call Summary',
          }]);
          if (insertErr) throw insertErr;
          toast.warning('AI summary failed — raw transcript saved to timeline.');
        } catch (e) {
          console.error('Fallback insert failed:', e);
          toast.error('Failed to save call note. Copy the transcript manually.');
        }
      }

      if (onCallEnd) onCallEnd();
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Audio file exceeds the 25MB limit.');
      return;
    }

    setIsUploading(true);
    toast.info('Uploading audio for AI analysis...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (clientEmail) formData.append('clientEmail', clientEmail);
      if (clientPhone) formData.append('clientPhone', clientPhone);
      if (clientName) formData.append('clientName', clientName);

      const { error } = await supabase.functions.invoke('transcribe-call', {
        headers: publicApiHeaders(),
        body: formData,
      });

      if (error) throw error;

      toast.success('Audio processed and saved to timeline.');
      if (onCallEnd) onCallEnd();
    } catch (err: any) {
      toast.error('Failed to process audio file.');
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded bg-muted/60 border border-border p-0.5">
          <button
            onClick={() => setMode('voice')}
            disabled={isListening || isProcessing || isUploading || isProcessingText}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded transition-colors disabled:opacity-50 ${
              mode === 'voice' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3 h-3" /> Voice Call
          </button>
          <button
            onClick={() => setMode('text')}
            disabled={isListening || isProcessing || isUploading || isProcessingText}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded transition-colors disabled:opacity-50 ${
              mode === 'text' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3 h-3" /> Paste Text
          </button>
        </div>

        {mode === 'voice' && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isListening || isProcessing}
              className="h-7 text-[10px] gap-1 bg-muted/30 border-border hover:bg-muted/50 text-muted-foreground"
            >
              {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {isUploading ? 'Processing...' : 'Upload Audio'}
            </Button>
            <button
              onClick={() => setLanguage(lang => lang === 'en-ZA' ? 'af-ZA' : 'en-ZA')}
              disabled={isListening}
              className="text-[10px] px-2 py-1 rounded bg-muted/30 border border-border text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            >
              {language === 'en-ZA' ? '🇬🇧 EN' : '🇿🇦 AF'}
            </button>
            <Button
              onClick={toggleListening}
              size="sm"
              variant={isListening ? 'destructive' : 'default'}
              className="h-7 text-[10px] gap-1"
              disabled={isProcessing || isUploading}
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isListening ? (
                <><Square className="w-3 h-3" /> End Call &amp; Auto-Log</>
              ) : (
                <><Mic className="w-3 h-3" /> Start Call</>
              )}
            </Button>
          </div>
        )}
      </div>

      {mode === 'voice' ? (
        <>
          <div className="p-2 rounded bg-primary/5 border border-primary/10">
            <p className="text-[11px] text-foreground/80 leading-relaxed italic">{liveHint}</p>
          </div>
          <div className="max-h-20 overflow-y-auto text-[9px] text-muted-foreground font-mono p-2 rounded bg-muted/30 border border-border">
            {transcript || 'Awaiting voice input... (Put call on speakerphone)'}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            disabled={isProcessingText}
            placeholder="Paste a long WhatsApp message, email, or raw call notes here. The AI will summarize it and update Vehicle / Budget / Status on the left panel..."
            className="w-full min-h-[120px] text-[11px] rounded bg-card border border-border text-foreground placeholder:text-muted-foreground p-2 leading-relaxed focus:outline-none focus:border-primary/60 resize-y disabled:opacity-60"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleProcessText}
              disabled={isProcessingText || pastedText.trim().length < 20}
              size="sm"
              className="h-7 text-[10px] gap-1"
            >
              {isProcessingText ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing text...</>
              ) : (
                <><Sparkles className="w-3 h-3" /> Process Text</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
