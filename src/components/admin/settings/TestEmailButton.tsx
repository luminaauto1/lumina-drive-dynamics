import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicApiHeaders } from '@/lib/publicApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/** Sends a test finance-alert email through the configured Resend key. */
export const TestEmailButton = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestEmail = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const { error } = await supabase.functions.invoke('send-finance-alert', {
        headers: publicApiHeaders(),
        body: { applicationId: 'test-' + Date.now() },
      });
      if (error) {
        console.error('Email test failed:', error);
        setTestResult({ success: false, message: `Edge Function Error: ${error.message || JSON.stringify(error)}` });
        toast.error(`Email test failed: ${error.message}`);
      } else {
        setTestResult({ success: true, message: 'Email system is working! Check your inbox.' });
        toast.success('Email test successful!');
      }
    } catch (err: any) {
      console.error('Email test exception:', err);
      setTestResult({ success: false, message: `Exception: ${err.message || 'Unknown error'}` });
      toast.error(`Email test failed: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Test the email notification system — sends a test message using your configured Resend API key.
      </p>
      <div className="flex items-center gap-4">
        <Button type="button" variant="outline" onClick={handleTestEmail} disabled={isTesting} className="gap-2">
          {isTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              Test Email System
            </>
          )}
        </Button>
      </div>
      {testResult && (
        <div
          className={`p-4 rounded-lg text-sm ${
            testResult.success
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-destructive/10 text-destructive border border-destructive/30'
          }`}
        >
          <p className="font-medium">{testResult.success ? '✓ Success' : '✗ Failed'}</p>
          <p className="mt-1 text-xs opacity-80 break-all">{testResult.message}</p>
        </div>
      )}
    </div>
  );
};
