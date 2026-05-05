import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import UniversalClientHub from '@/components/admin/UniversalClientHub';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { isToday } from 'date-fns';
import { Search, MessageCircle, ExternalLink, Trash2, Archive, UserPlus, Copy, Link, ClipboardList, Banknote, Calculator, MailWarning, MessageSquare } from 'lucide-react';
import WhatsAppParserModal from '@/components/admin/WhatsAppParserModal';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useFinanceApplications, useUpdateFinanceApplication, useDeleteFinanceApplication, FinanceApplication } from '@/hooks/useFinanceApplications';
import { formatPrice } from '@/hooks/useVehicles';
import { STATUS_OPTIONS, STATUS_STYLES, ADMIN_STATUS_LABELS, getWhatsAppMessage, canShowDealActions } from '@/lib/statusConfig';
import { INTERNAL_STATUSES, type InternalStatus } from '@/lib/internalStatusConfig';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUploadLink } from '@/lib/appConfig';
import DeliveryChecklistModal from '@/components/admin/DeliveryChecklistModal';
import QuickCashDealModal from '@/components/admin/QuickCashDealModal';
import { useAuth } from '@/contexts/AuthContext';
const FINANCE_INFO_REQUEST_TEMPLATE = `*Lumina Auto | Finance Application Request*

Hi, to assist you with your finance application manually, please reply with the following details:

Personal Details:
1. Full Names:
2. Surname:
3. ID Number:
4. Email Address:
5. Cell Number:
6. Marital Status:
7. Physical Address (with Code):

Employment:
8. Current Employer:
9. Job Title:
10. Start Date (Year/Month):
11. Employment Status (Permanent/Contract/Self):

Financials:
12. Gross Salary (Basic): R
13. Net Salary (In Bank): R
14. Total Living Expenses (Est): R
15. Bank Name:

Next of Kin (Relative not living with you):
16. Name & Relation:
17. Contact Number:

Please also send clear photos/PDFs of:
• ID Card
• Driver's License
• Latest 3 Months Payslips
• Latest 3 Months Bank Statements
• Proof of Residence`;

const AdminFinance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [selectedAppForDelivery, setSelectedAppForDelivery] = useState<FinanceApplication | null>(null);
  const [cashDealModalOpen, setCashDealModalOpen] = useState(false);
  const [waModalOpen, setWaModalOpen] = useState(false);

  // Universal Client Hub state
  const [hubOpen, setHubOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | undefined>();
  const [selectedPhone, setSelectedPhone] = useState<string | undefined>();

  const openClientHub = (email?: string, phone?: string) => {
    setSelectedEmail(email || undefined);
    setSelectedPhone(phone || undefined);
    setHubOpen(true);
  };

  // CRM Audit Trail Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [pendingApp, setPendingApp] = useState<any>(null);
  const [pendingStatus, setPendingStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');

  const { data: applications = [], isLoading, refetch } = useFinanceApplications();
  const updateApplication = useUpdateFinanceApplication();
  const deleteApplication = useDeleteFinanceApplication();

  const copyInfoRequestTemplate = async () => {
    try {
      await navigator.clipboard.writeText(FINANCE_INFO_REQUEST_TEMPLATE);
      toast({
        title: "Template copied to clipboard",
        description: "Paste it in WhatsApp to request finance info from clients.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const copyUploadLink = async (accessToken: string) => {
    try {
      const link = getUploadLink(accessToken);
      await navigator.clipboard.writeText(link);
      toast({
        title: "Upload link copied!",
        description: "Send this link to the client to upload their documents.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const getDisplayStatus = (app: any): InternalStatus => {
    if (!app.attention_updated_at || !isToday(new Date(app.attention_updated_at))) {
      return 'give_attention';
    }
    if (!INTERNAL_STATUSES[app.internal_status as keyof typeof INTERNAL_STATUSES]) {
      return 'give_attention';
    }
    return app.internal_status as InternalStatus;
  };

  const filteredApplications = applications.filter(app => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      app.full_name?.toLowerCase().includes(searchLower) ||
      app.first_name?.toLowerCase().includes(searchLower) ||
      app.last_name?.toLowerCase().includes(searchLower) ||
      app.email?.toLowerCase().includes(searchLower) ||
      app.id_number?.includes(searchQuery) ||
      app.phone?.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    
    // Filter by active/archived — terminal states auto-hide from active view
    const s = (app.status || '').toLowerCase().trim();
    const isTerminal = ['finalized', 'delivered', 'vehicle_delivered', 'archived', 'declined', 'blacklisted'].includes(s);
    const matchesViewMode = viewMode === 'archived' ? isTerminal : !isTerminal;

    return matchesSearch && matchesStatus && matchesViewMode;
  });

  const handleStatusDropdownChange = (app: any, newStatus: string) => {
    setPendingApp(app);
    setPendingStatus(newStatus);
    setStatusNote('');
    setStatusModalOpen(true);
  };

  const confirmStatusUpdate = async () => {
    if (!pendingApp || !pendingStatus) return;
    try {
      // Auto-Archive Logic: Declined/Lost are immediately archived
      const isTerminal = pendingStatus === 'declined' || pendingStatus === 'lost';
      const finalStatus = isTerminal ? 'archived' : pendingStatus;

      let updatedNotes = pendingApp.notes || '';
      if (statusNote.trim()) {
        const timestamp = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const statusLabel = INTERNAL_STATUSES[pendingStatus as keyof typeof INTERNAL_STATUSES]?.label || pendingStatus;
        const newEntry = `[${timestamp}] ${statusLabel}: ${statusNote}`;
        updatedNotes = updatedNotes ? `${newEntry}\n\n${updatedNotes}` : newEntry;
      }
      const updatePayload: any = {
        internal_status: finalStatus,
        attention_updated_at: new Date().toISOString(),
        notes: updatedNotes,
      };
      if (isTerminal) {
        updatePayload.status = 'archived';
      }
      const { error } = await supabase
        .from('finance_applications')
        .update(updatePayload)
        .eq('id', pendingApp.id);
      if (error) throw error;

      // Dual-sync: Push to Global Universal Timeline
      await supabase.from('client_audit_logs').insert([{
        client_email: pendingApp.email || null,
        client_phone: pendingApp.phone || null,
        note: `[Finance Stage Updated to ${INTERNAL_STATUSES[pendingStatus as keyof typeof INTERNAL_STATUSES]?.label || pendingStatus}] ${statusNote || 'No comment'}`,
        author_name: 'F&I Admin',
        action_type: 'Status Update'
      }]);

      toast({ title: "Status & CRM notes updated" });
      refetch();
    } catch (error: any) {
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setStatusModalOpen(false);
      setPendingApp(null);
      setPendingStatus('');
      setStatusNote('');
    }
  };

  const openDeliveryModal = (app: FinanceApplication, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAppForDelivery(app);
    setDeliveryModalOpen(true);
  };

  const openWhatsApp = (app: FinanceApplication) => {
    const phone = app.phone?.replace(/\D/g, '') || '';
    const formattedPhone = phone.startsWith('0') ? `27${phone.slice(1)}` : phone;
    const name = app.first_name || app.full_name?.split(' ')[0] || 'Customer';
    const message = getWhatsAppMessage(app.status, name);
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleArchive = async (app: FinanceApplication, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateApplication.mutateAsync({ id: app.id, updates: { status: 'archived' } });
  };

  const handleDelete = async (appId: string) => {
    await deleteApplication.mutateAsync(appId);
  };

  const handleRequestRevision = async (app: FinanceApplication, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Update status to needs_revision
      await updateApplication.mutateAsync({ 
        id: app.id, 
        updates: { status: 'needs_revision' } as any 
      });

      // Send revision email via edge function
      const editLink = `https://luminaauto.co.za/finance-application?edit=${app.id}`;
      const clientName = app.first_name || app.full_name?.split(' ')[0] || 'Client';
      
      const { publicApiHeaders } = await import('@/lib/publicApi');
      await supabase.functions.invoke('send-email', {
        headers: publicApiHeaders(),
        body: {
          to: ['lumina.auto1@gmail.com'],
          subject: `Revision Required: ${app.full_name}'s Finance Application`,
          html: `
            <h2>Client Revision Request</h2>
            <p><strong>${app.full_name}</strong> needs to revise their finance application.</p>
            <p>Forward this link to the client at <strong>${app.email}</strong>:</p>
            <p><a href="${editLink}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;">Revise Application</a></p>
            <p>Direct link: ${editLink}</p>
          `,
        },
      });

      // Also copy the revision link for WhatsApp
      await navigator.clipboard.writeText(editLink);

      toast({
        title: "Revision requested",
        description: `Status updated & revision link copied to clipboard. Send it to ${clientName}.`,
      });
    } catch (error: any) {
      toast({ title: "Failed to request revision", variant: "destructive" });
      console.error('Revision request error:', error);
    }
  };

  // Stats for active applications only
  const activeApps = applications.filter(a => !['finalized', 'delivered', 'vehicle_delivered', 'archived', 'declined'].includes((a.status || '').toLowerCase().trim()));

  return (
    <AdminLayout>
      <Helmet>
        <title>Finance Applications | Lumina Auto Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-semibold mb-2">Finance Applications</h1>
            <p className="text-muted-foreground">Manage and process finance applications</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyInfoRequestTemplate} className="w-fit">
              <Copy className="w-4 h-4 mr-2" />
              Copy Info Request
            </Button>
            <Button variant="outline" onClick={() => setCashDealModalOpen(true)} className="w-fit">
              <Banknote className="w-4 h-4 mr-2" />
              Cash Deal
            </Button>
            <Button variant="outline" onClick={() => setWaModalOpen(true)} className="w-fit">
              <MessageSquare className="w-4 h-4 mr-2 text-emerald-500" />
              WhatsApp to PDF
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/quotes')} className="w-fit">
              <Calculator className="w-4 h-4 mr-2" />
              Quote Generator
            </Button>
            <Button onClick={() => navigate('/admin/finance/create')} className="w-fit">
              <UserPlus className="w-4 h-4 mr-2" />
              Create Application
            </Button>
          </div>
        </motion.div>

        {/* View Mode Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'active' | 'archived')}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col md:flex-row gap-4 mb-6"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6"
        >
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-amber-400">{activeApps.filter(a => a.status === 'pending').length}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-blue-400">{activeApps.filter(a => a.status === 'validations_pending').length}</p>
            <p className="text-sm text-muted-foreground">Validations</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-emerald-400">{activeApps.filter(a => a.status === 'approved').length}</p>
            <p className="text-sm text-muted-foreground">Budget Confirmed</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-purple-400">{activeApps.filter(a => a.status === 'vehicle_selected').length}</p>
            <p className="text-sm text-muted-foreground">Vehicle Selected</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-red-400">{activeApps.filter(a => a.status === 'declined').length}</p>
            <p className="text-sm text-muted-foreground">Declined</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold">{activeApps.length}</p>
            <p className="text-sm text-muted-foreground">Total Active</p>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery || statusFilter !== 'all' ? 'No applications match your filters' : 
                viewMode === 'archived' ? 'No archived applications' : 'No finance applications yet'}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Mobile</TableHead>
                  <TableHead className="text-muted-foreground">Net Salary</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Internal</TableHead>
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app) => {
                  const cleanedPhone = app.phone?.replace(/\D/g, '') || '';
                  const whatsAppPhone = cleanedPhone.startsWith('0') ? `27${cleanedPhone.slice(1)}` : cleanedPhone;
                  
                  // Warning conditions
                  const lowSalary = app.net_salary && app.net_salary < 8500;
                  const noLicense = (app as any).has_drivers_license === false;
                  const cs = ((app as any).credit_score_status || '') as string;
                  const HIGH_RISK_CREDIT_LABELS: Record<string, string> = {
                    blacklisted: 'Blacklisted',
                    debt_review: 'Debt Review',
                    judgements: 'Judgements',
                    defaults_arrears: 'Defaults/Arrears',
                    bad: 'Bad Credit',
                  };
                  const creditRiskLabel = HIGH_RISK_CREDIT_LABELS[cs];
                  // Hierarchy: credit risk supersedes license
                  const riskReason = creditRiskLabel
                    ? `Risk: ${creditRiskLabel}`
                    : noLicense
                    ? 'Risk: No License'
                    : null;

                  // Freshness & stagnation
                  const isNew = (Date.now() - new Date(app.created_at).getTime()) < (24 * 60 * 60 * 1000);
                  const isStagnant = (Date.now() - new Date(app.updated_at || app.created_at).getTime()) > (72 * 60 * 60 * 1000);
                  
                  return (
                  <TableRow 
                    key={app.id} 
                    className={`border-white/10 hover:bg-white/5 cursor-pointer ${isNew ? 'bg-emerald-500/5' : ''} ${isStagnant ? 'bg-orange-500/5' : ''}`}
                    onClick={() => navigate(`/admin/finance/${app.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.preventDefault(); openClientHub(app.email, app.phone); }}
                          className="hover:text-emerald-400 hover:underline cursor-pointer text-left focus:outline-none"
                        >
                          <p className="font-medium">{app.first_name} {app.last_name}</p>
                          <p className="text-xs text-muted-foreground">{app.email}</p>
                        </button>
                        {isNew && (
                          <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                            🔥 NEW
                          </span>
                        )}
                        {isStagnant && !isNew && (
                          <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            ⏳ STALE
                          </span>
                        )}
                        {riskReason && (
                          <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30" title={riskReason}>
                            ⚠ {riskReason}
                          </span>
                        )}
                        {(() => {
                          const src = (app as any).submission_source;
                          let label: string | null = null;
                          if (src === 'whatsapp_parser') label = 'WhatsApp PDF';
                          else if (src === 'website') label = 'Website';
                          else if (src && String(src).trim() !== '') label = String(src);
                          else label = 'Legacy';
                          return (
                            <span
                              className="px-1.5 py-0.5 text-[10px] uppercase tracking-wider rounded border border-white/10 bg-white/5 text-white/60"
                              title={`Source: ${label}`}
                            >
                              {label}
                            </span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {app.phone ? (
                        <a
                          href={`https://wa.me/${whatsAppPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm text-green-500 hover:text-green-400 transition-colors"
                          title="Open WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4 fill-green-500/20" />
                          {app.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className={lowSalary ? 'text-red-400 font-medium' : ''}>
                        {app.net_salary ? formatPrice(app.net_salary) : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={app.status}
                        onValueChange={async (newStatus) => {
                          if (newStatus === app.status) return;
                          try {
                            await updateApplication.mutateAsync({ id: app.id, updates: { status: newStatus } });
                          } catch (err) {
                            // Toast handled by hook on error
                          }
                        }}
                      >
                        <SelectTrigger
                          className={`w-[180px] h-7 text-xs uppercase tracking-wider border ${STATUS_STYLES[app.status] || STATUS_STYLES.pending}`}
                        >
                          <SelectValue>
                            {ADMIN_STATUS_LABELS[app.status] || app.status}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {ADMIN_STATUS_LABELS[opt.value] || opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const safeStatusKey = getDisplayStatus(app);
                        const statusConfig = INTERNAL_STATUSES[safeStatusKey as keyof typeof INTERNAL_STATUSES] || INTERNAL_STATUSES.give_attention;
                        return (
                          <Select 
                            value={safeStatusKey} 
                            onValueChange={(value) => handleStatusDropdownChange(app, value)}
                          >
                            <SelectTrigger className={`w-[200px] h-7 text-xs border ${statusConfig.color}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.entries(INTERNAL_STATUSES) as [InternalStatus, typeof INTERNAL_STATUSES[InternalStatus]][]).map(([key, val]) => (
                                <SelectItem key={key} value={key} className="text-xs">
                                  {val.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {/* Request Revision */}
                        {['pending', 'application_submitted', 'pre_approved', 'documents_received', 'revision_submitted'].includes(app.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleRequestRevision(app, e)}
                            className="text-pink-500 hover:text-pink-400 hover:bg-pink-500/10"
                            title="Request Client Revision"
                          >
                            <MailWarning className="w-4 h-4" />
                          </Button>
                        )}
                        {/* Delivery Prep - Show for approved/signed statuses */}
                        {['pre_approved', 'approved', 'vehicle_selected', 'contract_signed', 'vehicle_delivered'].includes(app.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => openDeliveryModal(app, e)}
                            className="text-purple-500 hover:text-purple-400 hover:bg-purple-500/10"
                            title="Delivery Prep Checklist"
                          >
                            <ClipboardList className="w-4 h-4" />
                          </Button>
                        )}
                        {/* Copy Upload Link - Show for pre_approved status */}
                        {app.status === 'pre_approved' && (app as any).access_token && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyUploadLink((app as any).access_token)}
                            className="text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                            title="Copy Document Upload Link"
                          >
                            <Link className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openWhatsApp(app)}
                          className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
                          title="Send WhatsApp Update"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/admin/finance/${app.id}`)}
                          title="Open Deal Room"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        {app.status !== 'archived' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleArchive(app, e)}
                            className="text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10"
                            title="Archive Application"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        )}
                        {isSuperAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                title="Delete Application"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Application?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the application for {app.first_name} {app.last_name}. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(app.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </motion.div>

        {/* Delivery Checklist Modal */}
        {selectedAppForDelivery && (
          <DeliveryChecklistModal
            open={deliveryModalOpen}
            onOpenChange={setDeliveryModalOpen}
            applicationId={selectedAppForDelivery.id}
            clientName={`${selectedAppForDelivery.first_name} ${selectedAppForDelivery.last_name}`}
          />
        )}

        {/* Quick Cash Deal Modal */}
        <QuickCashDealModal
          open={cashDealModalOpen}
          onOpenChange={setCashDealModalOpen}
          onCreated={(appId) => navigate(`/admin/finance/${appId}`)}
        />
        {/* CRM Audit Trail Modal */}
        <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Update Status & CRM Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Add a comment for the sales team</Label>
                <Textarea
                  placeholder="E.g. Client called back, awaiting payslips..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              {pendingApp?.notes && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Previous CRM History</Label>
                  <div className="text-xs bg-muted/50 border border-border p-3 rounded-md max-h-[120px] overflow-auto whitespace-pre-wrap text-muted-foreground font-mono">
                    {pendingApp.notes}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStatusModalOpen(false)}>Cancel</Button>
              <Button onClick={confirmStatusUpdate} className="bg-emerald-600 hover:bg-emerald-700 text-white">Save Update</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <UniversalClientHub
        open={hubOpen}
        onOpenChange={setHubOpen}
        clientEmail={selectedEmail}
        clientPhone={selectedPhone}
      />
      <WhatsAppParserModal open={waModalOpen} onOpenChange={setWaModalOpen} />
    </AdminLayout>
  );
};

export default AdminFinance;
