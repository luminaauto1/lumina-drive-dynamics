import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, MessageSquare, FileText, History, Phone, Mail, Send, Upload, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/hooks/useVehicles';
import DocumentManager from '@/components/admin/DocumentManager';

interface ClientProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: {
    id: string;
    customer_id: string;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string | null;
    sale_date: string;
    notes: string | null;
    finance_application_id: string | null;
    vehicle?: {
      make: string;
      model: string;
      variant: string | null;
      year: number;
      price: number;
    };
  };
}

const ClientProfileModal = ({ isOpen, onClose, record }: ClientProfileModalProps) => {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Comments + audit timeline live in client_audit_logs (the same canonical store
  // the Client Hub and Client Profile read), keyed by the client's email/phone —
  // so a note added here shows up everywhere, not just in this popup.
  const logKey = record.customer_email || record.customer_phone || record.customer_id;
  const { data: logs = [] } = useQuery({
    queryKey: ['client-audit-logs', logKey],
    enabled: isOpen,
    queryFn: async () => {
      const filters: string[] = [];
      if (record.customer_email) filters.push(`client_email.eq.${record.customer_email}`);
      if (record.customer_phone) filters.push(`client_phone.eq.${record.customer_phone}`);
      if (!filters.length) return [] as any[];
      const { data } = await supabase
        .from('client_audit_logs')
        .select('*')
        .or(filters.join(','))
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (!record.customer_email && !record.customer_phone) {
        throw new Error('Client has no email or phone to attach the note to');
      }
      const { error } = await supabase.from('client_audit_logs').insert({
        client_email: record.customer_email,
        client_phone: record.customer_phone,
        author_id: user.id,
        author_name: user.email || 'Admin',
        action_type: 'note',
        note: content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['client-audit-logs', logKey] });
      toast.success('Comment saved');
    },
    onError: (e: any) => toast.error('Failed to save comment: ' + e.message),
  });

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{record.customer_name}</h2>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {record.customer_email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {record.customer_email}
                    </span>
                  )}
                  {record.customer_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {record.customer_phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4">
              <TabsTrigger value="overview" className="gap-2">
                <User className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="comments" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-2">
                <FileText className="w-4 h-4" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2">
                <History className="w-4 h-4" />
                Audit Log
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              {/* Overview Tab */}
              <TabsContent value="overview" className="h-full p-6">
                <div className="space-y-6">
                  {record.vehicle && (
                    <div className="glass-card rounded-lg p-4">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Vehicle Purchased</h3>
                      <p className="font-semibold text-lg">
                        {record.vehicle.year} {record.vehicle.make} {record.vehicle.model}
                      </p>
                      <p className="text-muted-foreground">{record.vehicle.variant}</p>
                      <p className="text-primary font-medium mt-1">{formatPrice(record.vehicle.price)}</p>
                    </div>
                  )}
                  <div className="glass-card rounded-lg p-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Sale Date</h3>
                    <p className="font-medium">{format(new Date(record.sale_date), 'dd MMMM yyyy')}</p>
                  </div>
                  <div className="glass-card rounded-lg p-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
                    <p className="text-muted-foreground">{record.notes || 'No notes added yet.'}</p>
                  </div>
                </div>
              </TabsContent>

              {/* Comments Tab */}
              <TabsContent value="comments" className="h-full flex flex-col p-6">
                <ScrollArea className="flex-1 pr-4">
                  {logs.filter((l: any) => l.action_type === 'note').length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No comments yet</p>
                  ) : (
                    <div className="space-y-3">
                      {logs.filter((l: any) => l.action_type === 'note').map((l: any) => (
                        <div key={l.id} className="glass-card rounded-lg p-3">
                          <p className="text-sm whitespace-pre-wrap">{l.note}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {l.author_name || 'Admin'} • {format(new Date(l.created_at), 'dd MMM yyyy, HH:mm')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Textarea
                    placeholder="Add a note..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button onClick={handleAddComment} disabled={!newComment.trim() || addCommentMutation.isPending}>
                    {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </TabsContent>

              {/* Documents Tab — uses the canonical documents system (uploads are readable everywhere) */}
              <TabsContent value="documents" className="h-full p-6 overflow-y-auto">
                <DocumentManager
                  title="Client documents"
                  description="Uploads here appear on the client's profile and deal room."
                  category="client"
                  clientId={record.customer_id || undefined}
                  applicationId={record.finance_application_id || undefined}
                />
              </TabsContent>

              {/* Audit Log Tab */}
              <TabsContent value="audit" className="h-full p-6">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-3">
                    {logs.map((l: any) => (
                      <div key={l.id} className="glass-card rounded-lg p-3 flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <p className="text-sm capitalize">{(l.action_type || 'note').replace(/_/g, ' ')}{l.note ? `: ${l.note}` : ''}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.author_name || 'Admin'} • {format(new Date(l.created_at), 'dd MMM yyyy, HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="glass-card rounded-lg p-3 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <div>
                        <p className="text-sm">Sale finalized</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(record.sale_date), 'dd MMM yyyy, HH:mm')}</p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ClientProfileModal;
