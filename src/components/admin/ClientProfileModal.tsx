import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, MessageSquare, FileText, History, Phone, Mail, Send, Upload, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/hooks/useVehicles';

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
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      // Comments stored in notes field for now until types regenerate
      toast.info('Comment functionality will be available after database sync');
    },
    onSuccess: () => {
      setNewComment('');
    },
  });

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment);
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    try {
      const fileName = `${record.customer_id}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('client-docs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      toast.success('Document uploaded to storage');
    } catch (error: any) {
      toast.error('Failed to upload: ' + error.message);
    } finally {
      setIsUploadingDoc(false);
    }
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
                  <p className="text-center text-muted-foreground py-8">No comments yet</p>
                </ScrollArea>
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Textarea
                    placeholder="Add a note..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="h-full flex flex-col p-6">
                <ScrollArea className="flex-1 pr-4">
                  <p className="text-center text-muted-foreground py-8">No documents uploaded</p>
                </ScrollArea>
                <div className="mt-4 pt-4 border-t border-border">
                  <label className="cursor-pointer">
                    <input type="file" onChange={handleUploadDocument} className="hidden" disabled={isUploadingDoc} />
                    <Button asChild disabled={isUploadingDoc}>
                      <span className="gap-2">
                        {isUploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Upload Document
                      </span>
                    </Button>
                  </label>
                </div>
              </TabsContent>

              {/* Audit Log Tab */}
              <TabsContent value="audit" className="h-full p-6">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-3">
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
