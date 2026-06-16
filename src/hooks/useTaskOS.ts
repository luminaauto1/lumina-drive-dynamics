import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { publicApiHeaders } from '@/lib/publicApi';
import { toast } from 'sonner';

// LuminaTaskOS data hooks. New taskos_* tables aren't in the generated Supabase
// types yet, so we cast via `as any` (same pattern as useDocumentSettings).
// RLS scopes every read/write to the logged-in user — never pass another user_id.
const db = supabase as any;

export interface TaskOSInboxItem {
  id: string; source: string; raw_text: string | null; media_kind: string;
  status: string; ai_result: any; error_text: string | null; created_at: string; processed_at: string | null;
}
export interface TaskOSTask {
  id: string; title: string; description: string | null; status: string;
  due_at: string | null; urgency: number; importance: number; priority_score: number;
  priority_locked: boolean; tags: string[]; created_at: string; completed_at: string | null;
}

// ---------------- INBOX ----------------
export const useTaskOSInbox = () =>
  useQuery({
    queryKey: ['taskos', 'inbox'],
    queryFn: async (): Promise<TaskOSInboxItem[]> => {
      const { data, error } = await db.from('taskos_inbox_items')
        .select('id, source, raw_text, media_kind, status, ai_result, error_text, created_at, processed_at')
        .order('created_at', { ascending: false }).limit(60);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 8000, // surface AI results as they land
  });

export const useCaptureInbox = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error('Not signed in');
      const { data, error } = await db.from('taskos_inbox_items')
        .insert({ user_id: user.id, source: 'panel', media_kind: 'text', raw_text: text, status: 'pending' })
        .select('id').single();
      if (error) throw error;
      // Kick the AI processor (internal-key gated; user_id read from the row).
      await supabase.functions.invoke('taskos-process-inbox', {
        body: { inbox_item_id: data.id },
        headers: publicApiHeaders(),
      });
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['taskos', 'inbox'] });
      qc.invalidateQueries({ queryKey: ['taskos', 'tasks'] });
      toast.success('Captured — organising it now');
    },
    onError: (e: any) => toast.error('Capture failed: ' + e.message),
  });
};

export const useDiscardInbox = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('taskos_inbox_items').update({ status: 'ignored' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taskos', 'inbox'] }),
  });
};

// ---------------- TASKS ----------------
export const useTaskOSTasks = () =>
  useQuery({
    queryKey: ['taskos', 'tasks'],
    queryFn: async (): Promise<TaskOSTask[]> => {
      const { data, error } = await db.from('taskos_tasks')
        .select('id, title, description, status, due_at, urgency, importance, priority_score, priority_locked, tags, created_at, completed_at')
        .order('status', { ascending: true })
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

export const useCreateTask = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; due_at?: string | null; urgency?: number; importance?: number }) => {
      if (!user) throw new Error('Not signed in');
      const { error } = await db.from('taskos_tasks').insert({
        user_id: user.id, title: input.title, description: input.description ?? null,
        due_at: input.due_at ?? null, urgency: input.urgency ?? 3, importance: input.importance ?? 3,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['taskos', 'tasks'] }); toast.success('Task added'); },
    onError: (e: any) => toast.error('Could not add task: ' + e.message),
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TaskOSTask> }) => {
      const patch: any = { ...updates };
      if (updates.status === 'done' && !('completed_at' in updates)) patch.completed_at = new Date().toISOString();
      if (updates.status && updates.status !== 'done') patch.completed_at = null;
      const { error } = await db.from('taskos_tasks').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taskos', 'tasks'] }),
    onError: (e: any) => toast.error('Update failed: ' + e.message),
  });
};

// ---------------- TELEGRAM / SETTINGS ----------------
export const useTelegramStatus = () =>
  useQuery({
    queryKey: ['taskos', 'tg-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('taskos-telegram-link', { body: { action: 'status' } });
      if (error) throw error;
      return data as { linked: boolean; link: { telegram_username: string | null; linked_at: string } | null };
    },
    refetchInterval: 5000, // flip to "connected" live after the user taps the link
  });

export const useGenerateTelegramCode = () =>
  useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('taskos-telegram-link', { body: { action: 'create_code' } });
      if (error) throw error;
      return data as { code: string; deep_link: string | null; bot_username: string; expires_at: string; ttl_minutes: number };
    },
    onError: (e: any) => toast.error('Could not generate code: ' + e.message),
  });

export const useUnlinkTelegram = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('taskos-telegram-link', { body: { action: 'unlink' } });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['taskos', 'tg-status'] }); toast.success('Telegram disconnected'); },
  });
};

// ---------------- ASK (Q&A) ----------------
export const useTaskOSQuery = () =>
  useMutation({
    mutationFn: async (question: string) => {
      const { data, error } = await supabase.functions.invoke('taskos-query', { body: { question } });
      if (error) throw error;
      return data as { answer: string; sources: string[]; confident: boolean; follow_up_suggestions?: string[] };
    },
    onError: (e: any) => toast.error('Ask failed: ' + e.message),
  });
