import { useState } from 'react';
import { format } from 'date-fns';
import { X, Phone, Mail, Car, MessageSquare, Plus, Trash2, Send, MoreVertical, Key, CreditCard, ArrowRight, Clock } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lead } from '@/hooks/useLeads';
import { useClientActivities, useCreateClientActivity } from '@/hooks/useClientActivities';
import { useDealAddOns, useCreateDealAddOn, useDeleteDealAddOn } from '@/hooks/useDealAddOns';
import { formatPrice } from '@/hooks/useVehicles';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface ClientGenomeDrawerProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ClientGenomeDrawer = ({ lead, open, onOpenChange }: ClientGenomeDrawerProps) => {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [newAddOn, setNewAddOn] = useState({ item_name: '', cost_price: 0, selling_price: 0 });
  
  const { data: activities = [] } = useClientActivities(lead?.id);
  const { data: addOns = [] } = useDealAddOns(undefined, lead?.id);
  const createActivity = useCreateClientActivity();
  const createAddOn = useCreateDealAddOn();
  const deleteAddOn = useDeleteDealAddOn();

  if (!lead) return null;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      contacted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      sold: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      dead: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return styles[status] || styles.new;
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      // Save to client_comments
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('client_comments').insert({
        client_id: lead.id,
        admin_id: user.id,
        content: newComment,
      });

      // Log activity
      await createActivity.mutateAsync({
        lead_id: lead.id,
        application_id: null,
        action_type: 'note_added',
        description: newComment,
        metadata: { by: user.email },
      });

      setNewComment('');
      toast.success('Comment added');
      queryClient.invalidateQueries({ queryKey: ['client-activities'] });
    } catch (error: any) {
      toast.error('Failed to add comment: ' + error.message);
    }
  };

  const handleAddAddOn = async () => {
    if (!newAddOn.item_name.trim()) return;

    await createAddOn.mutateAsync({
      deal_id: null,
      application_id: lead.id,
      item_name: newAddOn.item_name,
      cost_price: newAddOn.cost_price,
      selling_price: newAddOn.selling_price,
      category: 'lead',
    });

    setNewAddOn({ item_name: '', cost_price: 0, selling_price: 0 });
  };

  const handleGenerateOTP = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    toast.success(`OTP Generated: ${otp}`, { duration: 10000 });
    
    createActivity.mutateAsync({
      lead_id: lead.id,
      application_id: null,
      action_type: 'otp_generated',
      description: `OTP ${otp} generated for verification`,
      metadata: { otp },
    });
  };

  const getActivityIcon = (actionType: string) => {
    switch (actionType) {
      case 'status_change': return <ArrowRight className="w-4 h-4" />;
      case 'note_added': return <MessageSquare className="w-4 h-4" />;
      case 'otp_generated': return <Key className="w-4 h-4" />;
      case 'viewed_car': return <Car className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const addOnProfit = addOns.reduce((sum, addon) => sum + (addon.selling_price - addon.cost_price), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-2xl mb-2">{lead.client_name || 'Unknown Client'}</SheetTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={getStatusBadge(lead.status)}>{lead.status}</Badge>
                <span className="text-sm text-muted-foreground">{lead.source}</span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleGenerateOTP}>
                  <Key className="w-4 h-4 mr-2" />
                  Generate OTP
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CreditCard className="w-4 h-4 mr-2" />
                  View Finance Podium
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Move to Aftersales
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Contact Info */}
          <div className="flex flex-wrap gap-4 mt-4">
            {lead.client_phone && (
              <a href={`tel:${lead.client_phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Phone className="w-4 h-4" />
                {lead.client_phone}
              </a>
            )}
            {lead.client_email && (
              <a href={`mailto:${lead.client_email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Mail className="w-4 h-4" />
                {lead.client_email}
              </a>
            )}
          </div>

          {/* Vehicle Interest */}
          {lead.vehicle && (
            <div className="flex items-center gap-2 mt-3 p-3 bg-secondary/50 rounded-lg">
              <Car className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-emerald-400 font-medium">{formatPrice((lead.vehicle as any).price || 0)}</span>
            </div>
          )}
        </SheetHeader>

        {/* Content Tabs */}
        <Tabs defaultValue="timeline" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="addons">Add-ons</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="flex-1 overflow-hidden px-6 pb-6">
            <ScrollArea className="h-full">
              {activities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No activity yet</p>
                  <p className="text-sm">Interactions will appear here</p>
                </div>
              ) : (
                <div className="relative space-y-0">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                  
                  {activities.map((activity, index) => (
                    <div key={activity.id} className="relative flex gap-4 pb-6">
                      <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-secondary border border-border">
                        {getActivityIcon(activity.action_type)}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium capitalize">
                            {activity.action_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(activity.created_at), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Add-ons Tab */}
          <TabsContent value="addons" className="flex-1 overflow-hidden px-6 pb-6">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {/* Add new add-on */}
                <div className="p-4 border border-dashed border-border rounded-lg space-y-3">
                  <h4 className="font-medium text-sm">Add Potential Extra</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Input 
                      placeholder="Item name"
                      value={newAddOn.item_name}
                      onChange={(e) => setNewAddOn({ ...newAddOn, item_name: e.target.value })}
                    />
                    <Input 
                      type="number"
                      placeholder="Cost"
                      value={newAddOn.cost_price || ''}
                      onChange={(e) => setNewAddOn({ ...newAddOn, cost_price: parseFloat(e.target.value) || 0 })}
                    />
                    <Input 
                      type="number"
                      placeholder="Sell for"
                      value={newAddOn.selling_price || ''}
                      onChange={(e) => setNewAddOn({ ...newAddOn, selling_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <Button onClick={handleAddAddOn} size="sm" className="w-full" disabled={!newAddOn.item_name}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Extra
                  </Button>
                </div>

                <Separator />

                {/* Add-ons list */}
                {addOns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No add-ons yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {addOns.map((addon) => (
                      <div key={addon.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                        <div>
                          <p className="font-medium">{addon.item_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Cost: {formatPrice(addon.cost_price)} → Sell: {formatPrice(addon.selling_price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${addon.selling_price - addon.cost_price >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            +{formatPrice(addon.selling_price - addon.cost_price)}
                          </span>
                          <Button variant="ghost" size="icon" onClick={() => deleteAddOn.mutate(addon.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Total profit from add-ons */}
                    <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-lg mt-4">
                      <span className="font-medium">Total Add-on Profit</span>
                      <span className="font-bold text-emerald-400">{formatPrice(addOnProfit)}</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  {activities.filter(a => a.action_type === 'note_added').map((note) => (
                    <div key={note.id} className="p-3 bg-secondary/50 rounded-lg">
                      <p className="text-sm">{note.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  ))}
                  {activities.filter(a => a.action_type === 'note_added').length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No internal notes yet</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
            
            {/* Add Comment */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              <Textarea 
                placeholder="Add internal note..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 min-h-[80px]"
              />
              <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default ClientGenomeDrawer;
