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
import AddManualEntryModal from '@/components/admin/AddManualEntryModal';
import BankReferenceModal from '@/components/admin/BankReferenceModal';
import BankReferenceBadge from '@/components/admin/BankReferenceBadge';
import CreditCheckReportModal from '@/components/admin/CreditCheckReportModal';
import CreditCheckResultModal, { type CreditCheckOutcome } from '@/components/admin/CreditCheckResultModal';
import AdminLayout from '@/components/admin/AdminLayout';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { sourceLabel } from '@/lib/pipelinev2/source';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useFinanceApplications, useUpdateFinanceApplication, useDeleteFinanceApplication, FinanceApplication } from '@/hooks/useFinanceApplications';
import { formatPrice } from '@/hooks/useVehicles';
import { STATUS_OPTIONS, ADMIN_STATUS_LABELS, STATUS_STEP_ORDER, getWhatsAppMessage, canShowDealActions, statusBadgeClass } from '@/lib/statusConfig';
import { generateOutstandingFeedbackPDF, OUTSTANDING_FEEDBACK_STATUSES } from '@/lib/generateOutstandingFeedbackPDF';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { useDeskTheme } from '@/hooks/useDeskTheme';
import { filterStatusOptionsForRole } from '@/lib/roleStatusFilter';
import { INTERNAL_STATUSES, type InternalStatus, normalizeInternalStatus } from '@/lib/internalStatusConfig';
import { CommentGateModal } from '@/components/admin/CommentGateModal';
import { CreditScanButton } from '@/components/finance/CreditScanButton';
import { addPipelineNote } from '@/lib/pipelinev2/notes';
import { HistoryFeed } from '@/components/admin/pipelinev2/HistoryFeed';
import { CONTACT_TTL_MS, isArchivedApp, canSeeApplication } from '@/lib/finance/shared';
import { ageInStatusMs, setSlaOverrides, isStalled } from '@/lib/finance/sla';
import { KpiStrip } from '@/components/admin/finance/KpiStrip';
import { bucketStatuses } from '@/lib/finance/buckets';
import { useMyAppVisibility } from '@/hooks/useAppVisibility';
import { AgeChip } from '@/components/admin/finance/AgeChip';
import { DocsChecklistChip } from '@/components/admin/finance/DocsChecklistChip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Wrench, Bookmark, ListChecks, X } from 'lucide-react';
import { ApplicationTable } from '@/components/admin/pipelinev2/ApplicationTable';
import { ColumnsPicker } from '@/components/admin/pipelinev2/ColumnsPicker';
import { BulkStatusModal } from '@/components/admin/pipelinev2/BulkStatusModal';
import { loadConfig, type TableConfig } from '@/lib/pipelinev2/columns';
import { buildFacets, rowPassesColumnFilters, isFilterable, type FilterableKey } from '@/lib/pipelinev2/filters';
import { useSavedViews } from '@/hooks/useSavedViews';

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
  const { labelFor, whatsappMessageFor, commentRequiredFor, commentPromptFor, clientLabels, slaHoursMap } = useStatusConfig();

  // Owner-tunable SLAs (P4): push the settings map into the sla module so every
  // consumer (AgeChip, Stalled queue, KPI strip, this page's filter) resolves
  // overrides first. The state bump forces one re-render after the map lands.
  const [, bumpSlaVersion] = useState(0);
  useEffect(() => {
    setSlaOverrides(slaHoursMap);
    bumpSlaVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(slaHoursMap)]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // Owner-configured per-user visibility rule (Settings → Team). Caps which
  // applications this user can see; the F&I dropdown narrows within it.
  const myVisibility = useMyAppVisibility();
  // KPI-strip bucket filter (restored on owner request). 'stalled'/'declined'
  // buckets carry their own scope (active SLA breaches / last-30d any-archive).
  const [bucketFilter, setBucketFilter] = useState<string | null>(null);
  // Table modernization (redesign P3): shared ApplicationTable machinery.
  const [tableConfig, setTableConfig] = useState<TableConfig>(() => {
    const cfg = loadConfig('finance');
    // Self-heal configs saved before the Credit Check column existed (owner
    // rule 2026-07-15: credit check sits CENTER, right after Status).
    if (!cfg.visible.includes('credit')) {
      const at = cfg.visible.indexOf('status');
      cfg.visible = at >= 0
        ? [...cfg.visible.slice(0, at + 1), 'credit', ...cfg.visible.slice(at + 1)]
        : [...cfg.visible, 'credit'];
    }
    return cfg;
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [sortKey, setSortKey] = useState<'newest' | 'oldest' | 'age' | 'name'>('newest');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
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
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [creditCheckOpen, setCreditCheckOpen] = useState(false);
  const [creditCheckApp, setCreditCheckApp] = useState<FinanceApplication | null>(null);
  const [creditCheckOutcome, setCreditCheckOutcome] = useState<CreditCheckOutcome>('passed');
  // Role-restricted notification feed filter (super_admin + senior_f_and_i only).
  // 'auto' = role-default behavior. 'f_and_i' or 'admin' = forced view.
  const [notificationFilter, setNotificationFilter] = useState<'admin' | 'senior' | 'f_and_i'>('admin');
  // Action Feed shows 5 rows by default; expand for the rest (layout cleanup P2).
  const [feedExpanded, setFeedExpanded] = useState(false);

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
  // `extra` carries additional columns captured before the gate popped (e.g. the
  // bank-reference + F&I assignment from the bank-ref modal) so gating never
  // loses them — they land in the same single hook write as the status.
  const [commentGate, setCommentGate] = useState<{ app: FinanceApplication; status: string; extra?: any } | null>(null);

  // Action Feed → row scroll/highlight. ApplicationTable owns the render window
  // now: pendingScrollId rides in as ensureVisibleId and the table grows its own
  // window + scrolls, then clears it via onEnsuredVisible.
  const [highlightedAppId, setHighlightedAppId] = useState<string | null>(null);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  const focusApplicationRow = (app: FinanceApplication) => {
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

  // ?app=<id> deep-link (e.g. from Referrals): once the list is loaded, jump to
  // and highlight the row exactly like an Action Feed click. Runs once per id.
  const deepLinkedRef = useRef<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('app');
    if (!id || deepLinkedRef.current === id || applications.length === 0) return;
    const target = applications.find((a) => a.id === id);
    if (target) {
      deepLinkedRef.current = id;
      focusApplicationRow(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications]);

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

  // "Outstanding bank feedback" one-pager — every app still awaiting bank
  // feedback (ready_to_submit / submitted_to_banks / sent_to_banks), grouped by
  // status, for the owner to WhatsApp to the F&I as a paper tick-list. The
  // hook already holds the FULL application list in memory, so filtering it
  // covers every matching app — not just the scroll-loaded window.
  const downloadOutstandingFeedbackPDF = () => {
    const outstanding = applications.filter(a =>
      (OUTSTANDING_FEEDBACK_STATUSES as readonly string[]).includes((a.status || '').toLowerCase().trim())
    );
    if (outstanding.length === 0) {
      toast({
        title: "Nothing outstanding",
        description: "No applications are currently awaiting bank feedback.",
      });
      return;
    }
    generateOutstandingFeedbackPDF(outstanding, labelFor);
    toast({
      title: "Feedback PDF downloaded",
      description: `${outstanding.length} application${outstanding.length === 1 ? '' : 's'} awaiting bank feedback.`,
    });
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

    // Visibility rule first (Settings → Team; admins always see all), then the
    // F&I dropdown narrows WITHIN what the rule allows.
    let matchesFni = canSeeApplication({
      owner, effectivelyUnassigned, role, userId: user?.id, rule: myVisibility,
    });
    if (matchesFni && role !== 'f_and_i') {
      if (fniFilter === 'self') matchesFni = owner === user?.id;
      else if (fniFilter === 'unassigned') matchesFni = effectivelyUnassigned;
      else if (fniFilter !== 'all') matchesFni = owner === fniFilter;
    }

    // KPI-strip bucket filter. 'stalled' and 'declined' carry their own scope;
    // other buckets are plain status groupings.
    let matchesBucket = true;
    if (bucketFilter === 'stalled') {
      matchesBucket = !isArchivedApp(app, role) && isStalled(app as any);
    } else if (bucketFilter === 'declined') {
      const t = (app as any).status_updated_at || app.updated_at;
      matchesBucket = ['declined', 'declined_conditional', 'blacklisted'].includes(app.status || '')
        && !!t && Date.now() - new Date(t).getTime() < 30 * 24 * 3600 * 1000;
    } else if (bucketFilter) {
      matchesBucket = bucketStatuses(bucketFilter).includes(app.status || '');
    }

    // Filter by active/archived — ONE shared rule (lib/finance/shared). For F&I,
    // terminal success statuses, 'archived' and cancelled/ghosted go to the Archive
    // tab while Declined/Blacklisted stay in Active; other roles use the legacy
    // is_archived-or-terminal behaviour. The stalled/declined buckets override the
    // tab split — their definitions already pin the scope.
    const matchesViewMode = (bucketFilter === 'stalled' || bucketFilter === 'declined')
      ? true
      : viewMode === 'archived' ? isArchivedApp(app, role) : !isArchivedApp(app, role);

    return matchesSearch && matchesStatus && matchesBucket && matchesFni && matchesViewMode;
  });

  // ── P3 table machinery: column filters → sort → facets → selection ─────────
  // Per-column facet filters compose with the page filters above.
  const columnFilteredApplications = filteredApplications.filter((a) =>
    rowPassesColumnFilters(a, columnFilters, { statusLabels: ADMIN_STATUS_LABELS, clientLabels }),
  );

  const sortedApplications = [...columnFilteredApplications].sort((a, b) => {
    switch (sortKey) {
      case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'age': return ageInStatusMs(b as any) - ageInStatusMs(a as any); // longest-waiting first
      case 'name': return (a.full_name || `${a.first_name} ${a.last_name}`).localeCompare(b.full_name || `${b.first_name} ${b.last_name}`);
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // newest
    }
  });

  // Facet options derive from the rows BEFORE column filters (stable option lists),
  // only for visible+filterable columns.
  const facets = buildFacets(
    filteredApplications,
    tableConfig.visible.filter((k) => isFilterable(k)) as FilterableKey[],
    { statusLabels: ADMIN_STATUS_LABELS, clientLabels },
  );

  // Bulk selection. Selection survives filter tweaks (ids, not indexes); the
  // bulk bar clears it after each batch.
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleSelectAll = (ids: string[], select: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) select ? next.add(id) : next.delete(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  // Bulk assign-F&I / archive — sequential per-row writes through the ONE hook
  // (assignment/archive-only writes fire no status side-effects there).
  const [bulkBusy, setBulkBusy] = useState(false);
  const runBulk = async (label: string, updatesFor: () => any) => {
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const id of Array.from(selectedIds)) {
      try { await updateApplication.mutateAsync({ id, updates: updatesFor() }); ok++; }
      catch { fail++; }
    }
    setBulkBusy(false);
    clearSelection();
    toast({ title: `${label}: ${ok} updated${fail ? `, ${fail} failed` : ''}` });
  };
  const bulkAssignFni = (fniId: string | null) =>
    runBulk(fniId ? 'Assigned F&I' : 'Unassigned F&I', () => ({
      assigned_f_and_i: fniId,
      assigned_f_and_i_at: fniId ? new Date().toISOString() : null,
    }));
  const bulkArchive = () => runBulk('Archived', () => ({ is_archived: true }));

  // Saved views — named filter presets per user (same machinery as Pipeline).
  interface FinanceViewPreset {
    searchQuery: string; statusFilter: string; bucketFilter?: string | null;
    fniFilter: string; viewMode: 'active' | 'archived'; sortKey: typeof sortKey;
  }
  const { views: savedViews, saveView, deleteView } = useSavedViews<FinanceViewPreset>('finance', user?.id);
  const [viewNameDraft, setViewNameDraft] = useState('');
  const applyView = (p: FinanceViewPreset) => {
    setSearchQuery(p.searchQuery ?? '');
    setStatusFilter(p.statusFilter ?? 'all');
    setBucketFilter(p.bucketFilter ?? null);
    setFniFilter(p.fniFilter ?? 'all');
    setViewMode(p.viewMode ?? 'active');
    setSortKey(p.sortKey ?? 'newest');
  };
  const currentPreset = (): FinanceViewPreset =>
    ({ searchQuery, statusFilter, bucketFilter, fniFilter, viewMode, sortKey });

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
      // F&I claims ownership only when the file is UNASSIGNED — an existing
      // assignment is never overwritten by another F&I touching the file
      // (owner rule 2026-07-14). Re-assignment happens only via the explicit
      // Assign F&I picker.
      if (role === 'f_and_i' && actingUser?.id && !(pendingApp as any)?.assigned_f_and_i) {
        updatePayload.assigned_f_and_i = actingUser.id;
        updatePayload.assigned_f_and_i_at = new Date().toISOString();
      }

      // Auto-reset enforcement: if the docs-contacted tick is older than the
      // shared TTL, flush it back to false on the next save so DB matches UI.
      const dca = (pendingApp as any)?.docs_contacted_at;
      if ((pendingApp as any)?.docs_contacted && dca && (Date.now() - new Date(dca).getTime() > CONTACT_TTL_MS)) {
        updatePayload.docs_contacted = false;
        updatePayload.docs_contacted_at = null;
      }
      const { error } = await supabase
        .from('finance_applications')
        .update(updatePayload)
        .eq('id', pendingApp.id);
      if (error) throw error;

      // Dual-sync to Universal Timeline — application_id makes the entry show up
      // in per-application feeds (HistoryFeed), not just the client-wide trail.
      await supabase.from('client_audit_logs').insert([{
        client_email: pendingApp.email || null,
        client_phone: pendingApp.phone || null,
        note: `«${roleTag}» ${actingName} — [Internal Status → ${INTERNAL_STATUSES[statusKey as keyof typeof INTERNAL_STATUSES]?.label || statusKey}] ${statusNote || 'No comment'}`,
        author_id: actingUser?.id || null,
        author_name: actingName,
        action_type: 'Internal Status Update',
        application_id: pendingApp.id,
      } as any]);

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
  const performFinanceStatusWrite = async (app: FinanceApplication, newStatus: string, comment?: string, extraUpdates?: any) => {
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
          ...(extraUpdates || {}),
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
              // Claim only when unassigned — never steal another F&I's file.
              ...(role === 'f_and_i' && actingUser?.id && !(app as any).assigned_f_and_i ? {
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
            application_id: app.id,
          } as any]);
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

  // Stats for active applications only — same shared rule as the tab filter,
  // so the counters can never drift from what the table shows.
  const activeApps = applications.filter(a => !isArchivedApp(a, role));

  // ── Finance cell renderers for the shared ApplicationTable (redesign P3) ──
  // The bespoke cells of the old hand-rolled table, ported verbatim: identity
  // (client hub + bank ref + F&I chip + indicator cluster), EasySocial phone,
  // internal-status dropdown + notes button, and the actions strip. Returning
  // undefined for any other key falls back to ApplicationTable's built-ins.
  const renderFinanceCell = (key: string, app: FinanceApplication): React.ReactNode | undefined => {
    const any = app as any;
    switch (key) {
      case 'applicant': {
        const noLicense = any.has_drivers_license === false;
        const cs = (any.credit_score_status || '') as string;
        const HIGH_RISK_CREDIT_LABELS: Record<string, string> = {
          blacklisted: 'Blacklisted', debt_review: 'Debt Review', judgements: 'Judgements',
          defaults_arrears: 'Defaults/Arrears', bad: 'Bad Credit',
        };
        const creditRiskLabel = HIGH_RISK_CREDIT_LABELS[cs];
        const riskReason = creditRiskLabel ? `Risk: ${creditRiskLabel}` : noLicense ? 'Risk: No License' : null;
        const stepIdx = STATUS_STEP_ORDER[app.status] ?? 0;
        const hasNotes = !!(app.notes && String(app.notes).trim().length > 0);
        const isNew = Date.now() - new Date(app.created_at).getTime() < 24 * 3600_000 && stepIdx < 2 && !hasNotes;
        const isStagnant = Date.now() - new Date(app.updated_at || app.created_at).getTime() > 72 * 3600_000;
        const creator = any.creator;
        const fni = any.fni_owner;
        const canReassign = role === 'super_admin' || role === 'senior_f_and_i';
        const chipBase = 'inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] uppercase tracking-wider font-semibold border transition-colors';
        const indicatorBase = 'inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] uppercase tracking-wider font-medium border whitespace-nowrap';
        const iconTileBase = 'inline-flex items-center justify-center h-5 w-5 rounded border';
        const src = any.submission_source;
        const srcIcon = src === 'whatsapp_parser' ? <MessageCircle className="w-3 h-3" />
          : src === 'website' ? <Globe className="w-3 h-3" /> : <FileText className="w-3 h-3" />;
        const srcLabel = src === 'whatsapp_parser' ? 'WhatsApp PDF'
          : src === 'website' ? 'Website'
          : src && String(src).trim() !== '' ? sourceLabel(src) : 'Legacy';
        const dEmail = !!any.docs_email;
        const dWa = !!any.docs_whatsapp;
        const hasDocs = dEmail || dWa;
        const fniFirst = fni?.full_name ? String(fni.full_name).trim().split(/\s+/)[0]
          : fni?.email ? String(fni.email).split('@')[0] : null;
        return (
          <div className="flex flex-col gap-1.5 min-w-[15rem]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.preventDefault(); openClientHub(app.email, app.phone); }}
              className="group/name text-left focus:outline-none"
            >
              <p className="font-medium text-foreground flex items-center gap-2 flex-wrap group-hover/name:text-emerald-400 group-hover/name:underline transition-colors">
                {any.bank_reference && (
                  <BankReferenceBadge
                    reference={any.bank_reference}
                    onEdit={canReassign ? () => { setEditBankRefApp(app); setEditBankRefOpen(true); } : undefined}
                  />
                )}
                <span>{app.first_name} {app.last_name}</span>
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[15rem]">{app.email || '—'}</p>
              {(creator?.full_name || creator?.email) && (
                <p className="text-[10px] text-muted-foreground/80 mt-0.5 flex items-center gap-1">
                  <User className="w-2.5 h-2.5" />
                  <span className="font-medium">Rep:</span>{' '}
                  <span>{creator.full_name ? String(creator.full_name).trim().split(/\s+/)[0] : String(creator.email).split('@')[0]}</span>
                </p>
              )}
            </button>
            {/* F&I assignment chip */}
            {!fniFirst ? (canReassign && (
              <button type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditBankRefApp(app); setEditBankRefOpen(true); }}
                className={`${chipBase} w-fit text-muted-foreground border-border bg-muted/40 hover:bg-muted/70 hover:text-foreground`}
                title="Assign F&I">
                + Assign F&amp;I
              </button>
            )) : canReassign ? (
              <button type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditBankRefApp(app); setEditBankRefOpen(true); }}
                className={`${chipBase} w-fit text-pink-400 border-pink-500/40 bg-pink-500/10 hover:bg-pink-500/20 cursor-pointer`}
                title={`Reassign F&I (current: ${fni.full_name || fni.email})`}>
                <User className="w-2.5 h-2.5" /> F&amp;I: {fniFirst}
              </button>
            ) : (
              <span className={`${chipBase} w-fit text-pink-400 border-pink-500/40 bg-pink-500/10`} title={`Assigned F&I: ${fni.full_name || fni.email}`}>
                <User className="w-2.5 h-2.5" /> F&amp;I: {fniFirst}
              </span>
            )}
            {/* Secondary indicators */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {isNew && <span className={`${indicatorBase} font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-400`}>🔥 NEW</span>}
              {isStagnant && !isNew && <span className={`${indicatorBase} font-bold border-orange-500/30 bg-orange-500/10 text-orange-400`}>⏳ STALE</span>}
              {riskReason && <span className={`${indicatorBase} font-bold border-red-500/30 bg-red-500/10 text-red-400`} title={riskReason}>⚠ {riskReason}</span>}
              <span className={`${iconTileBase} border-border bg-muted/40 text-muted-foreground`} title={`Source: ${srcLabel}`} aria-label={`Source: ${srcLabel}`}>{srcIcon}</span>
              {hasDocs ? (
                <span className={`${iconTileBase} border-border bg-muted/40 text-muted-foreground`} title={`Docs received via ${[dEmail && 'Email', dWa && 'WhatsApp'].filter(Boolean).join(' & ')}`}>
                  {dEmail && <Mail className="w-3 h-3" />}
                  {dWa && <MessageCircle className="w-3 h-3" />}
                </span>
              ) : (
                <span className={`${indicatorBase} border-red-500/30 bg-red-500/10 text-red-400`} title="No documents received yet">
                  <FileX className="w-3 h-3" /> No Docs
                </span>
              )}
            </div>
          </div>
        );
      }
      case 'phone': {
        const cleaned = app.phone?.replace(/\D/g, '') || '';
        const wa = cleaned.startsWith('0') ? `27${cleaned.slice(1)}` : cleaned;
        return app.phone ? (
          <button type="button"
            onClick={(e) => {
              e.stopPropagation();
              // EasySocial has no phone deep-link: copy the number + open the chat
              // panel in ONE reused tab — paste into its search to land on the client.
              navigator.clipboard?.writeText(wa).catch(() => {});
              window.open('https://app.easysocial.io/engage/chat?tab=all', 'easysocialChat');
              toast({ title: 'Number copied', description: 'EasySocial opened — paste (Ctrl+V) into its chat search to jump to this client.' });
            }}
            className="inline-flex items-center gap-1.5 text-sm text-green-500 hover:text-green-400 transition-colors tabular-nums whitespace-nowrap"
            title="Open this client in EasySocial chat (copies the number)">
            <MessageCircle className="w-4 h-4 fill-green-500/20 shrink-0" />
            {app.phone}
          </button>
        ) : <span className="text-muted-foreground text-sm">N/A</span>;
      }
      case 'internal': {
        const safeStatusKey = getDisplayStatus(app);
        const statusConfig = INTERNAL_STATUSES[safeStatusKey as keyof typeof INTERNAL_STATUSES] || INTERNAL_STATUSES.no_notes;
        const hasNotes = !!(app.notes && String(app.notes).trim().length > 0);
        const normInt = normalizeInternalStatus(any.internal_status);
        const alertSet = role === 'senior_f_and_i'
          ? new Set(['note_to_f_and_i', 'note_to_senior_f_and_i'])
          : role === 'f_and_i' ? new Set(['note_to_f_and_i']) : new Set(['note_to_admin']);
        const showDot = !!normInt && normInt !== 'no_notes' && alertSet.has(normInt);
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Select value={safeStatusKey} onValueChange={(value) => handleStatusDropdownChange(app, value)}>
              <SelectTrigger className={`w-[200px] h-7 text-xs border ${statusConfig.color}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(INTERNAL_STATUSES) as [InternalStatus, typeof INTERNAL_STATUSES[InternalStatus]][]).map(([k, val]) => (
                  <SelectItem key={k} value={k} className="text-xs">{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPendingApp(app);
                setPendingStatus(normalizeInternalStatus(any.internal_status) || 'no_notes');
                setStatusNote('');
                setStatusModalOpen(true);
              }}
              className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
              title={hasNotes ? 'View Notes' : 'Add Note'}>
              <span className="text-xs leading-none">📝</span>
              {showDot && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-background" />}
            </button>
          </div>
        );
      }
      case 'docs':
        return <div onClick={(e) => e.stopPropagation()}><DocsChecklistChip app={app} /></div>;
      case 'age':
        return <AgeChip app={app} />;
      case 'credit': {
        // Credit check — CENTER column (owner rule 2026-07-15) with explicit
        // one-click ✓ Passed / ✗ Failed buttons (each opens the standard
        // CreditCheckResultModal, same flow the old dropdown selections ran)
        // + the CarTrust scan button. Badge shows the current state.
        const cc = any.credit_check_status as 'passed' | 'failed' | 'pending' | null | undefined;
        const badge =
          cc === 'passed'
            ? { txt: 'Passed', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' }
            : cc === 'failed'
              ? { txt: 'Failed', cls: 'bg-red-500/10 text-red-400 border-red-500/30' }
              : cc === 'pending'
                ? { txt: 'Pending', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' }
                : { txt: 'Not Run', cls: 'bg-muted/40 text-muted-foreground border-border' };
        const openOutcome = (outcome: CreditCheckOutcome) => {
          setCreditCheckApp(app);
          setCreditCheckOutcome(outcome);
          setCreditCheckOpen(true);
        };
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <span className={`inline-flex items-center h-7 px-2 rounded border text-xs uppercase tracking-wider whitespace-nowrap ${badge.cls}`}>
              {badge.txt}
            </span>
            <CreditScanButton application={app} />
            {/* Outcome buttons ONLY while the scan is PENDING (owner rules
                2026-07-15): Not Run has nothing to pass/fail, and a recorded
                Passed/Failed shows just the badge — re-running the scan flips
                it back to Pending if the outcome must change. */}
            {cc === 'pending' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => openOutcome('passed')}
                  title="Credit check passed — attach the report & pick the next status"
                >
                  ✓ Passed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10"
                  onClick={() => openOutcome('failed')}
                  title="Credit check failed — attach the report & pick the next status"
                >
                  ✗ Failed
                </Button>
              </>
            )}
          </div>
        );
      }
      case 'actions':
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {['pending', 'application_submitted', 'pre_approved', 'documents_received', 'revision_submitted'].includes(app.status) && (
              <Button variant="ghost" size="icon" onClick={(e) => handleRequestRevision(app, e)}
                className="text-pink-500 hover:text-pink-400 hover:bg-pink-500/10" title="Request Client Revision">
                <MailWarning className="w-4 h-4" />
              </Button>
            )}
            {['pre_approved', 'approved', 'vehicle_selected', 'contract_signed', 'vehicle_delivered'].includes(app.status) && (
              <Button variant="ghost" size="icon" onClick={(e) => openDeliveryModal(app, e)}
                className="text-purple-500 hover:text-purple-400 hover:bg-purple-500/10" title="Delivery Prep Checklist">
                <ClipboardList className="w-4 h-4" />
              </Button>
            )}
            {app.status === 'pre_approved' && any.access_token && (
              <Button variant="ghost" size="icon" onClick={() => copyUploadLink(any.access_token)}
                className="text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10" title="Copy Document Upload Link">
                <Link className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => openWhatsApp(app)}
              className="text-green-500 hover:text-green-400 hover:bg-green-500/10" title="Send WhatsApp Update">
              <MessageCircle className="w-4 h-4" />
            </Button>
            {!any.is_archived && app.status !== 'archived' && (
              <Button variant="ghost" size="icon" onClick={(e) => handleArchive(app, e)}
                className="text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10" title="Archive Application">
                <Archive className="w-4 h-4" />
              </Button>
            )}
            {isSuperAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon"
                    className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10" title="Delete Application">
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
                    <AlertDialogAction onClick={() => handleDelete(app.id)} className="bg-destructive hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        );
      default:
        return undefined;
    }
  };

  // Row tint parity with the old table: pre-approved glow, NEW/stale hints,
  // Action-Feed highlight pulse.
  const financeRowClass = (app: FinanceApplication): string => {
    const stepIdx = STATUS_STEP_ORDER[app.status] ?? 0;
    const hasNotes = !!(app.notes && String(app.notes).trim().length > 0);
    const isNew = Date.now() - new Date(app.created_at).getTime() < 24 * 3600_000 && stepIdx < 2 && !hasNotes;
    const isStagnant = Date.now() - new Date(app.updated_at || app.created_at).getTime() > 72 * 3600_000;
    return [
      app.status === 'pre_approved' ? 'bg-green-900/10 shadow-[inset_4px_0_0_0_rgba(34,197,94,0.8)]' : '',
      isNew ? 'bg-emerald-500/5' : '',
      isStagnant ? 'bg-orange-500/5' : '',
      highlightedAppId === app.id ? 'ring-2 ring-amber-300/70 bg-amber-300/10 animate-pulse' : '',
    ].filter(Boolean).join(' ');
  };

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
            {/* Tools ▾ — absorbs the 7 secondary header buttons (layout cleanup P2) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-fit">
                  <Wrench className="w-4 h-4 mr-2" />
                  Tools
                  <ChevronDown className="w-3.5 h-3.5 ml-1.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setManualEntryOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" /> Add Manual Entry
                </DropdownMenuItem>
                {(isSuperAdmin || isSeniorFAndI) && (
                  <DropdownMenuItem onClick={() => setCashDealModalOpen(true)}>
                    <Banknote className="w-4 h-4 mr-2" /> Cash Deal
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate(ADMIN_ROUTES.quotes)}>
                  <Calculator className="w-4 h-4 mr-2" /> Quote Generator
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCreditReportOpen(true)}>
                  <BarChart3 className="w-4 h-4 mr-2 text-amber-400" /> Credit Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadOutstandingFeedbackPDF}>
                  <ClipboardList className="w-4 h-4 mr-2 text-sky-400" /> Feedback PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWaModalOpen(true)}>
                  <MessageSquare className="w-4 h-4 mr-2 text-emerald-500" /> WhatsApp to PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyInfoRequestTemplate}>
                  <Copy className="w-4 h-4 mr-2" /> Copy Info Request
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => navigate(ADMIN_ROUTES.financeCreate)} className="w-fit">
              <UserPlus className="w-4 h-4 mr-2" />
              Create Application
            </Button>
          </>
        }
      />

      <div className="p-6">

        {/* Clickable KPI strip (restored on owner request 2026-07-15) — click a
            tile to filter the table to that bucket; click again to clear. */}
        <KpiStrip
          applications={applications}
          activeApps={activeApps}
          activeBucket={bucketFilter}
          onBucketClick={(key) => {
            setBucketFilter((prev) => (prev === key ? null : key));
            setStatusFilter('all'); // bucket and the status dropdown never fight
          }}
        />



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
                  : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          );
          return (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-[#1A1A1A] border border-zinc-800 rounded-lg p-4 mb-6 flex flex-col gap-2"
            >
              {canToggle && (
                <div className="flex items-center gap-2 pb-2 mb-1 border-b border-zinc-800/80">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mr-1">View</span>
                  {toggleBtn('admin', 'Admin', 'bg-red-900/40 text-red-400 border-red-500/50')}
                  {toggleBtn('senior', 'Senior F&I', 'bg-purple-900/40 text-purple-400 border-purple-500/50')}
                  {toggleBtn('f_and_i', 'F&I Team', 'bg-emerald-900/40 text-emerald-400 border-emerald-500/50')}
                </div>
              )}
              {feed.length === 0 ? (
                <p className="text-[11px] text-zinc-500 py-2">No items in this feed.</p>
              ) : (
              <>
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300/80 font-medium flex items-center gap-2">
                  <MailWarning className="w-3.5 h-3.5" />
                  {headerLabel}
                </p>
                <span className="text-[10px] text-zinc-500">
                  {feed.length} ready for review
                </span>
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                {(feedExpanded ? feed : feed.slice(0, 5)).map((app: any) => {
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
                    ? 'group-hover:text-red-200'
                    : effectiveView === 'senior' ? 'group-hover:text-purple-200' : 'group-hover:text-emerald-200';
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
                      className={`group grid grid-cols-[1fr_auto_auto] md:grid-cols-3 items-center gap-3 px-3 py-2 rounded-md bg-zinc-900/60 border text-left transition-colors ${containerClass}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 justify-self-start">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-pulse shrink-0`} />
                        <span className={`text-sm text-zinc-200 truncate ${textHover}`}>
                          {app.first_name} {app.last_name}
                        </span>
                        <span className="text-[11px] text-zinc-500 truncate hidden sm:inline">
                          {subLabel}
                        </span>
                      </div>
                      <div className="hidden md:flex justify-center text-[11px] text-zinc-500 font-mono tracking-wide whitespace-nowrap">
                        {formattedDate}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 shrink-0 justify-self-end whitespace-nowrap">
                        {ADMIN_STATUS_LABELS[app.status] || app.status} →
                      </span>
                    </button>
                  );
                })}
                {feed.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setFeedExpanded((e) => !e)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 py-1 text-left transition-colors"
                  >
                    {feedExpanded ? '▲ Show fewer' : `▼ Show all ${feed.length}`}
                  </button>
                )}
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

        {/* Table toolbar — sort, saved views, column picker (redesign P3) */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as any)}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest" className="text-xs">Newest first</SelectItem>
              <SelectItem value="oldest" className="text-xs">Oldest first</SelectItem>
              <SelectItem value="age" className="text-xs">Longest in status</SelectItem>
              <SelectItem value="name" className="text-xs">Name A–Z</SelectItem>
            </SelectContent>
          </Select>
          {/* Saved views — named filter presets, per user (same hook as Pipeline) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Bookmark className="w-3.5 h-3.5 mr-1.5" /> Views{savedViews.length > 0 ? ` (${savedViews.length})` : ''}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Saved views</p>
              <div className="space-y-1 mb-3 max-h-48 overflow-auto">
                {savedViews.length === 0 && <p className="text-xs text-muted-foreground">No saved views yet — set your filters, then save them here.</p>}
                {savedViews.map((v) => (
                  <div key={v.id} className="flex items-center gap-1">
                    <button type="button" onClick={() => applyView(v.preset)}
                      className="flex-1 text-left text-sm px-2 py-1 rounded hover:bg-muted/60 truncate" title="Apply this view">
                      {v.name}
                    </button>
                    <button type="button" onClick={() => deleteView(v.id)}
                      className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-red-400" title="Delete view">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Input value={viewNameDraft} onChange={(e) => setViewNameDraft(e.target.value)}
                  placeholder="Name current filters…" className="h-8 text-xs" />
                <Button size="sm" className="h-8" disabled={!viewNameDraft.trim()}
                  onClick={() => { saveView(viewNameDraft, currentPreset()); setViewNameDraft(''); }}>
                  Save
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <ColumnsPicker tabKey="finance" config={tableConfig} onChange={setTableConfig} />
          <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
            {sortedApplications.length} row{sortedApplications.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Bulk bar — appears while rows are selected */}
        {selectedIds.size > 0 && (
          <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 mb-3 px-3 py-2 rounded-lg border border-amber-500/40 bg-[#1A1A1A]/95 shadow-lg">
            <ListChecks className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-foreground tabular-nums">{selectedIds.size} selected</span>
            <Button size="sm" variant="outline" className="h-7" disabled={bulkBusy} onClick={() => setBulkStatusOpen(true)}>
              Change status
            </Button>
            {(isSuperAdmin || isSeniorFAndI) && (
              <Select onValueChange={(v) => void bulkAssignFni(v === '__none__' ? null : v)} disabled={bulkBusy}>
                <SelectTrigger className="w-44 h-7 text-xs"><SelectValue placeholder="Assign F&I…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs">Unassign</SelectItem>
                  {fniUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}{u.role === 'senior_f_and_i' ? ' (Senior)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="outline" className="h-7 border-amber-500/40 text-amber-400 hover:bg-amber-500/10" disabled={bulkBusy} onClick={() => void bulkArchive()}>
              <Archive className="w-3.5 h-3.5 mr-1" /> Archive
            </Button>
            <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={clearSelection}>Clear</Button>
          </div>
        )}

        {/* Table — the shared Pipeline v2 ApplicationTable with the Finance preset:
            the same inline status + credit dropdowns as before (identical
            interceptor chain), plus row selection, column picker, per-column facet
            filters and the docs / age chips. Windowed rendering lives inside. */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <ApplicationTable
              applications={sortedApplications}
              config={tableConfig}
              onSelect={(id) => navigate(`/admin/finance/${id}`)}
              selectable
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              statusSelect={{
                options: (app) => filterStatusOptionsForRole(STATUS_OPTIONS, role, (app as any).status),
                onChange: (app, status) => requestFinanceStatusChange(app, status),
              }}
              windowKey={`${searchQuery}|${statusFilter}|${bucketFilter ?? ''}|${fniFilter}|${viewMode}|${sortKey}`}
              renderExtraCell={renderFinanceCell}
              rowClassName={financeRowClass}
              ensureVisibleId={pendingScrollId}
              onEnsuredVisible={() => setPendingScrollId(null)}
              facets={facets}
              columnFilters={columnFilters}
              onColumnFilterChange={(key, values) => setColumnFilters((prev) => ({ ...prev, [key]: values }))}
            />
          )}
        </motion.div>

        {/* Bulk status change — same per-row hook loop as Pipeline (comment gate
            honored; each row fires exactly the dropdown's existing sends). */}
        {bulkStatusOpen && (
          <BulkStatusModal
            appIds={Array.from(selectedIds)}
            updateApplication={updateApplication}
            role={role}
            onClose={() => setBulkStatusOpen(false)}
            onDone={() => { clearSelection(); refetch(); }}
          />
        )}

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
              // F&I claims ownership when actioning a note — but only if the file
              // is UNASSIGNED (an existing owner is never displaced by activity).
              const fniClaim = role === 'f_and_i' && user?.id && !(pendingApp as any)?.assigned_f_and_i
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
                  const comment = statusNote?.trim();
                  // Route through the shared update hook so the bookkeeping this
                  // path used to skip now fires: status_history + status_updated_at
                  // stamp, activity trail, EasySocial tag-sync. These preset buttons
                  // have NEVER messaged the client — suppressClientNotifications
                  // keeps every client-facing send off (owner rule 2026-07-14).
                  await updateApplication.mutateAsync({
                    id: pendingApp.id,
                    updates: {
                      status: targetStatus,
                      internal_status: 'no_notes',
                      attention_updated_at: new Date().toISOString(),
                      suppressClientNotifications: true,
                      comment: comment || undefined,
                      // Claim only when unassigned — never steal another F&I's file.
                      ...(role === 'f_and_i' && user?.id && !(pendingApp as any)?.assigned_f_and_i ? {
                        assigned_f_and_i: user.id,
                        assigned_f_and_i_at: new Date().toISOString(),
                      } : {}),
                    },
                  });

                  const stamp = new Date().toLocaleString('en-ZA', { hour12: false });
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
                      application_id: pendingApp.id,
                    } as any);
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
                    className="w-full bg-emerald-900/30 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-800/40 transition-colors font-medium px-4 py-3 rounded-md"
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
                              isNewest ? 'bg-yellow-500/10 text-yellow-100' : 'text-muted-foreground bg-background/40',
                            ].join(' ')}
                          >
                            {roleStyle && (
                              <span className={`inline-block mr-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${roleStyle.border} ${roleStyle.text} bg-black/40`}>
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
              {/* Unified timeline — the universal audit trail + structured pipeline
                  notes for THIS application. This is where comment-gate comments
                  (stored in pipeline_notes) and status changes made from any other
                  surface become visible — the CRM blob above never showed them. */}
              {pendingApp && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Full Activity Timeline</Label>
                  <div className="bg-muted/30 border border-border rounded-md max-h-[180px] overflow-auto p-2.5">
                    <HistoryFeed app={pendingApp} />
                  </div>
                </div>
              )}
            </div>
            {/* Pre-Approved doc-request tracker — visible only while the app is in pre_approved.
                Auto-resets visually after 20h, and the next save flushes the stale flag to the DB. */}
            {(pendingApp as any)?.status === 'pre_approved' && (() => {
              const at = (pendingApp as any)?.docs_contacted_at;
              const ageMs = at ? Date.now() - new Date(at).getTime() : Infinity;
              const stale = ageMs > CONTACT_TTL_MS;
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
      <AddManualEntryModal open={manualEntryOpen} onOpenChange={setManualEntryOpen} />

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
          // Bank-ref extras ride along with the status write (single hook call).
          const extra: any = { bank_reference: reference };
          // Honor explicit manual assignment from the popup. `null` => unassign.
          if (fniId !== undefined) {
            extra.assigned_f_and_i = fniId;
            extra.assigned_f_and_i_at = fniId ? new Date().toISOString() : null;
          }
          // This path used to skip the comment gate the plain dropdown enforces —
          // same transition, same gate: pop it and let confirm run the write.
          if (commentRequiredFor(bankRefTargetStatus)) {
            setCommentGate({ app: bankRefApp, status: bankRefTargetStatus, extra });
            return;
          }
          void performFinanceStatusWrite(bankRefApp, bankRefTargetStatus, undefined, extra);
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
            const { app, status, extra } = commentGate;
            setCommentGate(null);
            void performFinanceStatusWrite(app, status, comment, extra);
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
