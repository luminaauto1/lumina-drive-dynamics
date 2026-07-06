import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import UniversalClientHub from '@/components/admin/UniversalClientHub';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { isToday } from 'date-fns';
import { Search, MessageCircle, ExternalLink, Trash2, Archive, UserPlus, User, Copy, Link, ClipboardList, Banknote, Calculator, MailWarning, MessageSquare, Globe, FileText, Mail, FileX, BarChart3 } from 'lucide-react';
import WhatsAppParserModal from '@/components/admin/WhatsAppParserModal';
import BankReferenceModal from '@/components/admin/BankReferenceModal';
import BankReferenceBadge from '@/components/admin/BankReferenceBadge';
import CreditCheckReportModal from '@/components/admin/CreditCheckReportModal';
import CreditCheckResultModal, { type CreditCheckOutcome } from '@/components/admin/CreditCheckResultModal';
import AdminLayout from '@/components/admin/AdminLayout';
import PageHeader from '@/components/admin/PageHeader';
import StatTile from '@/components/admin/StatTile';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { sourceLabel } from '@/lib/pipelinev2/source';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useFinanceApplications, useUpdateFinanceApplication, useDeleteFinanceApplication, FinanceApplication } from '@/hooks/useFinanceApplications';
import { formatPrice } from '@/hooks/useVehicles';
import { STATUS_OPTIONS, ADMIN_STATUS_LABELS, STATUS_STEP_ORDER, getWhatsAppMessage, canShowDealActions, statusBadgeClass } from '@/lib/statusConfig';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { useDeskTheme } from '@/hooks/useDeskTheme';
import { filterStatusOptionsForRole } from '@/lib/roleStatusFilter';
import { INTERNAL_STATUSES, type InternalStatus, normalizeInternalStatus } from '@/lib/internalStatusConfig';
import { CommentGateModal } from '@/components/admin/CommentGateModal';
import { addPipelineNote } from '@/lib/pipelinev2/notes';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUploadLink } from '@/lib/appConfig';
import DeliveryChecklistModal from '@/components/admin/DeliveryChecklistModal';
import QuickCashDealModal from '@/components/admin/QuickCashDealModal';
import { useAuth } from '@/contexts/AuthContext';
import { useFAndIUsers } from '@/hooks/useFAndIUsers';
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
  const { isSuperAdmin, isSeniorFAndI, isFAndI, role, user } = useAuth();
  const { theme } = useDeskTheme();
  const { whatsappMessageFor, commentRequiredFor, commentPromptFor } = useStatusConfig();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // F&I owner filter. Everyone can change it.
  // Defaults: admin/senior → 'all'; normal F&I → 'self' (their own apps).
  // Values: 'all' | 'self' | 'unassigned' | <fni user uuid>
  const defaultFniFilter = (isSuperAdmin || isSeniorFAndI) ? 'all' : 'self';
  const [fniFilter, setFniFilter] = useState<string>(defaultFniFilter);
  const { data: fniUsers = [] } = useFAndIUsers();
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [selectedAppForDelivery, setSelectedAppForDelivery] = useState<FinanceApplication | null>(null);
  const [cashDealModalOpen, setCashDealModalOpen] = useState(false);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [creditReportOpen, setCreditReportOpen] = useState(false);
  const [creditCheckOpen, setCreditCheckOpen] = useState(false);
  const [creditCheckApp, setCreditCheckApp] = useState<FinanceApplication | null>(null);
  const [creditCheckOutcome, setCreditCheckOutcome] = useState<CreditCheckOutcome>('passed');
  // Role-restricted notification feed filter (super_admin + senior_f_and_i only).
  // 'auto' = role-default behavior. 'f_and_i' or 'admin' = forced view.
  const [notificationFilter, setNotificationFilter] = useState<'admin' | 'senior' | 'f_and_i'>('admin');

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
  const [pendingLeadName, setPendingLeadName] = useState<string | null>(null);

  // Fetch matching CRM lead headline/name when modal opens for a given app
  useEffect(() => {
    let cancelled = false;
    const fetchLead = async () => {
      if (!statusModalOpen || !pendingApp) { setPendingLeadName(null); return; }
      const email = pendingApp.email;
      const phone = pendingApp.phone;
      if (!email && !phone) { setPendingLeadName(null); return; }
      let q = supabase.from('leads').select('client_name, deal_headline').limit(1);
      if (email && phone) q = q.or(`client_email.eq.${email},client_phone.eq.${phone}`);
      else if (email) q = q.eq('client_email', email);
      else if (phone) q = q.eq('client_phone', phone);
      const { data } = await q.maybeSingle();
      if (cancelled) return;
      const name = (data as any)?.deal_headline || (data as any)?.client_name || null;
      setPendingLeadName(name);
    };
    fetchLead();
    return () => { cancelled = true; };
  }, [statusModalOpen, pendingApp]);

  // Bank Reference capture (when admin moves an app to "Application Submitted")
  const [bankRefModalOpen, setBankRefModalOpen] = useState(false);
  const [bankRefApp, setBankRefApp] = useState<FinanceApplication | null>(null);
  const [bankRefTargetStatus, setBankRefTargetStatus] = useState<string>('application_submitted');
  const [editBankRefApp, setEditBankRefApp] = useState<FinanceApplication | null>(null);
  const [editBankRefOpen, setEditBankRefOpen] = useState(false);
  // Comment-gate interception for the inline status dropdown. When the target
  // status has comment_required, we stash the pending change and pop the gate
  // modal instead of writing immediately.
  const [commentGate, setCommentGate] = useState<{ app: FinanceApplication; status: string } | null>(null);

  // Action Feed → row scroll/highlight
  const [highlightedAppId, setHighlightedAppId] = useState<string | null>(null);

  // Render-as-you-scroll window: how many rows are mounted right now. The full
  // filtered list still drives counts/search/feeds — only the DOM grows in batches.
  const [visibleCount, setVisibleCount] = useState(40);
  const loadMoreRef = useRef<HTMLTableRowElement | null>(null);
  // Row to scroll to after the window expands enough to mount it (Action Feed jump).
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  const focusApplicationRow = (app: FinanceApplication) => {
    // With scroll-loading, the target row may be past the current window — expand it
    // so the row is mounted, then let the effect below scroll once React commits it.
    const idx = filteredApplications.findIndex((a) => a.id === app.id);
    if (idx >= 0) setVisibleCount((c) => Math.max(c, idx + 5));
    setPendingScrollId(app.id);
    setHighlightedAppId(app.id);
    window.setTimeout(() => setHighlightedAppId(prev => (prev === app.id ? null : prev)), 2000);
    // Auto-open the CRM notes modal so F&I immediately sees what was resolved.
    setPendingApp(app);
    setPendingStatus(normalizeInternalStatus((app as any).internal_status) || 'no_notes');
    setStatusNote('');
    setStatusModalOpen(true);
  };

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
    return normalizeInternalStatus(app.internal_status) || 'no_notes';
  };

  const filteredApplications = applications.filter(app => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      app.full_name?.toLowerCase().includes(searchLower) ||
      app.first_name?.toLowerCase().includes(searchLower) ||
      app.last_name?.toLowerCase().includes(searchLower) ||
      app.email?.toLowerCase().includes(searchLower) ||
      app.id_number?.includes(searchQuery) ||
      app.phone?.includes(searchQuery) ||
      (app as any).bank_reference?.toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;

    // F&I ownership filter. Apps assigned to a NORMAL f&i are private to that
    // user (and admin/senior). Unassigned apps and apps "assigned" to a senior
    // f&i (whose name only reflects that they captured the app) remain visible
    // to everyone.
    const owner = (app as any).assigned_f_and_i as string | null | undefined;
    const ownerIsSenior = !!owner && fniUsers.some(u => u.id === owner && u.role === 'senior_f_and_i');
    const ownerIsNormalFni = !!owner && fniUsers.some(u => u.id === owner && u.role === 'f_and_i');
    const effectivelyUnassigned = !owner || ownerIsSenior;

    let matchesFni: boolean;
    if (role === 'f_and_i') {
      matchesFni = effectivelyUnassigned || owner === user?.id;
    } else if (fniFilter === 'all') {
      matchesFni = true;
    } else if (fniFilter === 'self') {
      matchesFni = owner === user?.id;
    } else if (fniFilter === 'unassigned') {
      matchesFni = effectivelyUnassigned;
    } else {
      matchesFni = owner === fniFilter;
    }

    // Filter by active/archived. For F&I, terminal success statuses, 'archived' and
    // cancelled/ghosted ('client_cancelled') go to the Archive tab. Declined/Blacklisted
    // stay in Active. All other roles keep the legacy auto-archive behaviour.
    const s = (app.status || '').toLowerCase().trim();
    let isArchived: boolean;
    if ((role === 'f_and_i' || role === 'senior_f_and_i')) {
      const fAndIArchived = ['archived', 'vehicle_delivered', 'finalized', 'client_cancelled'];
      isArchived = fAndIArchived.includes(s);
    } else {
      const legacyTerminal = ['finalized', 'delivered', 'vehicle_delivered', 'archived', 'client_cancelled'].includes(s);
      isArchived = (app as any).is_archived === true || legacyTerminal;
    }
    const matchesViewMode = viewMode === 'archived' ? isArchived : !isArchived;

    return matchesSearch && matchesStatus && matchesFni && matchesViewMode;
  });

  // Only the first `visibleCount` rows are rendered to the DOM; the rest mount as
  // the sentinel row scrolls into view. Keeps the whole list on one page, but the
  // browser never has to lay out hundreds of heavy rows at once.
  const visibleApplications = filteredApplications.slice(0, visibleCount);

  // Reset the window whenever the filtered set changes (search/filter/tab switch).
  useEffect(() => {
    setVisibleCount(40);
  }, [searchQuery, statusFilter, fniFilter, viewMode]);

  // Grow the window as the sentinel nears the viewport (load-more-on-scroll).
  useEffect(() => {
    if (visibleCount >= filteredApplications.length) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + 40, filteredApplications.length));
        }
      },
      { rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, filteredApplications.length]);

  // Scroll to an Action-Feed-targeted row once the window has grown to mount it
  // (runs after React commits, so the element is guaranteed present — no rAF race).
  useEffect(() => {
    if (!pendingScrollId) return;
    const el = document.getElementById(`app-row-${pendingScrollId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPendingScrollId(null);
    }
  }, [pendingScrollId, visibleCount, visibleApplications.length]);

  const handleStatusDropdownChange = (app: any, newStatus: string) => {
    setPendingApp(app);
    setPendingStatus(newStatus);
    setStatusNote('');
    setStatusModalOpen(true);
  };

  const confirmStatusUpdate = async (overrideStatus?: string) => {
    // overrideStatus lets the preset "Send to Senior F&I / back to F&I" buttons route
    // a note in one click; otherwise use the internal status chosen on the row.
    const statusKey = overrideStatus ?? pendingStatus;
    if (!pendingApp || !statusKey) return;
    // GUARDRAIL: This handler ONLY updates the internal CRM status column.
    // It must NEVER touch the finance application `status` column. Reject any
    // value that is not a valid INTERNAL_STATUSES key.
    if (!INTERNAL_STATUSES[statusKey as keyof typeof INTERNAL_STATUSES]) {
      toast({ title: "Invalid internal status", variant: "destructive" });
      setStatusModalOpen(false);
      setPendingApp(null);
      setPendingStatus('');
      setStatusNote('');
      return;
    }
    try {
      // Resolve acting user/role first so we can stamp the note with author + role.
      const { data: { user: actingUser } } = await supabase.auth.getUser();
      let actingName = 'Staff';
      if (actingUser?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', actingUser.id)
          .maybeSingle();
        actingName = (prof as any)?.full_name?.trim().split(/\s+/)[0]
          || (prof as any)?.email?.split('@')[0]
          || actingUser.email?.split('@')[0]
          || actingName;
      }
      const roleTag = role === 'super_admin' ? 'ADMIN'
        : role === 'sales_agent' ? 'SALES'
        : (role === 'f_and_i' || role === 'senior_f_and_i') ? 'FNI'
        : 'STAFF';

      let updatedNotes = pendingApp.notes || '';
      {
        const timestamp = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const statusLabel = INTERNAL_STATUSES[statusKey as keyof typeof INTERNAL_STATUSES]?.label || statusKey;
        const body = statusNote.trim() || '(no comment)';
        // Sentinel «ROLE» lets the renderer color-code reliably.
        const newEntry = `[${timestamp}] «${roleTag}» ${actingName} — ${statusLabel}: ${body}`;
        updatedNotes = updatedNotes ? `${newEntry}\n\n${updatedNotes}` : newEntry;
      }

      // Directed-routing model: the selected status is used as-is. No
      // auto-escalation flips — Admin / F&I / Senior F&I notes are explicit.
      const effectiveStatus = statusKey;

      const updatePayload: any = {
        internal_status: effectiveStatus,
        attention_updated_at: new Date().toISOString(),
        notes: updatedNotes,
      };
      if (role === 'f_and_i' && actingUser?.id) {
        updatePayload.assigned_f_and_i = actingUser.id;
        updatePayload.assigned_f_and_i_at = new Date().toISOString();
      }

      // 20-hour auto-reset enforcement: if the docs-contacted tick is older than
      // 20h, flush it back to false on the next save so the DB matches the UI.
      const dca = (pendingApp as any)?.docs_contacted_at;
      if ((pendingApp as any)?.docs_contacted && dca && (Date.now() - new Date(dca).getTime() > 20 * 60 * 60 * 1000)) {
        updatePayload.docs_contacted = false;
        updatePayload.docs_contacted_at = null;
      }
      const { error } = await supabase
        .from('finance_applications')
        .update(updatePayload)
        .eq('id', pendingApp.id);
      if (error) throw error;

      // Dual-sync to Universal Timeline
      await supabase.from('client_audit_logs').insert([{
        client_email: pendingApp.email || null,
        client_phone: pendingApp.phone || null,
        note: `«${roleTag}» ${actingName} — [Internal Status → ${INTERNAL_STATUSES[statusKey as keyof typeof INTERNAL_STATUSES]?.label || statusKey}] ${statusNote || 'No comment'}`,
        author_id: actingUser?.id || null,
        author_name: actingName,
        action_type: 'Internal Status Update'
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

  // ── Inline status-dropdown write (extracted so the comment gate can call it) ──
  // EXACT same finance write + sent_to_banks audit as before; `comment` (when
  // supplied via the comment gate) is appended as a status_change pipeline note.
  const performFinanceStatusWrite = async (app: FinanceApplication, newStatus: string, comment?: string) => {
    // GUARDRAIL: only allow whitelisted finance statuses to reach DB.
    const validFinanceStatuses = STATUS_OPTIONS.map(o => o.value);
    if (!validFinanceStatuses.includes(newStatus)) {
      console.warn('[finance-status] rejected invalid value:', newStatus);
      return;
    }
    const archiveOnTerminal = ['declined', 'blacklisted', 'lost', 'client_cancelled'].includes(newStatus);
    const clearInternal = newStatus === 'sent_to_banks';
    try {
      await updateApplication.mutateAsync({
        id: app.id,
        updates: {
          // ISOLATED: only patch the finance pipeline column. Never write into
          // internal_status from this dropdown, EXCEPT to clear it when advancing
          // to sent_to_banks (Task 4 — Feed Clearance / state reset).
          status: newStatus,
          is_archived: archiveOnTerminal,
          ...(clearInternal ? { internal_status: 'no_notes' } : {}),
        },
      });
      // Comment gate — persist the entered comment as a status_change note.
      if (comment && comment.trim()) {
        await addPipelineNote(app, {
          body: comment.trim(),
          category: 'status_change',
          author_id: user?.id ?? null,
          author_name: (user as any)?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Unknown',
        });
      }
      // Task 3 — Auto audit note when sent_to_banks.
      if (clearInternal) {
        try {
          const { data: { user: actingUser } } = await supabase.auth.getUser();
          let actingName = 'Staff';
          if (actingUser?.id) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('user_id', actingUser.id)
              .maybeSingle();
            actingName = (prof as any)?.full_name?.trim().split(/\s+/)[0]
              || (prof as any)?.email?.split('@')[0]
              || actingUser.email?.split('@')[0]
              || actingName;
          }
          const roleTag = role === 'super_admin' ? 'ADMIN'
            : role === 'sales_agent' ? 'SALES'
            : (role === 'f_and_i' || role === 'senior_f_and_i') ? 'FNI'
            : 'STAFF';
          const timestamp = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
          const autoEntry = `[${timestamp}] «${roleTag}» ${actingName} — Sent to Banks: Updated and sent to bank.`;
          const existingNotes = (app as any).notes || '';
          const merged = existingNotes ? `${autoEntry}\n\n${existingNotes}` : autoEntry;
          await supabase
            .from('finance_applications')
            .update({
              notes: merged,
              ...(role === 'f_and_i' && actingUser?.id ? {
                assigned_f_and_i: actingUser.id,
                assigned_f_and_i_at: new Date().toISOString(),
              } : {}),
            })
            .eq('id', app.id);
          await supabase.from('client_audit_logs').insert([{
            client_email: app.email || null,
            client_phone: app.phone || null,
            note: `«${roleTag}» ${actingName} — Updated and sent to bank.`,
            author_id: actingUser?.id || null,
            author_name: actingName,
            action_type: 'Sent to Bank',
          }]);
        } catch (auditErr) {
          console.error('[sent_to_banks audit] failed:', auditErr);
        }
      }
    } catch (err) {
      // Toast handled by hook on error
    }
  };

  // Inline dropdown entry point. Handles the bank-reference interception first,
  // then the comment gate, then the plain write.
  const requestFinanceStatusChange = (app: FinanceApplication, newStatus: string) => {
    if (newStatus === app.status) return;
    if (newStatus === 'application_submitted' || newStatus === 'ready_to_submit') {
      if (!(app as any).bank_reference) {
        setBankRefApp(app);
        setBankRefTargetStatus(newStatus);
        setBankRefModalOpen(true);
        return;
      }
      // Existing reference — fall through to the gate / standard update.
    }
    // Comment gate — pop the modal instead of writing immediately.
    if (commentRequiredFor(newStatus)) {
      setCommentGate({ app, status: newStatus });
      return;
    }
    void performFinanceStatusWrite(app, newStatus);
  };

  const openWhatsApp = (app: FinanceApplication) => {
    const phone = app.phone?.replace(/\D/g, '') || '';
    const formattedPhone = phone.startsWith('0') ? `27${phone.slice(1)}` : phone;
    const name = app.first_name || app.full_name?.split(' ')[0] || 'Customer';
    const message = getWhatsAppMessage(app.status, name, undefined, whatsappMessageFor(app.status));
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleArchive = async (app: FinanceApplication, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateApplication.mutateAsync({ id: app.id, updates: { is_archived: true } as any });
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

  // Stats for active applications only (mirrors the tab filter logic)
  const activeApps = applications.filter(a => {
    const s = (a.status || '').toLowerCase().trim();
    if ((role === 'f_and_i' || role === 'senior_f_and_i')) {
      return !['archived', 'vehicle_delivered', 'finalized', 'client_cancelled'].includes(s);
    }
    return !((a as any).is_archived === true) && !['finalized', 'delivered', 'vehicle_delivered', 'archived', 'client_cancelled'].includes(s);
  });

  return (
    <AdminLayout>
      <Helmet>
        <title>Finance Applications | Lumina Auto Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <PageHeader
        icon={<FileText />}
        title="Finance Applications"
        subtitle="Manage and process finance applications"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={copyInfoRequestTemplate} className="w-fit">
              <Copy className="w-4 h-4 mr-2" />
              Copy Info Request
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCreditReportOpen(true)} className="w-fit">
              <BarChart3 className="w-4 h-4 mr-2 text-amber-400" />
              Credit Report
            </Button>
            {(isSuperAdmin || isSeniorFAndI) && (
              <Button variant="outline" size="sm" onClick={() => setCashDealModalOpen(true)} className="w-fit">
                <Banknote className="w-4 h-4 mr-2" />
                Cash Deal
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setWaModalOpen(true)} className="w-fit">
              <MessageSquare className="w-4 h-4 mr-2 text-emerald-500" />
              WhatsApp to PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(ADMIN_ROUTES.quotes)} className="w-fit">
              <Calculator className="w-4 h-4 mr-2" />
              Quote Generator
            </Button>
            <Button size="sm" onClick={() => navigate(ADMIN_ROUTES.financeCreate)} className="w-fit">
              <UserPlus className="w-4 h-4 mr-2" />
              Create Application
            </Button>
          </>
        }
      />

      <div className="p-6">

        {/* Status Counter Strip — F&I sees finance pipeline; Admin/Sales see internal-note overview */}
        {(() => {
          // Admins see the full F&I pipeline view as well (parity — admin has access to all features).
          const isFAndIRole = (role === 'f_and_i' || role === 'senior_f_and_i' || role === 'super_admin');

          // F&I-relevant pipeline statuses (workflow stages F&I owns)
          const FNI_PIPELINE: { key: string; label: string; color: string }[] = [
            { key: 'application_submitted', label: 'App Submitted', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 [.desk-portal-light_&]:text-amber-700' },
            { key: 'ready_to_submit', label: 'Ready to Submit', color: 'bg-emerald-900/30 text-emerald-300 border-emerald-400/50 [.desk-portal-light_&]:bg-emerald-500/10 [.desk-portal-light_&]:text-emerald-700' },
            { key: 'sent_to_banks', label: 'Sent to Banks', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20 [.desk-portal-light_&]:text-sky-700' },
            { key: 'pre_approved', label: 'Pre-Approved', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 [.desk-portal-light_&]:text-indigo-700' },
            { key: 'validations_pending', label: 'Validations Pending', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 [.desk-portal-light_&]:text-blue-700' },
            { key: 'validations_complete', label: 'Validations Complete', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 [.desk-portal-light_&]:text-cyan-700' },
            { key: 'contract_sent', label: 'Contract Sent', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20 [.desk-portal-light_&]:text-violet-700' },
            { key: 'contract_signed', label: 'Contract Signed', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 [.desk-portal-light_&]:text-emerald-700' },
            { key: 'declined_conditional', label: 'Declined (Cond.)', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20 [.desk-portal-light_&]:text-orange-700' },
            { key: 'declined', label: 'Declined', color: 'bg-red-500/10 text-red-400 border-red-500/20 [.desk-portal-light_&]:text-red-700' },
            { key: 'blacklisted', label: 'Blacklisted', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20 [.desk-portal-light_&]:text-rose-700' },
          ];

          let total = 0;
          const counts: Record<string, number> = {};
          if (isFAndIRole) {
            FNI_PIPELINE.forEach(s => { counts[s.key] = 0; });
            for (const a of applications as any[]) {
              if (a.is_archived) continue;
              total += 1;
              if (counts[a.status] !== undefined) counts[a.status] += 1;
            }
          } else {
            ['no_notes','note_to_admin','note_to_f_and_i','note_to_senior_f_and_i'].forEach(k => { counts[k] = 0; });
            for (const a of applications as any[]) {
              if (a.is_archived) continue;
              const norm = normalizeInternalStatus(a.internal_status) || 'no_notes';
              if (counts[norm] !== undefined) counts[norm] += 1;
              total += 1;
            }
          }

          const internalOrder: InternalStatus[] = ['note_to_admin', 'note_to_f_and_i', 'note_to_senior_f_and_i', 'no_notes'];
          const headerLabel = isFAndIRole ? 'F&I Pipeline Overview' : 'Internal Status Overview';

          return (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-card border border-border rounded-lg p-3 mb-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
                  {headerLabel}
                </p>
                <span className="text-[10px] text-muted-foreground">{total} active app{total === 1 ? '' : 's'}</span>
              </div>
              <div className={`grid grid-cols-2 sm:grid-cols-3 ${isFAndIRole ? 'lg:grid-cols-5 xl:grid-cols-10' : 'lg:grid-cols-5'} gap-2`}>
                {isFAndIRole
                  ? FNI_PIPELINE.map((s) => (
                      <div
                        key={s.key}
                        className={`flex items-center justify-between px-3 py-2 rounded-md border ${s.color}`}
                      >
                        <span className="text-[11px] uppercase tracking-wider truncate">{s.label}</span>
                        <span className="text-lg font-semibold tabular-nums ml-2">{counts[s.key]}</span>
                      </div>
                    ))
                  : internalOrder.map((key) => {
                      const cfg = INTERNAL_STATUSES[key];
                      // Light-mode text overrides for the shared chip palette (config file stays dark-first).
                      const lightText: Record<InternalStatus, string> = {
                        no_notes: '[.desk-portal-light_&]:text-zinc-600',
                        note_to_admin: '[.desk-portal-light_&]:text-red-700',
                        note_to_f_and_i: '[.desk-portal-light_&]:text-emerald-700',
                        note_to_senior_f_and_i: '[.desk-portal-light_&]:text-sky-700',
                      };
                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between px-3 py-2 rounded-md border ${cfg.color} ${lightText[key]}`}
                        >
                          <span className="text-[11px] uppercase tracking-wider truncate">{cfg.label}</span>
                          <span className="text-lg font-semibold tabular-nums ml-2">{counts[key]}</span>
                        </div>
                      );
                    })}
              </div>
            </motion.div>
          );
        })()}

        {/* Action Feed — directed-routing notification banner.
            Admin → Note to Admin only.
            Standard F&I → Note to F&I only (strictly isolated).
            Senior F&I → toggle between Note to Admin and Note to Senior F&I. */}
        {(() => {
          // 3-way oversight: Admin and Senior F&I can pivot across all three feeds.
          // Standard F&I is strictly locked to their own Note to F&I feed.
          const canToggle = role === 'super_admin' || role === 'senior_f_and_i';
          let effectiveView: 'admin' | 'f_and_i' | 'senior';
          if (canToggle) {
            effectiveView = notificationFilter === 'admin'
              ? 'admin'
              : notificationFilter === 'senior'
                ? 'senior'
                : 'f_and_i';
          } else if (role === 'f_and_i') {
            effectiveView = 'f_and_i';
          } else {
            effectiveView = 'admin';
          }
          const targetStatus: InternalStatus =
            effectiveView === 'admin' ? 'note_to_admin'
            : effectiveView === 'f_and_i' ? 'note_to_f_and_i'
            : 'note_to_senior_f_and_i';
          // Internal statuses persist permanently until manually cleared by staff —
          // no time-based expiration / auto-fade.
          const feed = applications.filter((a: any) => {
            if (a.is_archived) return false;
            const norm = normalizeInternalStatus(a.internal_status);
            return norm === targetStatus;
          });
          // Always show the F&I their own feed (even empty) so notifications are
          // discoverable; only hide an empty feed for non-F&I roles without a toggle.
          if (feed.length === 0 && !canToggle && effectiveView !== 'f_and_i') return null;
          const isFAndI = effectiveView !== 'admin';
          const headerLabel =
            effectiveView === 'admin' ? 'Admin Action Feed'
            : effectiveView === 'senior' ? 'Senior F&I Action Feed'
            : 'F&I Action Feed';
          const toggleBtn = (key: 'admin' | 'senior' | 'f_and_i', label: string, activeCls: string) => (
            <button
              type="button"
              onClick={() => setNotificationFilter(key)}
              className={`text-[11px] px-3 py-1 rounded-md transition-colors border ${
                effectiveView === key
                  ? activeCls
                  : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {label}
            </button>
          );
          return (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-card border border-border rounded-lg p-4 mb-6 flex flex-col gap-2"
            >
              {canToggle && (
                <div className="flex items-center gap-2 pb-2 mb-1 border-b border-border">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mr-1">View</span>
                  {toggleBtn('admin', 'Admin', 'bg-red-900/40 text-red-400 border-red-500/50 [.desk-portal-light_&]:bg-red-500/10 [.desk-portal-light_&]:text-red-700')}
                  {toggleBtn('senior', 'Senior F&I', 'bg-purple-900/40 text-purple-400 border-purple-500/50 [.desk-portal-light_&]:bg-purple-500/10 [.desk-portal-light_&]:text-purple-700')}
                  {toggleBtn('f_and_i', 'F&I Team', 'bg-emerald-900/40 text-emerald-400 border-emerald-500/50 [.desk-portal-light_&]:bg-emerald-500/10 [.desk-portal-light_&]:text-emerald-700')}
                </div>
              )}
              {feed.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2">No items in this feed.</p>
              ) : (
              <>
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300/80 font-medium flex items-center gap-2">
                  <MailWarning className="w-3.5 h-3.5" />
                  {headerLabel}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {feed.length} ready for review
                </span>
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                {feed.map((app: any) => {
                  // Color-code by which directed feed we're showing.
                  const isAdminFeed = effectiveView === 'admin';
                  const subLabel =
                    effectiveView === 'admin' ? 'Note to Admin · Action Required'
                    : effectiveView === 'senior' ? 'Note to Senior F&I · Action Required'
                    : 'Note to F&I · Action Required';
                  const dotClass = isAdminFeed ? 'bg-red-400' : (effectiveView === 'senior' ? 'bg-purple-400' : 'bg-emerald-400');
                  const containerClass = isAdminFeed
                    ? 'border-red-500/40 hover:border-red-400 hover:bg-red-400/10'
                    : effectiveView === 'senior'
                      ? 'border-purple-500/40 hover:border-purple-400 hover:bg-purple-400/10'
                      : 'border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-400/10';
                  const textHover = isAdminFeed
                    ? 'group-hover:text-red-200 [.desk-portal-light_&]:group-hover:text-red-600'
                    : effectiveView === 'senior'
                      ? 'group-hover:text-purple-200 [.desk-portal-light_&]:group-hover:text-purple-600'
                      : 'group-hover:text-emerald-200 [.desk-portal-light_&]:group-hover:text-emerald-600';
                  const ts = app.status_updated_at || app.updated_at || app.created_at;
                  const formattedDate = ts
                    ? new Date(ts).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: false,
                      }).replace(',', ' •')
                    : '';
                  return (
                    <button
                      key={app.id}
                      onClick={() => focusApplicationRow(app)}
                      className={`group grid grid-cols-[1fr_auto_auto] md:grid-cols-3 items-center gap-3 px-3 py-2 rounded-md bg-muted/60 border text-left transition-colors ${containerClass}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 justify-self-start">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-pulse shrink-0`} />
                        <span className={`text-sm text-foreground truncate ${textHover}`}>
                          {app.first_name} {app.last_name}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                          {subLabel}
                        </span>
                      </div>
                      <div className="hidden md:flex justify-center text-[11px] text-muted-foreground font-mono tracking-wide whitespace-nowrap">
                        {formattedDate}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 justify-self-end whitespace-nowrap">
                        {ADMIN_STATUS_LABELS[app.status] || app.status} →
                      </span>
                    </button>
                  );
                })}
              </div>
              </>
              )}
            </motion.div>
          );
        })()}

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
              placeholder="Search by name, ID, email, phone, or reference..."
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
          {role !== 'f_and_i' && (
            <Select value={fniFilter} onValueChange={setFniFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filter by F&I" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Applications</SelectItem>
                <SelectItem value="self">My Applications</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {fniUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}{u.role === 'senior_f_and_i' ? ' (Senior)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </motion.div>

        {/* Stats */}
        {(() => {
          const isToday = (d?: string | null) => {
            if (!d) return false;
            const x = new Date(d), n = new Date();
            return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth() && x.getDate() === n.getDate();
          };
          // Cumulative daily high-water mark: count any app that ENTERED this status today
          // at any point (using status_history timeline), regardless of where it is now.
          // .some() ensures one app contributes at most +1 per status per day.
          const enteredStatusTodayHistory = (a: FinanceApplication, status: string) => {
            const history = Array.isArray((a as any).status_history) ? (a as any).status_history : [];
            if (history.some((e: any) => e?.status === status && isToday(e?.timestamp))) return true;
            // Fallback: current status with status_updated_at today (covers pre-history rows)
            if (a.status === status) {
              const stamp = (a as any).status_updated_at;
              if (stamp && isToday(stamp)) return true;
            }
            return false;
          };

          const todayByStatus = (status: string, useCreated = false) =>
            applications.filter(a => {
              if (enteredStatusTodayHistory(a, status)) return true;
              // Intake fallback: count brand-new rows created today even with no history yet
              if (useCreated && a.status === status && isToday(a.created_at)) return true;
              return false;
            }).length;

          const totalActiveToday = activeApps.filter(a => {
            const history = Array.isArray((a as any).status_history) ? (a as any).status_history : [];
            if (history.some((e: any) => isToday(e?.timestamp))) return true;
            const stamp = (a as any).status_updated_at;
            if (stamp && isToday(stamp)) return true;
            return isToday(a.created_at);
          }).length;
          const Sub = ({ n }: { n: number }) => (
            <div className={`text-[10px] mt-0.5 ${n > 0 ? 'opacity-60' : 'text-zinc-600'}`}>+{n} today</div>
          );
          const declinedCount = applications.filter(a => a.status === 'declined' || a.status === 'blacklisted').length;
          const declinedToday = todayByStatus('declined') + todayByStatus('blacklisted');
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4"
            >
              <StatTile
                label="Pending"
                value={<span className="text-amber-400">{activeApps.filter(a => a.status === 'pending').length}</span>}
                hint={<Sub n={todayByStatus('pending', true)} />}
              />
              <StatTile
                label="Apps Submitted"
                value={<span className="text-indigo-400">{activeApps.filter(a => a.status === 'application_submitted').length}</span>}
                hint={<Sub n={todayByStatus('application_submitted')} />}
              />
              <StatTile
                label="Ready to Submit"
                value={<span className="text-emerald-300 [.desk-portal-light_&]:text-emerald-600">{activeApps.filter(a => a.status === 'ready_to_submit').length}</span>}
                hint={<Sub n={todayByStatus('ready_to_submit')} />}
              />
              <StatTile
                label="Pre-Approved"
                value={<span className="text-teal-400">{activeApps.filter(a => a.status === 'pre_approved').length}</span>}
                hint={<Sub n={todayByStatus('pre_approved')} />}
              />
              <StatTile
                label="Vals Submitted"
                value={<span className="text-blue-400">{activeApps.filter(a => a.status === 'validations_pending').length}</span>}
                hint={<Sub n={todayByStatus('validations_pending')} />}
              />
              <StatTile
                label="Vals Complete"
                value={<span className="text-cyan-400">{activeApps.filter(a => a.status === 'validations_complete').length}</span>}
                hint={<Sub n={todayByStatus('validations_complete')} />}
              />
              <StatTile
                label="Declined"
                value={<span className="text-red-400">{declinedCount}</span>}
                hint={<span className={declinedToday > 0 ? 'text-red-300 [.desk-portal-light_&]:text-red-600' : 'text-muted-foreground'}>+{declinedToday} today</span>}
              />
              <StatTile
                label="Active"
                value={activeApps.length}
                hint={<Sub n={totalActiveToday} />}
              />
            </motion.div>
          );
        })()}

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
            <Table className="min-w-[1040px] [&_td]:py-3 [&_th]:py-2.5">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-[11px] uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-muted-foreground text-[11px] uppercase tracking-wider">Mobile</TableHead>
                  <TableHead className="text-muted-foreground text-[11px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-muted-foreground text-[11px] uppercase tracking-wider">Credit Check</TableHead>
                  <TableHead className="text-muted-foreground text-[11px] uppercase tracking-wider">Internal</TableHead>
                  <TableHead className="text-muted-foreground text-[11px] uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-muted-foreground text-[11px] uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleApplications.map((app) => {
                  const cleanedPhone = app.phone?.replace(/\D/g, '') || '';
                  const whatsAppPhone = cleanedPhone.startsWith('0') ? `27${cleanedPhone.slice(1)}` : cleanedPhone;
                  
                  // Warning conditions
                  
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

                  // Freshness & stagnation.
                  // "NEW" disappears once the app has progressed past application_submitted
                  // (sent_to_banks step or further) OR once any CRM notes exist.
                  const stepIdx = STATUS_STEP_ORDER[app.status] ?? 0;
                  const hasNotes = !!(app.notes && String(app.notes).trim().length > 0);
                  const ageMs = Date.now() - new Date(app.created_at).getTime();
                  const isNew = ageMs < (24 * 60 * 60 * 1000) && stepIdx < 2 && !hasNotes;
                  const isStagnant = (Date.now() - new Date(app.updated_at || app.created_at).getTime()) > (72 * 60 * 60 * 1000);
                  const isHighlighted = highlightedAppId === app.id;

                  return (
                  <TableRow
                    key={app.id}
                    id={`app-row-${app.id}`}
                    className={`border-border hover:bg-muted/40 cursor-pointer transition-colors ${app.status === 'pre_approved' ? 'bg-green-900/10 border-l-4 !border-l-green-500 shadow-[0_0_12px_-4px_rgba(34,197,94,0.5)]' : ''} ${isNew ? 'bg-emerald-500/5' : ''} ${isStagnant ? 'bg-orange-500/5' : ''} ${isHighlighted ? 'ring-2 ring-amber-300/70 bg-amber-300/10 animate-pulse' : ''}`}
                    onClick={() => navigate(`/admin/finance/${app.id}`)}
                  >
                    <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1.5 min-w-[15rem]">
                        {/* Identity — primary line: name + email + rep */}
                        <button
                          onClick={(e) => { e.preventDefault(); openClientHub(app.email, app.phone); }}
                          className="group/name text-left focus:outline-none"
                        >
                          <p className="font-medium text-foreground flex items-center gap-2 flex-wrap group-hover/name:text-emerald-400 group-hover/name:underline transition-colors">
                            {(app as any).bank_reference && (
                              <BankReferenceBadge
                                reference={(app as any).bank_reference}
                                onEdit={(role === 'super_admin' || role === 'senior_f_and_i')
                                  ? () => { setEditBankRefApp(app); setEditBankRefOpen(true); }
                                  : undefined}
                              />
                            )}
                            <span>{app.first_name} {app.last_name}</span>
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[15rem]">{app.email}</p>
                          {(() => {
                            const creator = (app as any).creator;
                            if (!creator?.full_name && !creator?.email) return null;
                            const firstName = creator.full_name
                              ? String(creator.full_name).trim().split(/\s+/)[0]
                              : String(creator.email).split('@')[0];
                            return (
                              <p className="text-[10px] text-muted-foreground/80 mt-0.5 flex items-center gap-1">
                                <User className="w-2.5 h-2.5" />
                                <span className="font-medium">Rep:</span>{' '}
                                <span>{firstName}</span>
                              </p>
                            );
                          })()}
                        </button>

                        {/* F&I assignment — one clean, consistent chip/control */}
                        {(() => {
                          const fni = (app as any).fni_owner;
                          const canReassign = role === 'super_admin' || role === 'senior_f_and_i';
                          // Uniform chip footprint shared by all three states.
                          const chipBase = "inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] uppercase tracking-wider font-semibold border transition-colors";
                          if (!fni?.full_name && !fni?.email) {
                            if (!canReassign) return null;
                            return (
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditBankRefApp(app); setEditBankRefOpen(true); }}
                                className={`${chipBase} w-fit text-muted-foreground border-border bg-muted/40 hover:bg-muted/70 hover:text-foreground`}
                                title="Assign F&I"
                              >
                                + Assign F&amp;I
                              </button>
                            );
                          }
                          const fniFirst = fni.full_name
                            ? String(fni.full_name).trim().split(/\s+/)[0]
                            : String(fni.email).split('@')[0];
                          const assignedCls = `${chipBase} w-fit text-pink-400 border-pink-500/40 bg-pink-500/10`;
                          if (canReassign) {
                            return (
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditBankRefApp(app); setEditBankRefOpen(true); }}
                                className={`${assignedCls} hover:bg-pink-500/20 cursor-pointer`}
                                title={`Reassign F&I (current: ${fni.full_name || fni.email})`}
                              >
                                <User className="w-2.5 h-2.5" />
                                F&amp;I: {fniFirst}
                              </button>
                            );
                          }
                          return (
                            <span className={assignedCls} title={`Assigned F&I: ${fni.full_name || fni.email}`}>
                              <User className="w-2.5 h-2.5" />
                              F&amp;I: {fniFirst}
                            </span>
                          );
                        })()}

                        {/* Secondary indicators — one tidy, uniform cluster.
                            Muted unless meaningful; consistent h-5 pill / square footprint. */}
                        {(() => {
                          const indicatorBase = "inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] uppercase tracking-wider font-medium border whitespace-nowrap";
                          const iconTileBase = "inline-flex items-center justify-center h-5 w-5 rounded border";

                          // Source descriptor
                          const src = (app as any).submission_source;
                          let srcIcon: JSX.Element;
                          let srcLabel: string;
                          if (src === 'whatsapp_parser') {
                            srcIcon = <MessageCircle className="w-3 h-3" />;
                            srcLabel = 'WhatsApp PDF';
                          } else if (src === 'website') {
                            srcIcon = <Globe className="w-3 h-3" />;
                            srcLabel = 'Website';
                          } else if (src && String(src).trim() !== '') {
                            srcIcon = <FileText className="w-3 h-3" />;
                            srcLabel = sourceLabel(src);
                          } else {
                            srcIcon = <FileText className="w-3 h-3" />;
                            srcLabel = 'Legacy';
                          }

                          const dEmail = !!(app as any).docs_email;
                          const dWa = !!(app as any).docs_whatsapp;
                          const hasDocs = dEmail || dWa;

                          return (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isNew && (
                                <span className={`${indicatorBase} font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-400`}>
                                  🔥 NEW
                                </span>
                              )}
                              {isStagnant && !isNew && (
                                <span className={`${indicatorBase} font-bold border-orange-500/30 bg-orange-500/10 text-orange-400`}>
                                  ⏳ STALE
                                </span>
                              )}
                              {riskReason && (
                                <span className={`${indicatorBase} font-bold border-red-500/30 bg-red-500/10 text-red-400`} title={riskReason}>
                                  ⚠ {riskReason}
                                </span>
                              )}
                              {/* Source — muted icon tile (informational, never alarming) */}
                              <span
                                className={`${iconTileBase} border-border bg-muted/40 text-muted-foreground`}
                                title={`Source: ${srcLabel}`}
                                aria-label={`Source: ${srcLabel}`}
                              >
                                {srcIcon}
                              </span>
                              {/* Docs — red pill when missing (meaningful), muted tile when received */}
                              {hasDocs ? (
                                <span
                                  className={`${iconTileBase} border-border bg-muted/40 text-muted-foreground`}
                                  title={`Docs received via ${[dEmail && 'Email', dWa && 'WhatsApp'].filter(Boolean).join(' & ')}`}
                                >
                                  {dEmail && <Mail className="w-3 h-3" />}
                                  {dWa && <MessageCircle className="w-3 h-3" />}
                                </span>
                              ) : (
                                <span
                                  className={`${indicatorBase} border-red-500/30 bg-red-500/10 text-red-400`}
                                  title="No documents received yet"
                                >
                                  <FileX className="w-3 h-3" /> No Docs
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                      {app.phone ? (
                        <a
                          href={`https://wa.me/${whatsAppPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-green-500 hover:text-green-400 transition-colors tabular-nums whitespace-nowrap"
                          title="Open WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4 fill-green-500/20 shrink-0" />
                          {app.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={app.status}
                        onValueChange={(newStatus) => requestFinanceStatusChange(app, newStatus)}
                      >
                         {(() => {
                           const stamp = (app as any).status_updated_at || app.updated_at;
                           const tip = stamp
                             ? `Changed: ${new Date(stamp).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date(stamp).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                             : undefined;
                           return (
                             <SelectTrigger
                               title={tip}
                               className={`w-[180px] h-7 text-xs uppercase tracking-wider border whitespace-nowrap ${statusBadgeClass(app.status, theme) || statusBadgeClass('pending', theme)}`}
                             >
                               <SelectValue>
                                 <span className="whitespace-nowrap">
                                   {ADMIN_STATUS_LABELS[app.status] || app.status}
                                 </span>
                               </SelectValue>
                             </SelectTrigger>
                           );
                         })()}
                        <SelectContent>
                          {filterStatusOptionsForRole(STATUS_OPTIONS, role, app.status).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {ADMIN_STATUS_LABELS[opt.value] || opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                     </TableCell>
                     <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                       {(() => {
                         const cc = (app as any).credit_check_status as 'passed' | 'failed' | null | undefined;
                         const ccStyle =
                           cc === 'passed'
                             ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                             : cc === 'failed'
                               ? 'bg-red-500/10 text-red-400 border-red-500/30'
                               : 'bg-muted/40 text-muted-foreground border-border';
                         return (
                           <Select
                             value={cc || ''}
                             onValueChange={(v) => {
                               setCreditCheckApp(app);
                               setCreditCheckOutcome(v as CreditCheckOutcome);
                               setCreditCheckOpen(true);
                             }}
                           >
                             <SelectTrigger className={`w-[130px] h-7 text-xs uppercase tracking-wider border ${ccStyle}`}>
                               <SelectValue placeholder="Not Run" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="passed" className="text-xs">Passed</SelectItem>
                               <SelectItem value="failed" className="text-xs">Failed</SelectItem>
                             </SelectContent>
                           </Select>
                         );
                       })()}
                     </TableCell>
                     <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                       {(() => {
                         const safeStatusKey = getDisplayStatus(app);
                         const statusConfig = INTERNAL_STATUSES[safeStatusKey as keyof typeof INTERNAL_STATUSES] || INTERNAL_STATUSES.no_notes;
                         const hasNotes = !!(app.notes && String(app.notes).trim().length > 0);
                         const normInt = normalizeInternalStatus((app as any).internal_status);
                         const isFAndIRow = (role === 'f_and_i' || role === 'senior_f_and_i');
                         // Show ping only on notes directed at this role.
                         // Standard F&I: only Note to F&I. Senior F&I: F&I + Senior F&I.
                         // Admin / Sales: only Note to Admin.
                         const alertSet = role === 'senior_f_and_i'
                           ? new Set(['note_to_f_and_i', 'note_to_senior_f_and_i'])
                           : role === 'f_and_i'
                             ? new Set(['note_to_f_and_i'])
                             : new Set(['note_to_admin']);
                         const showDot = !!normInt && normInt !== 'no_notes' && alertSet.has(normInt);
                         return (
                           <div className="flex items-center gap-2">
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
                             <button
                               type="button"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setPendingApp(app);
                                 setPendingStatus(normalizeInternalStatus((app as any).internal_status) || 'no_notes');
                                 setStatusNote('');
                                 setStatusModalOpen(true);
                               }}
                               className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
                               title={hasNotes ? "View Notes" : "Add Note"}
                             >
                               <span className="text-xs leading-none">📝</span>
                               {showDot && (
                                 <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-background" />
                               )}
                             </button>
                           </div>
                         );
                       })()}
                    </TableCell>
                     <TableCell className="align-top text-sm text-muted-foreground">
                       <div className="whitespace-nowrap text-sm text-foreground tabular-nums">
                         {new Date(app.created_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}
                         <span className="text-xs text-muted-foreground ml-2">
                           {new Date(app.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
                         </span>
                       </div>
                     </TableCell>
                    <TableCell className="align-top text-right" onClick={(e) => e.stopPropagation()}>
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
                        {!((app as any).is_archived) && app.status !== 'archived' && (
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
                {visibleCount < filteredApplications.length && (
                  <TableRow ref={loadMoreRef} className="border-border hover:bg-transparent">
                    <TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                      Loading more… showing {visibleApplications.length} of {filteredApplications.length}
                    </TableCell>
                  </TableRow>
                )}
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
              <DialogTitle className="flex items-start justify-between gap-3 pr-6">
                <div className="flex flex-col">
                  <h2 className="text-xl font-semibold text-foreground tracking-wide">
                    Client: {pendingApp?.first_name} {pendingApp?.last_name}
                  </h2>
                  {pendingLeadName && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await navigator.clipboard.writeText(pendingLeadName);
                          toast({ title: 'CRM Lead name copied' });
                        } catch {
                          toast({ title: 'Copy failed', variant: 'destructive' });
                        }
                      }}
                      title="Click to copy"
                      className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium w-fit transition-colors"
                    >
                      <span>CRM Lead: {pendingLeadName}</span>
                      <Copy className="w-3 h-3 opacity-60" />
                    </button>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">Update Status &amp; CRM Note</p>
                </div>
                {pendingApp?.phone && (
                  <span
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(pendingApp.phone);
                        toast({ title: 'Number copied' });
                      } catch {
                        toast({ title: 'Copy failed', variant: 'destructive' });
                      }
                    }}
                    className="text-base text-foreground hover:text-foreground cursor-pointer transition-colors font-normal whitespace-nowrap self-center"
                    title="Click to copy"
                  >
                    📞 {pendingApp.phone}
                  </span>
                )}
                <div className="flex items-center gap-2 self-center">
                  {(pendingApp as any)?.bank_reference && (
                    <BankReferenceBadge
                      reference={(pendingApp as any).bank_reference}
                      onEdit={(role === 'super_admin' || role === 'senior_f_and_i')
                        ? () => { setEditBankRefApp(pendingApp); setEditBankRefOpen(true); }
                        : undefined}
                    />
                  )}
                  {pendingApp?.id && (
                    <button
                      type="button"
                      onClick={() => {
                        const id = pendingApp.id;
                        setStatusModalOpen(false);
                        setPendingApp(null);
                        navigate(`/admin/finance/${id}`);
                      }}
                      className="px-3 py-1 text-xs border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded transition-colors whitespace-nowrap"
                    >
                      View Full File
                    </button>
                  )}
                </div>
              </DialogTitle>
            </DialogHeader>
            {(() => {
              const norm = normalizeInternalStatus((pendingApp as any)?.internal_status);
              if (norm !== 'note_to_admin' && norm !== 'note_to_f_and_i' && norm !== 'note_to_senior_f_and_i') return null;
              // F&I claims ownership when they action a note (mirrors the existing behaviour).
              const fniClaim = role === 'f_and_i' && user?.id
                ? { assigned_f_and_i: user.id, assigned_f_and_i_at: new Date().toISOString() }
                : {};
              const closeModal = () => {
                setStatusModalOpen(false);
                setPendingApp(null);
                setPendingStatus('');
                setStatusNote('');
                refetch();
              };
              return (
                <div className="pt-1 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    onClick={async () => {
                      if (!pendingApp) return;
                      try {
                        const { error } = await supabase
                          .from('finance_applications')
                          .update({
                            internal_status: 'no_notes',
                            attention_updated_at: new Date().toISOString(),
                            ...fniClaim,
                          })
                          .eq('id', pendingApp.id);
                        if (error) throw error;
                        toast({ title: 'Marked as attended' });
                        closeModal();
                      } catch (e: any) {
                        toast({ title: 'Failed to clear note', variant: 'destructive' });
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    ✓ Mark as Attended (Clear Note)
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!pendingApp) return;
                      try {
                        // Route through the shared update hook so the standard
                        // cancellation side-effects fire (WhatsApp "Application
                        // Closed" + EasySocial tag reset + status_history), AND
                        // clear the note + archive in the same write.
                        await updateApplication.mutateAsync({
                          id: pendingApp.id,
                          updates: {
                            status: 'client_cancelled',
                            is_archived: true,
                            internal_status: 'no_notes',
                            attention_updated_at: new Date().toISOString(),
                            ...fniClaim,
                          },
                        });
                        toast({ title: 'Cancelled / Ghosted', description: 'Status set, note cleared, archived.' });
                        closeModal();
                      } catch (e: any) {
                        toast({ title: 'Failed to cancel', description: e?.message, variant: 'destructive' });
                      }
                    }}
                    className="w-full bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500"
                  >
                    🚫 Cancel / Ghost (Clear Note)
                  </Button>
                </div>
              );
            })()}
            {(() => {
              const norm = normalizeInternalStatus((pendingApp as any)?.internal_status);
              const eligible = (role === 'f_and_i' || role === 'senior_f_and_i') && (norm === 'note_to_f_and_i' || norm === 'note_to_senior_f_and_i' || norm === 'no_notes' || !norm);
              const notAlreadySent = pendingApp?.status !== 'sent_to_banks';
              if (!eligible || !notAlreadySent) return null;
              const handleFinalize = async (
                targetStatus: 'sent_to_banks' | 'ready_to_submit',
                opts: { label: string; auditVerb: string }
              ) => {
                if (!pendingApp) return;
                try {
                  const { error } = await supabase
                    .from('finance_applications')
                    .update({
                      status: targetStatus,
                      internal_status: 'no_notes',
                      attention_updated_at: new Date().toISOString(),
                      ...(role === 'f_and_i' && user?.id ? {
                        assigned_f_and_i: user.id,
                        assigned_f_and_i_at: new Date().toISOString(),
                      } : {}),

                    })
                    .eq('id', pendingApp.id);
                  if (error) throw error;

                  const stamp = new Date().toLocaleString('en-ZA', { hour12: false });
                  const comment = statusNote?.trim();
                  const autoEntry = comment
                    ? `[${stamp}] «FNI» ${opts.auditVerb} — ${comment}`
                    : `[${stamp}] «FNI» ${opts.auditVerb}`;
                  const existingNotes = (pendingApp as any).notes || '';
                  const merged = existingNotes ? `${autoEntry}\n\n${existingNotes}` : autoEntry;
                  await supabase
                    .from('finance_applications')
                    .update({ notes: merged })
                    .eq('id', pendingApp.id);

                  if (user?.id) {
                    await supabase.from('client_audit_logs').insert({
                      note: comment ? `${opts.auditVerb} — ${comment}` : opts.auditVerb,
                      action_type: 'status_change',
                      author_id: user.id,
                      author_name: 'F&I',
                      client_email: pendingApp.email || null,
                      client_phone: pendingApp.phone || null,
                    });
                  }

                  toast({ title: opts.label, description: 'Status updated & notification cleared.' });
                  setStatusModalOpen(false);
                  setPendingApp(null);
                  setPendingStatus('');
                  setStatusNote('');
                  refetch();
                } catch (e: any) {
                  console.error(`[${opts.label}] failed:`, e);
                  toast({ title: `Failed: ${opts.label}`, description: e.message, variant: 'destructive' });
                }
              };
              return (
                <div className="pt-1 pb-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleFinalize('ready_to_submit', { label: 'Ready to Submit', auditVerb: 'Marked Ready to Submit.' })}
                    className="w-full bg-emerald-900/30 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-800/40 [.desk-portal-light_&]:bg-emerald-500/10 [.desk-portal-light_&]:text-emerald-700 [.desk-portal-light_&]:hover:bg-emerald-500/20 transition-colors font-medium px-4 py-3 rounded-md"
                  >
                    ✅ Ready to Submit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFinalize('sent_to_banks', { label: 'Sent to Banks', auditVerb: 'Updated and sent to bank.' })}
                    className="w-full bg-yellow-500 text-black font-semibold px-4 py-3 rounded-md hover:bg-yellow-400 transition-colors"
                  >
                    🏦 Finalize: Send to Banks
                  </button>
                </div>
              );
            })()}
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
                  <div className="bg-muted/30 border border-border rounded-md max-h-[180px] overflow-auto p-2 space-y-1.5">
                    {String(pendingApp.notes)
                      .split(/\n\n+/)
                      .map((entry: string, idx: number) => {
                        // Detect author role sentinel «ADMIN» / «SALES» / «FNI».
                        const m = entry.match(/«(ADMIN|SALES|FNI|STAFF)»/);
                        const tag = m?.[1] || null;
                        const roleStyle =
                          tag === 'ADMIN'
                            ? { border: 'border-[#ff2d55]', text: 'text-[#ff5c7a]', shadow: 'shadow-[0_0_8px_rgba(255,45,85,0.45)]', label: 'Admin' }
                          : tag === 'SALES'
                            ? { border: 'border-[#38bdf8]', text: 'text-[#7dd3fc]', shadow: 'shadow-[0_0_8px_rgba(56,189,248,0.45)]', label: 'Sales' }
                          : tag === 'FNI'
                            ? { border: 'border-[#ff2bd6]', text: 'text-[#ff7ae6]', shadow: 'shadow-[0_0_8px_rgba(255,43,214,0.45)]', label: 'F&I' }
                            : null;
                        const cleaned = entry.replace(/«(ADMIN|SALES|FNI|STAFF)»\s?/, '');
                        const isNewest = idx === 0;
                        return (
                          <div
                            key={idx}
                            className={[
                              'p-2.5 rounded-sm font-mono text-xs whitespace-pre-wrap border-l-4',
                              roleStyle ? `${roleStyle.border} ${roleStyle.shadow}` : 'border-border/60',
                              isNewest ? 'bg-yellow-500/15 text-foreground' : 'text-muted-foreground bg-background/40',
                            ].join(' ')}
                          >
                            {roleStyle && (
                              <span className={`inline-block mr-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${roleStyle.border} ${roleStyle.text} bg-zinc-900`}>
                                {roleStyle.label}
                              </span>
                            )}
                            {cleaned}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
            {/* Pre-Approved doc-request tracker — visible only while the app is in pre_approved.
                Auto-resets visually after 20h, and the next save flushes the stale flag to the DB. */}
            {(pendingApp as any)?.status === 'pre_approved' && (() => {
              const at = (pendingApp as any)?.docs_contacted_at;
              const ageMs = at ? Date.now() - new Date(at).getTime() : Infinity;
              const stale = ageMs > 20 * 60 * 60 * 1000;
              const dbChecked = !!(pendingApp as any)?.docs_contacted;
              const checked = dbChecked && !stale;
              return (
                <div className="flex items-center gap-2 px-1 py-2 border-t border-border">
                  <Checkbox
                    id="docs-contacted"
                    checked={checked}
                    onCheckedChange={async (v) => {
                      if (!pendingApp) return;
                      const nowIso = new Date().toISOString();
                      const payload = v
                        ? { docs_contacted: true, docs_contacted_at: nowIso }
                        : { docs_contacted: false, docs_contacted_at: null };
                      try {
                        const { error } = await supabase
                          .from('finance_applications')
                          .update(payload)
                          .eq('id', pendingApp.id);
                        if (error) throw error;
                        setPendingApp({ ...pendingApp, ...payload });
                        refetch();
                      } catch (e: any) {
                        toast({ title: 'Failed to update', variant: 'destructive' });
                      }
                    }}
                  />
                  <Label htmlFor="docs-contacted" className="text-sm text-foreground cursor-pointer">
                    Contacted (Requested Documents)
                  </Label>
                  {dbChecked && stale && (
                    <span className="ml-auto text-[10px] text-amber-400/80 uppercase tracking-wider">Auto-reset (20h)</span>
                  )}
                </div>
              );
            })()}
            {/* Preset directed-note buttons — one click stamps the typed comment AND
                routes it to the right team's Action Feed (which is live/realtime). */}
            {(role === 'f_and_i' || role === 'senior_f_and_i' || role === 'super_admin') && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {(role === 'f_and_i' || role === 'super_admin') && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => confirmStatusUpdate('note_to_senior_f_and_i')}
                    className="flex-1 border-purple-500/50 text-purple-300 hover:bg-purple-900/30"
                  >
                    ⬆ Send note to Senior F&amp;I
                  </Button>
                )}
                {(role === 'senior_f_and_i' || role === 'super_admin') && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => confirmStatusUpdate('note_to_f_and_i')}
                    className="flex-1 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/30"
                  >
                    ↩ Save &amp; send update back to F&amp;I
                  </Button>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStatusModalOpen(false)}>Cancel</Button>
              <Button onClick={() => confirmStatusUpdate()} className="bg-emerald-600 hover:bg-emerald-700 text-white">Save Update</Button>
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

      <BankReferenceModal
        open={editBankRefOpen}
        onOpenChange={(o) => { setEditBankRefOpen(o); if (!o) setEditBankRefApp(null); }}
        defaultValue={(editBankRefApp as any)?.bank_reference || ''}
        showFAndIAssignment
        defaultFAndIId={(editBankRefApp as any)?.assigned_f_and_i || null}
        clientName={`${(editBankRefApp as any)?.first_name || ''} ${(editBankRefApp as any)?.last_name || ''}`.trim() || (editBankRefApp as any)?.full_name || ''}
        docsReceived={!!((editBankRefApp as any)?.docs_email || (editBankRefApp as any)?.docs_whatsapp)}
        onConfirm={async (reference, fniId) => {
          if (!editBankRefApp) return;
          try {
            const updates: any = { bank_reference: reference };
            if (fniId !== undefined) {
              updates.assigned_f_and_i = fniId;
              updates.assigned_f_and_i_at = fniId ? new Date().toISOString() : null;
            }
            await updateApplication.mutateAsync({
              id: editBankRefApp.id,
              updates,
            });
            refetch();
          } catch (err) {
            // error toast handled by hook
          }
        }}
      />

      <BankReferenceModal
        open={bankRefModalOpen}
        onOpenChange={(o) => { setBankRefModalOpen(o); if (!o) setBankRefApp(null); }}
        defaultValue={(bankRefApp as any)?.bank_reference || ''}
        showFAndIAssignment
        defaultFAndIId={(bankRefApp as any)?.assigned_f_and_i || null}
        clientName={`${(bankRefApp as any)?.first_name || ''} ${(bankRefApp as any)?.last_name || ''}`.trim() || (bankRefApp as any)?.full_name || ''}
        docsReceived={!!((bankRefApp as any)?.docs_email || (bankRefApp as any)?.docs_whatsapp)}
        onConfirm={async (reference, fniId) => {
          if (!bankRefApp) return;
          try {
            const updates: any = { status: bankRefTargetStatus, bank_reference: reference };
            // Honor explicit manual assignment from the popup. `null` => unassign.
            if (fniId !== undefined) {
              updates.assigned_f_and_i = fniId;
              updates.assigned_f_and_i_at = fniId ? new Date().toISOString() : null;
            }
            await updateApplication.mutateAsync({ id: bankRefApp.id, updates });
          } catch (err) {
            // error toast handled by hook
          }
        }}
      />

      {/* Comment gate for the inline status dropdown — pops when the target status
          has comment_required. Confirm runs the standard finance write + note. */}
      {commentGate && (
        <CommentGateModal
          open
          required={commentRequiredFor(commentGate.status)}
          prompt={commentPromptFor(commentGate.status)}
          onCancel={() => setCommentGate(null)}
          onConfirm={(comment) => {
            const { app, status } = commentGate;
            setCommentGate(null);
            void performFinanceStatusWrite(app, status, comment);
          }}
        />
      )}

      <CreditCheckReportModal open={creditReportOpen} onOpenChange={setCreditReportOpen} />

      {creditCheckApp && (
        <CreditCheckResultModal
          open={creditCheckOpen}
          onOpenChange={(o) => { setCreditCheckOpen(o); if (!o) setCreditCheckApp(null); }}
          outcome={creditCheckOutcome}
          applicationId={creditCheckApp.id}
        />
      )}
    </AdminLayout>
  );
};

export default AdminFinance;
