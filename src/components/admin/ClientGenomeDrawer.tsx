import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Phone, Mail, MessageCircle, Send, MoreVertical, Key, CreditCard, 
  ArrowRight, Clock, Heart, FileText, User, Activity, Sparkles, 
  Flame, Snowflake, UserCheck, Plus, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { CRMProfile, useUpdateCRMProfile, useLeadNotes, useCreateLeadNote, useProfileWishlist, useProfileApplications } from '@/hooks/useCRM';
import { useClientActivities } from '@/hooks/useClientActivities';
import { formatPrice } from '@/hooks/useVehicles';
import { toast } from 'sonner';

interface ClientGenomeDrawerProps {
  profile: CRMProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ClientGenomeDrawer = ({ profile, open, onOpenChange }: ClientGenomeDrawerProps) => {
  const navigate = useNavigate();
  const [newNote, setNewNote] = useState('');
  
  const { data: notes = [] } = useLeadNotes(profile?.id);
  const { data: wishlistItems = [] } = useProfileWishlist(profile?.user_id);
  const { data: applications = [] } = useProfileApplications(profile?.user_id);
  const { data: activities = [] } = useClientActivities(undefined, profile?.finance_applications?.[0]?.id);
  
  const updateProfile = useUpdateCRMProfile();
  const createNote = useCreateLeadNote();

  if (!profile) return null;

  const handleStatusChange = async (newStatus: string) => {
    await updateProfile.mutateAsync({
      id: profile.id,
      updates: { 
        internal_status: newStatus,
        last_contacted_at: new Date().toISOString(),
      },
    });
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    await createNote.mutateAsync({
      profile_id: profile.id,
      content: newNote,
    });
    
    setNewNote('');
  };

  const handleGenerateOTP = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    toast.success(`OTP Generated: ${otp}`, { duration: 10000 });
  };

  const openWhatsApp = () => {
    if (!profile.phone) return;
    const cleanPhone = profile.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Sparkles className="w-4 h-4" />;
      case 'contacted': return <Phone className="w-4 h-4" />;
      case 'warm': return <Flame className="w-4 h-4" />;
      case 'cold': return <Snowflake className="w-4 h-4" />;
      case 'converted': return <UserCheck className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getStatusStyles = (status: string) => {
    const styles: Record<string, string> = {
      new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      contacted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      warm: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      cold: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      converted: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    };
    return styles[status] || styles.new;
  };

  const getActivityIcon = (actionType: string) => {
    switch (actionType) {
      case 'status_change': return <ArrowRight className="w-4 h-4" />;
      case 'note_added': return <FileText className="w-4 h-4" />;
      case 'otp_generated': return <Key className="w-4 h-4" />;
      case 'page_view': return <Activity className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-2xl mb-2">{profile.full_name || 'Unknown Client'}</SheetTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className={`${getStatusStyles(profile.internal_status || 'new')} flex items-center gap-1`}>
                  {getStatusIcon(profile.internal_status || 'new')}
                  {profile.internal_status || 'new'}
                </Badge>
                {profile.last_active_at && (
                  <span className="text-sm text-muted-foreground">
                    Last active {formatDistanceToNow(new Date(profile.last_active_at), { addSuffix: true })}
                  </span>
                )}
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
                <DropdownMenuItem onClick={() => navigate('/admin/finance')}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  View in Deal Room
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/admin/aftersales')}>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Move to Aftersales
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Contact Info & Quick Actions */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Phone className="w-4 h-4" />
                {profile.phone}
              </a>
            )}
            {profile.email && (
              <a href={`mailto:${profile.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Mail className="w-4 h-4" />
                {profile.email}
              </a>
            )}
            {profile.phone && (
              <Button variant="outline" size="sm" onClick={openWhatsApp} className="text-emerald-400 border-emerald-400/30">
                <MessageCircle className="w-4 h-4 mr-1" />
                WhatsApp
              </Button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-muted-foreground">Internal Status:</span>
            <Select value={profile.internal_status || 'new'} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">🆕 New</SelectItem>
                <SelectItem value="contacted">📞 Contacted</SelectItem>
                <SelectItem value="warm">🔥 Warm</SelectItem>
                <SelectItem value="cold">❄️ Cold</SelectItem>
                <SelectItem value="converted">✅ Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>

        {/* Content Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 w-fit">
            <TabsTrigger value="overview" className="gap-1">
              <User className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1">
              <FileText className="w-4 h-4" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1">
              <Activity className="w-4 h-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="wishlist" className="gap-1">
              <Heart className="w-4 h-4" />
              Wishlist
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-1">
              <CreditCard className="w-4 h-4" />
              Finance
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 overflow-hidden px-6 pb-6">
            <ScrollArea className="h-full">
              <div className="space-y-4 pt-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Heart className="w-5 h-5 mx-auto mb-1 text-pink-400" />
                      <p className="text-2xl font-bold">{profile.wishlist_count}</p>
                      <p className="text-xs text-muted-foreground">Wishlist</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <CreditCard className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                      <p className="text-2xl font-bold">{profile.finance_applications.length}</p>
                      <p className="text-xs text-muted-foreground">Applications</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <FileText className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                      <p className="text-2xl font-bold">{profile.leads.length}</p>
                      <p className="text-xs text-muted-foreground">Inquiries</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Contact Details */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Contact Details</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Email</span>
                        <span className="text-sm font-medium">{profile.email || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Phone</span>
                        <span className="text-sm font-medium">{profile.phone || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Member Since</span>
                        <span className="text-sm font-medium">
                          {format(new Date(profile.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {profile.last_contacted_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Last Contacted</span>
                          <span className="text-sm font-medium">
                            {format(new Date(profile.last_contacted_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Lead Inquiries */}
                {profile.leads.length > 0 && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Recent Inquiries</h4>
                      <div className="space-y-2">
                        {profile.leads.slice(0, 3).map((lead) => (
                          <div key={lead.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
                            <div>
                              <Badge variant="outline" className="text-xs">{lead.source}</Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(lead.created_at), 'MMM d, yyyy')}
                              </p>
                            </div>
                            <Badge className={lead.status === 'new' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}>
                              {lead.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
            <div className="flex-1 overflow-hidden pt-4">
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No notes yet</p>
                      <p className="text-sm">Add internal notes about this client</p>
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="p-3 bg-secondary/50 rounded-lg">
                        <p className="text-sm">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            
            {/* Add Note */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              <Textarea 
                placeholder="Add internal note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1 min-h-[80px]"
              />
              <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="flex-1 overflow-hidden px-6 pb-6">
            <ScrollArea className="h-full pt-4">
              {activities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No activity recorded</p>
                  <p className="text-sm">Page views and interactions will appear here</p>
                </div>
              ) : (
                <div className="relative space-y-0">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                  
                  {activities.map((activity) => (
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

          {/* Wishlist Tab */}
          <TabsContent value="wishlist" className="flex-1 overflow-hidden px-6 pb-6">
            <ScrollArea className="h-full pt-4">
              {wishlistItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No saved vehicles</p>
                  <p className="text-sm">Cars they save will appear here</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {wishlistItems.map((item: any) => (
                    <Card key={item.id} className="overflow-hidden">
                      <CardContent className="p-0 flex">
                        {item.vehicle?.images?.[0] && (
                          <div className="w-24 h-20 flex-shrink-0">
                            <img 
                              src={item.vehicle.images[0]} 
                              alt={`${item.vehicle.make} ${item.vehicle.model}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-3 flex-1">
                          <p className="font-medium text-sm">
                            {item.vehicle?.year} {item.vehicle?.make} {item.vehicle?.model}
                          </p>
                          <p className="text-emerald-400 font-semibold text-sm">
                            {formatPrice(item.vehicle?.price || 0)}
                          </p>
                          <Badge variant="outline" className="text-xs mt-1 capitalize">
                            {item.vehicle?.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance" className="flex-1 overflow-hidden px-6 pb-6">
            <ScrollArea className="h-full pt-4">
              {applications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No finance applications</p>
                  <p className="text-sm mb-4">This client hasn't applied for finance yet</p>
                  <Button 
                    onClick={() => navigate('/admin/finance/create', { 
                      state: { 
                        prefillEmail: profile.email,
                        prefillPhone: profile.phone,
                        prefillName: profile.full_name 
                      } 
                    })} 
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Application
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {applications.map((app: any) => {
                    const statusStyles: Record<string, string> = {
                      pending: 'bg-gray-500/20 text-gray-400',
                      'application_submitted': 'bg-blue-500/20 text-blue-400',
                      'pre_approved': 'bg-purple-500/20 text-purple-400',
                      'docs_received': 'bg-amber-500/20 text-amber-400',
                      'vehicle_delivered': 'bg-emerald-500/20 text-emerald-400',
                    };
                    
                    return (
                      <Card key={app.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <Badge className={`${statusStyles[app.status] || statusStyles.pending} capitalize`}>
                                {app.status.replace(/_/g, ' ')}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                Applied {format(new Date(app.created_at), 'MMM d, yyyy')}
                              </p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate('/admin/finance')}
                              className="text-blue-400"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </div>
                          
                          {app.vehicle && (
                            <div className="p-2 bg-secondary/50 rounded-lg">
                              <p className="text-sm font-medium">
                                {app.vehicle.year} {app.vehicle.make} {app.vehicle.model}
                              </p>
                              <p className="text-emerald-400 text-sm">
                                {formatPrice(app.vehicle.price)}
                              </p>
                            </div>
                          )}
                          
                          {app.approved_budget && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Approved Budget</span>
                                <span className="font-semibold text-emerald-400">
                                  {formatPrice(app.approved_budget)}
                                </span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default ClientGenomeDrawer;
