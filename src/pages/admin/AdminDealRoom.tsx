import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { 
  ArrowLeft, User, MapPin, Building, Wallet, Users, Phone, Mail, 
  MessageCircle, Car, Plus, X, Search, FileText, CheckCircle, AlertTriangle, Copy, Check,
  Download, PartyPopper, Edit2, Save, Building2, FileSignature, Share2, FileDown, ReceiptText,
  CheckCircle2, Zap
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES, quoteBuilderPath } from '@/lib/adminRoutes';
import { validateSaId, isSaIdInvalid } from '@/lib/saIdValidation';
import { isContactFresh } from '@/lib/finance/shared';
import { sendClientEmail } from '@/lib/clientEmail';
import FinancePodiumModal from '@/components/admin/FinancePodiumModal';
import FinalizeDealModal from '@/components/admin/FinalizeDealModal';
import { DealExpensesSection } from '@/components/admin/DealExpensesSection';
import OTPModal from '@/components/admin/OTPModal';
import ClientDocumentViewer from '@/components/admin/ClientDocumentViewer';
import DocumentManager from '@/components/admin/DocumentManager';
import ContractSentModal from '@/components/admin/ContractSentModal';
import BankReferenceModal from '@/components/admin/BankReferenceModal';
import BankReferenceBadge from '@/components/admin/BankReferenceBadge';
import CreditCheckResultModal, { type CreditCheckOutcome } from '@/components/admin/CreditCheckResultModal';
import ClientCockpit from '@/components/admin/ClientCockpit';
import ClientCallTimeline from '@/components/admin/ClientCallTimeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useVehicles, formatPrice } from '@/hooks/useVehicles';
import { useUpdateFinanceApplication, useUpdateClientStatus, FinanceApplication } from '@/hooks/useFinanceApplications';
import { useApplicationMatches, useAddApplicationMatch, useRemoveApplicationMatch } from '@/hooks/useApplicationMatches';
import { useCreateAftersalesRecord } from '@/hooks/useAftersales';
import { STATUS_OPTIONS, getWhatsAppMessage, canShowDealActions } from '@/lib/statusConfig';
import { filterStatusOptionsForRole } from '@/lib/roleStatusFilter';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { StatusSelect } from '@/components/admin/StatusSelect';
import { financeStatusToDealStage } from '@/lib/admin/statusTracks';
import { useStatusConfig } from '@/hooks/useZtcSettings';
import { CommentGateModal } from '@/components/admin/CommentGateModal';
import { addPipelineNote } from '@/lib/pipelinev2/notes';
import { useAuth } from '@/contexts/AuthContext';
import { generateFinancePDF } from '@/lib/generateFinancePDF';
import { PushToSignioButton } from '@/components/finance/PushToSignioButton';
import { useDocumentSettings } from '@/hooks/useDocumentSettings';
import { toast } from 'sonner';

const AdminDealRoom = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, isSuperAdmin, isSeniorFAndI, user } = useAuth();
  const {
    labels: financeLabels, styles: financeStyles, whatsappMessageFor,
    clientStatuses, clientLabels, clientStyles, commentRequiredFor, commentPromptFor,
  } = useStatusConfig();
  const updateClientStatus = useUpdateClientStatus();
  const { data: docSettings } = useDocumentSettings();
  // Only full admins and senior F&I may finalize deals (deal_records hold figures).
  const canFinalize = isSuperAdmin || isSeniorFAndI;
  
  const [application, setApplication] = useState<FinanceApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [approvedBudget, setApprovedBudget] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<FinanceApplication>>({});
  const [podiumModalOpen, setPodiumModalOpen] = useState(false);
  const [finalizeDealModalOpen, setFinalizeDealModalOpen] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [contractSentModalOpen, setContractSentModalOpen] = useState(false);
  const [bankRefModalOpen, setBankRefModalOpen] = useState(false);
  // Which submission status the bank-ref popup is capturing for (ready_to_submit
  // vs application_submitted) — mirrors the Finance list view.
  const [bankRefTargetStatus, setBankRefTargetStatus] = useState<string>('application_submitted');
  const [editBankRefOpen, setEditBankRefOpen] = useState(false);
  const [creditCheckModalOpen, setCreditCheckModalOpen] = useState(false);
  const [creditCheckOutcome, setCreditCheckOutcome] = useState<CreditCheckOutcome>('passed');
  const [revisionConfirmOpen, setRevisionConfirmOpen] = useState(false);
  // Comment-gate interception. `track` distinguishes which writer to call on confirm.
  const [commentGate, setCommentGate] = useState<{ track: 'finance' | 'client'; status: string } | null>(null);

  const { data: vehicles = [], refetch: refetchVehicles } = useVehicles();
  const { data: matches = [], isLoading: matchesLoading, refetch: refetchMatches } = useApplicationMatches(id || '');
  const updateApplication = useUpdateFinanceApplication();
  const addMatch = useAddApplicationMatch();
  const removeMatch = useRemoveApplicationMatch();
  const createAftersalesRecord = useCreateAftersalesRecord();

  // Compute active vehicle from matches OR from vehicles array for freshness
  const activeVehicle = useMemo(() => {
    const selectedMatch = matches[0] as any;
    if (!selectedMatch?.vehicle_id) return null;
    
    // First try to get from matches (includes join data)
    if (selectedMatch.vehicles) return selectedMatch.vehicles;
    
    // Fallback: look up directly from vehicles array (always fresh)
    return vehicles.find(v => v.id === selectedMatch.vehicle_id) || null;
  }, [matches, vehicles]);

  useEffect(() => {
    if (id) {
      fetchApplication();
    }
  }, [id]);

  // Live-update this page when the deal changes elsewhere — e.g. tapping "✅ Contacted"
  // on the Telegram pre-approval digest flips docs_contacted on this row.
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`dealroom-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'finance_applications', filter: `id=eq.${id}` },
        (payload) => { setApplication((prev) => (prev ? ({ ...prev, ...(payload.new as any) }) : (payload.new as any))); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const fetchApplication = async () => {
    if (!id) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('finance_applications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching application:', error);
      navigate('/admin/finance');
    } else {
      setApplication(data as FinanceApplication);
      // Set approved budget from database
      if ((data as any).approved_budget) {
        setApprovedBudget(String((data as any).approved_budget));
      }
    }
    setIsLoading(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!application) return;
    
    if (newStatus === 'declined') {
      setDeclineReason('');
      setDeclineDialogOpen(true);
      return;
    }
    
    // Intercept contract_sent to open the Contract Sent modal
    if (newStatus === 'contract_sent') {
      setContractSentModalOpen(true);
      return;
    }

    // Intercept application_submitted / ready_to_submit to capture the Bank Reference
    // (or copy the Lightstone message) first — identical flow to the Finance list view.
    // Only when no reference exists yet; otherwise fall through to a plain status update.
    if (newStatus === 'application_submitted' || newStatus === 'ready_to_submit') {
      if (!(application as any)?.bank_reference) {
        setBankRefTargetStatus(newStatus);
        setBankRefModalOpen(true);
        return;
      }
    }

    // Comment gate — pop the modal instead of writing immediately.
    if (commentRequiredFor(newStatus)) {
      setCommentGate({ track: 'finance', status: newStatus });
      return;
    }

    await writeFinanceStatus(newStatus);
  };

  // The plain finance status write (extracted so the comment gate can call it).
  const writeFinanceStatus = async (newStatus: string, comment?: string) => {
    if (!application) return;
    try {
      await updateApplication.mutateAsync({ id: application.id, updates: { status: newStatus } });
      setApplication(prev => prev ? { ...prev, status: newStatus } : null);
      if (comment && comment.trim()) {
        await addPipelineNote(application, {
          body: comment.trim(),
          category: 'status_change',
          author_id: user?.id ?? null,
          author_name: (user as any)?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Unknown',
        });
      }
      // Client notification (email + WhatsApp) is handled inside updateApplication
      // (the shared hook). A second dispatch here caused duplicate client emails.
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Client-status change — isolated writer, never the finance fan-out. Gated too.
  const handleClientStatusChange = (newClientStatus: string) => {
    if (!application || newClientStatus === ((application as any).client_status || '')) return;
    if (commentRequiredFor(newClientStatus)) {
      setCommentGate({ track: 'client', status: newClientStatus });
      return;
    }
    void writeClientStatus(newClientStatus);
  };

  const writeClientStatus = async (newClientStatus: string, comment?: string) => {
    if (!application) return;
    try {
      await updateClientStatus.mutateAsync({
        id: application.id,
        client_status: newClientStatus,
        label: clientLabels[newClientStatus] || undefined,
      });
      setApplication(prev => prev ? ({ ...prev, client_status: newClientStatus } as any) : null);
      if (comment && comment.trim()) {
        await addPipelineNote(application, {
          body: comment.trim(),
          category: 'status_change',
          author_id: user?.id ?? null,
          author_name: (user as any)?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Unknown',
        });
      }
    } catch (error) {
      console.error('Failed to update client status:', error);
    }
  };

  const handleContractSentSuccess = () => {
    // Refresh after contract sent. The contract_sent email is sent by
    // ContractSentModal via the shared hook — no second dispatch here.
    fetchApplication();
    queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
  };

  const handleRequestRevision = async () => {
    if (!application) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      // 1. Update Database Status
      await updateApplication.mutateAsync({ 
        id: application.id, 
        updates: { status: 'needs_revision' } as any
      });
      
      // 2. Generate the Secure Link & Email HTML
      const revisionLink = `https://luminaauto.co.za/finance-application?edit=${application.id}`;
      const emailHtml = `
        <h2>Action Required: Application Review & Signature</h2>
        <p>Hi ${application.first_name},</p>
        <p>Our F&I team has reviewed and optimized your application structure to maximize your bank approval odds.</p>
        <p>Please click the secure link below to review the updated parameters and apply your digital signature to authorize these adjustments.</p>
        <br/>
        <a href="${revisionLink}" style="padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Review & Re-Sign Application</a>
        <br/><br/>
        <p>Best regards,<br/>The Lumina Auto F&I Team</p>
      `;
      
      // 3. Dispatch via the ONE shared client-email helper (same EmailJS
      // transport + payload; adds the comms-log entry).
      const emailOk = await sendClientEmail({
        to: application.email,
        subject: "Lumina Auto - Finance Application Revision Required",
        html: emailHtml,
        applicationId: application.id,
        clientPhone: (application as any).phone ?? null,
      });
      if (!emailOk) throw new Error("EmailJS dispatch failed");

      toast.success("Revision request sent to client via EmailJS");
      setApplication(prev => prev ? { ...prev, status: 'needs_revision' } : null);
    } catch (error: any) {
      console.error('Failed to request revision:', error);
      toast.error("Failed to send revision email. Check console.");
    }
  };

  const handleConfirmDecline = async () => {
    if (!application) return;
    
    try {
      await updateApplication.mutateAsync({ 
        id: application.id, 
        updates: { 
          status: 'declined',
          declined_reason: declineReason || null
        } 
      });
      setApplication(prev => prev ? { ...prev, status: 'declined', declined_reason: declineReason } : null);
      setDeclineDialogOpen(false);
      // Decline email + WhatsApp are sent by updateApplication (the shared hook).
      toast.success('Application declined');
    } catch (error) {
      console.error('Failed to decline application:', error);
    }
  };

  const openWhatsApp = () => {
    if (!application) return;
    const phone = application.phone?.replace(/\D/g, '') || '';
    if (!phone) {
      // Show error if no phone
      toast.error('No phone number available for this client');
      return;
    }
    const formattedPhone = phone.startsWith('0') ? `27${phone.slice(1)}` : phone;
    const name = application.first_name || application.full_name?.split(' ')[0] || 'Customer';
    const message = getWhatsAppMessage(application.status, name, matches.length, whatsappMessageFor(application.status));
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleAddVehicle = async (vehicleId: string) => {
    if (!application) return;
    
    try {
      // Find the vehicle being selected
      const selectedVehicle = vehicles.find(v => v.id === vehicleId);
      
      await addMatch.mutateAsync({ applicationId: application.id, vehicleId });
      
      // Update the finance_applications table with vehicle_id and status
      await supabase
        .from('finance_applications')
        .update({ vehicle_id: vehicleId, status: 'vehicle_selected' })
        .eq('id', application.id);
      
      // HARD-LINK LOGIC: If vehicle is hidden or available, reserve it for this application
      if (selectedVehicle && ['hidden', 'available', 'incoming'].includes(selectedVehicle.status)) {
        await supabase
          .from('vehicles')
          .update({ 
            reserved_for_application_id: application.id,
            status: selectedVehicle.status === 'hidden' ? 'hidden' : 'reserved' // Keep hidden vehicles hidden
          })
          .eq('id', vehicleId);
      }
      
      // Update local state
      setApplication(prev => prev ? { ...prev, vehicle_id: vehicleId, status: 'vehicle_selected' } : null);
      
      // CRITICAL: Force React Query to re-fetch all related data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['application-matches', application.id] }),
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-applications'] }),
      ]);
      
      // Also refetch to ensure immediate UI update
      await refetchMatches();
      await refetchVehicles();
      
      setVehicleModalOpen(false);
      setVehicleSearch('');
      
      const clientName = `${application.first_name || ''} ${application.last_name || ''}`.trim() || 'client';
      toast.success(`Vehicle linked & reserved for ${clientName}`);
    } catch (error) {
      console.error('Failed to add vehicle:', error);
      toast.error('Failed to assign vehicle');
    }
  };

  const handleRemoveVehicle = async (matchId: string) => {
    if (!application) return;
    
    try {
      // Find the vehicle to unreserve
      const matchToRemove = matches.find((m: any) => m.id === matchId) as any;
      const vehicleIdToUnreserve = matchToRemove?.vehicle_id;
      
      await removeMatch.mutateAsync({ matchId, applicationId: application.id });
      
      // Clear the reservation link from the vehicle
      if (vehicleIdToUnreserve) {
        const vehicleToUnreserve = vehicles.find(v => v.id === vehicleIdToUnreserve);
        if (vehicleToUnreserve && (vehicleToUnreserve as any).reserved_for_application_id === application.id) {
          await supabase
            .from('vehicles')
            .update({ 
              reserved_for_application_id: null,
              status: vehicleToUnreserve.status === 'hidden' ? 'hidden' : 'available'
            })
            .eq('id', vehicleIdToUnreserve);
        }
      }
      
      // Force refresh after removal
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['application-matches', application.id] }),
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
      ]);
      
      await refetchMatches();
      await refetchVehicles();
      toast.success('Vehicle removed & reservation cleared');
    } catch (error) {
      console.error('Failed to remove vehicle:', error);
    }
  };

  const handleDownloadPDF = async () => {
    if (!application) return;
    const vehicleDetails = activeVehicle 
      ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`
      : undefined;
    await generateFinancePDF(application, vehicleDetails, false, docSettings?.bankBranches);
    toast.success('PDF downloaded');
  };

  const handleDownloadUnbrandedPDF = async () => {
    if (!application) return;
    const vehicleDetails = activeVehicle 
      ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`
      : undefined;
    await generateFinancePDF(application, vehicleDetails, true, docSettings?.bankBranches);
    toast.success('Unbranded PDF downloaded');
  };

  const handleOpenFinalizeModal = async () => {
    // Get the selected vehicle from matches
    const selectedMatch = matches[0] as any;
    if (!selectedMatch?.vehicle_id) {
      toast.error('Please add a vehicle to this application before finalizing');
      return;
    }
    
    // Ensure we have fresh vehicle data before opening modal
    if (!activeVehicle) {
      await refetchVehicles();
      await refetchMatches();
    }
    
    setFinalizeDealModalOpen(true);
  };

  const handleFinalizeDealSuccess = async () => {
    if (!application) return;
    
    // Get vehicle ID from application state (may have been updated via modal)
    const finalVehicleId = application.vehicle_id || (matches[0] as any)?.vehicle_id;
    
    if (!finalVehicleId) {
      toast.error('No vehicle assigned to this deal');
      return;
    }
    
    // CRITICAL PATH (atomic): finalize the application AND move the vehicle to
    // 'sold' inventory in a single DB transaction (finalize_deal_atomic). The
    // ledger row was already created by the modal; bundling the status + the
    // inventory flip server-side means a single failing write can no longer
    // half-finalize a deal (previously a status_updated_at error aborted the
    // whole JS sequence and left the vehicle un-sold).
    try {
      const { error: rpcError } = await (supabase as any).rpc('finalize_deal_atomic', {
        p_application_id: application.id,
        p_vehicle_id: finalVehicleId,
      });
      if (rpcError) throw rpcError;

      setApplication(prev => prev ? { ...prev, status: 'finalized' } : null);
      // Keep list views / dashboards in sync (the RPC bypasses the mutation hook).
      queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-matches', application.id] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    } catch (error) {
      console.error('Error finalizing deal (critical path):', error);
      toast.error('Failed to finalize deal — application and vehicle were not updated.');
      return; // Critical path failed: do not run non-critical side-effects.
    }

    // NON-CRITICAL: create the aftersales record. A failure here must NOT roll
    // back or hide the finalized deal above — just warn so it can be added
    // manually.
    try {
      await createAftersalesRecord.mutateAsync({
        vehicleId: finalVehicleId,
        customerId: application.user_id,
        customerName: `${application.first_name || ''} ${application.last_name || ''}`.trim() || application.full_name,
        customerEmail: application.email,
        customerPhone: application.phone,
        financeApplicationId: application.id,
      });
      toast.success('Deal finalized! Aftersales record created.');
    } catch (error) {
      console.error('Aftersales record creation failed (non-critical):', error);
      toast.success('Deal finalized & vehicle marked sold.');
      toast.warning('Aftersales record could not be created automatically — please add it manually.');
    }
  };

  // Fetch ALL vehicles including hidden - admins need full access
  const selectableVehicles = vehicles.filter(v => 
    ['available', 'reserved', 'sourcing', 'incoming', 'hidden'].includes(v.status) && 
    !matches.some((m: any) => m.vehicle_id === v.id)
  );

  const filteredVehicles = vehicleSearch 
    ? selectableVehicles.filter(v => 
        `${v.make} ${v.model} ${v.variant || ''}`.toLowerCase().includes(vehicleSearch.toLowerCase())
      )
    : selectableVehicles;

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldName: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const startEditing = () => {
    if (!application) return;
    setEditedData({
      // Personal
      first_name: application.first_name,
      last_name: application.last_name,
      id_number: application.id_number,
      phone: application.phone,
      email: application.email,
      marital_status: application.marital_status,
      gender: application.gender,
      qualification: application.qualification,
      // Address
      street_address: application.street_address,
      area_code: application.area_code,
      // Employment
      employer_name: application.employer_name,
      job_title: application.job_title,
      employment_period: application.employment_period,
      // Financials
      gross_salary: application.gross_salary,
      net_salary: application.net_salary,
      additional_income: (application as any).additional_income,
      expenses_summary: application.expenses_summary,
      // Banking
      bank_name: application.bank_name,
      account_number: application.account_number,
      account_type: application.account_type,
      // Next of Kin
      kin_name: application.kin_name,
      kin_contact: application.kin_contact,
      // Cash buyer
      source_of_funds: (application as any).source_of_funds,
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedData({});
  };

  const saveEdits = async (isForceEdit: boolean = false) => {
    if (!application) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const updates = { ...editedData };
      
      if (!isForceEdit) {
        (updates as any).status = 'needs_revision';
      }

      await updateApplication.mutateAsync({ 
        id: application.id, 
        updates: updates as any
      });
      
      setApplication(prev => prev ? { ...prev, ...updates } : null);
      setIsEditing(false);
      setEditedData({});

      if (!isForceEdit) {
        const revisionLink = `https://luminaauto.co.za/finance-application?edit=${application.id}`;
        const emailHtml = `
          <h2>Action Required: Application Review & Signature</h2>
          <p>Hi ${application.first_name || application.full_name?.split(' ')[0] || 'Client'},</p>
          <p>Our F&I team has reviewed and optimized your application structure to maximize your bank approval odds.</p>
          <p>Please click the secure link below to review the updated parameters and apply your digital signature to authorize these adjustments.</p>
          <br/>
          <a href="${revisionLink}" style="padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Review & Re-Sign Application</a>
          <br/><br/>
          <p>Best regards,<br/>The Lumina Auto F&I Team</p>
        `;

        // ONE shared client-email helper — same EmailJS transport + payload,
        // plus the comms-log entry on the client's timeline.
        const emailOk = await sendClientEmail({
          to: application.email,
          subject: "Lumina Auto - Finance Application Revision Required",
          html: emailHtml,
          applicationId: application.id,
          clientPhone: (application as any).phone ?? null,
        });
        if (emailOk) toast.success('Edits saved & client notified for signature');
        else toast.error('Saved, but failed to dispatch email. Check console.');
      } else {
        toast.success('Application forcefully updated (Silent)');
      }
    } catch (error) {
      console.error('Failed to save edits:', error);
      toast.error('Failed to save changes');
    }
  };

  const handleEditChange = (field: string, value: string | number) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  type InputType = 'text' | 'number' | 'textarea' | 'select';
  
  interface SelectOption {
    value: string;
    label: string;
  }

  // Live edit context read by DetailItem. Updated every render so the (stable) component
  // always sees current values.
  const editCtxRef = useRef<any>({});
  editCtxRef.current = { isEditing, editedData, handleEditChange, copyToClipboard, copiedField };

  // DetailItem MUST keep a stable identity across renders. It was previously declared
  // inline, so each keystroke (which updates editedData → re-render) created a brand-new
  // component type, remounting the <Input> and dropping keyboard focus after every
  // character. Creating it once via useRef fixes that; it reads live state from editCtxRef.
  const DetailItem = useRef(({
    label,
    value,
    copyable = false,
    field,
    inputType = 'text',
    selectOptions = [],
    badge
  }: {
    label: string;
    value: string | number | null | undefined;
    copyable?: boolean;
    field?: string;
    inputType?: InputType;
    selectOptions?: SelectOption[];
    badge?: ReactNode;
  }) => {
    const { isEditing, editedData, handleEditChange, copyToClipboard, copiedField } = editCtxRef.current;
    return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isEditing && field ? (
        inputType === 'textarea' ? (
          <Textarea
            value={(editedData as any)[field] ?? value ?? ''}
            onChange={(e) => handleEditChange(field, e.target.value)}
            className="text-sm min-h-[80px]"
          />
        ) : inputType === 'select' ? (
          <Select
            value={(editedData as any)[field] ?? value ?? ''}
            onValueChange={(val) => handleEditChange(field, val)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={`Select ${label}`} />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : inputType === 'number' ? (
          <Input
            type="number"
            value={(editedData as any)[field] ?? value ?? ''}
            onChange={(e) => handleEditChange(field, parseFloat(e.target.value) || 0)}
            className="h-8 text-sm"
          />
        ) : (
          <Input
            value={(editedData as any)[field] ?? value ?? ''}
            onChange={(e) => handleEditChange(field, e.target.value)}
            className="h-8 text-sm"
          />
        )
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{value || 'N/A'}</p>
          {copyable && value && (
            <button
              onClick={() => copyToClipboard(String(value), label)}
              className="p-1 rounded hover:bg-muted/50 transition-colors"
              title={`Copy ${label}`}
            >
              {copiedField === label ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              )}
            </button>
          )}
          {badge}
        </div>
      )}
    </div>
    );
  }).current;

  const maritalStatusOptions: SelectOption[] = [
    { value: 'Single', label: 'Single' },
    { value: 'Married', label: 'Married' },
    { value: 'Divorced', label: 'Divorced' },
    { value: 'Widowed', label: 'Widowed' },
  ];

  const genderOptions: SelectOption[] = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
  ];

  const accountTypeOptions: SelectOption[] = [
    { value: 'Cheque', label: 'Cheque' },
    { value: 'Savings', label: 'Savings' },
  ];

  const bankOptions: SelectOption[] = [
    { value: 'ABSA', label: 'ABSA' },
    { value: 'Capitec', label: 'Capitec' },
    { value: 'FNB', label: 'FNB' },
    { value: 'Nedbank', label: 'Nedbank' },
    { value: 'Standard Bank', label: 'Standard Bank' },
    { value: 'African Bank', label: 'African Bank' },
    { value: 'Investec', label: 'Investec' },
    { value: 'TymeBank', label: 'TymeBank' },
    { value: 'Discovery Bank', label: 'Discovery Bank' },
    { value: 'Other', label: 'Other' },
  ];

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!application) {
    return (
      <AdminLayout>
        <div className="p-6 text-center">
          <p>Application not found</p>
          <Button onClick={() => navigate('/admin/finance')} className="mt-4">
            Back to Applications
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const idResult = validateSaId(application.id_number);
  const idInvalid = isSaIdInvalid(application.id_number);

  return (
    <AdminLayout>
      <Helmet>
        <title>Deal Room | {application.first_name} {application.last_name}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Button
            variant="ghost"
            onClick={() => navigate(ADMIN_ROUTES.finance)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Applications
          </Button>

          <PageHeader
            icon={<User />}
            title={`${application.first_name} ${application.last_name}`}
            subtitle={`Application ID: ${application.id.slice(0, 8)}...`}
            actions={
              isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEditing}
                    className="text-xs md:text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveEdits(false)}
                    className="text-xs md:text-sm border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    title="Save changes and email the client to re-sign"
                  >
                    <Mail className="w-4 h-4 mr-1 md:mr-2" />
                    Save &amp; Request Signature
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveEdits(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-xs md:text-sm"
                    title="Save changes without emailing the client (default)"
                  >
                    <Save className="w-4 h-4 mr-1 md:mr-2" />
                    Force Save
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRevisionConfirmOpen(true)}
                    className="h-7 px-2 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                    title="Request Revision from client"
                  >
                    <MessageCircle className="w-3.5 h-3.5 md:mr-1" />
                    <span className="hidden md:inline">Revision</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditing}
                    className="text-xs md:text-sm"
                  >
                    <Edit2 className="w-4 h-4 mr-1 md:mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPDF}
                    className="text-xs md:text-sm"
                  >
                    <Download className="w-4 h-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Download</span> PDF
                  </Button>
                  {application && <PushToSignioButton application={application} />}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadUnbrandedPDF}
                    className="text-xs md:text-sm border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <FileDown className="w-4 h-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Export</span> No Brand
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs md:text-sm"
                    onClick={async () => {
                      if (!application) return;
                      const { data: dealRec } = await supabase
                        .from('deal_records')
                        .select('id')
                        .eq('application_id', application.id)
                        .maybeSingle();
                      if (dealRec) {
                        const url = `${window.location.origin}/handover/${dealRec.id}`;
                        await navigator.clipboard.writeText(url);
                        toast.success('Handover link copied!');
                      } else {
                        toast.error('No finalized deal found for this application.');
                      }
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Copy</span> Handover Link
                  </Button>
                  {activeVehicle && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOtpModalOpen(true)}
                      className="text-xs md:text-sm border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                    >
                      <FileSignature className="w-4 h-4 mr-1 md:mr-2" />
                      <span className="hidden sm:inline">Create</span> OTP
                    </Button>
                  )}
                  {application?.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(quoteBuilderPath(application.id))}
                      className="text-xs md:text-sm"
                    >
                      <ReceiptText className="w-4 h-4 mr-1 md:mr-2" />
                      Quote
                    </Button>
                  )}
                  {/* Copy Upload Link for pre_approved */}
                  {application.status === 'pre_approved' && (application as any).access_token && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const link = `https://luminaauto.co.za/upload-documents/${(application as any).access_token}`;
                        await navigator.clipboard.writeText(link);
                        toast.success('Upload link copied to clipboard!');
                      }}
                      className="text-xs md:text-sm border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10"
                    >
                      <Copy className="w-4 h-4 mr-1 md:mr-2" />
                      Copy Upload Link
                    </Button>
                  )}
                  {/* Docs-requested tracker for pre_approved — reflects the Telegram
                      "✅ Contacted" tap and lets you toggle it here too. Freshness
                      uses the SAME shared TTL as the Finance tab / Docs Chase panel
                      (was same-calendar-day here, which disagreed with the 20h rule). */}
                  {application.status === 'pre_approved' && (() => {
                    const contactedFresh = isContactFresh(application as any);
                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const next = !contactedFresh;
                          const payload = next
                            ? { docs_contacted: true, docs_contacted_at: new Date().toISOString() }
                            : { docs_contacted: false, docs_contacted_at: null };
                          try {
                            const { error } = await supabase.from('finance_applications').update(payload as any).eq('id', application.id);
                            if (error) throw error;
                            setApplication((prev) => prev ? ({ ...prev, ...payload } as any) : null);
                            toast.success(next ? 'Marked: documents requested' : 'Cleared documents-requested');
                          } catch {
                            toast.error('Failed to update');
                          }
                        }}
                        className={contactedFresh
                          ? 'text-xs md:text-sm border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                          : 'text-xs md:text-sm border-border text-muted-foreground hover:bg-muted'}
                      >
                        {contactedFresh
                          ? <><CheckCircle2 className="w-4 h-4 mr-1" /> Docs requested</>
                          : <><Mail className="w-4 h-4 mr-1" /> Mark docs requested</>}
                      </Button>
                    );
                  })()}
                  {canShowDealActions(application.status) && (
                    <>
                      <Button
                        onClick={() => setPodiumModalOpen(true)}
                        size="sm"
                        variant="outline"
                        className="border-primary/30 text-primary hover:bg-primary/10 text-xs md:text-sm"
                      >
                        <Building2 className="w-4 h-4 mr-1 md:mr-2" />
                        Podium
                      </Button>
                      {canFinalize && (
                        <Button
                          onClick={handleOpenFinalizeModal}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs md:text-sm"
                        >
                          <PartyPopper className="w-4 h-4 mr-1 md:mr-2" />
                          Finalize
                        </Button>
                      )}
                    </>
                  )}
                  {/* Finalize button for vehicle_selected status too */}
                  {canFinalize && application.status === 'vehicle_selected' && !canShowDealActions(application.status) && (
                    <Button
                      onClick={handleOpenFinalizeModal}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs md:text-sm"
                    >
                      <PartyPopper className="w-4 h-4 mr-1 md:mr-2" />
                      Finalize Deal
                    </Button>
                  )}
                  <Button
                    onClick={openWhatsApp}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-xs md:text-sm"
                  >
                    <MessageCircle className="w-4 h-4 mr-1 md:mr-2" />
                    WhatsApp
                  </Button>
                </>
              )
            }
          />
        </motion.div>

        {/* Persistent Client Cockpit */}
        <ClientCockpit
          application={application as any}
          onChange={(patch) => setApplication((prev) => (prev ? ({ ...prev, ...patch } as any) : prev))}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Client Profile */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Personal Details */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="flex items-center gap-2 font-semibold mb-4">
                <User className="w-4 h-4 text-primary" />
                Personal Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DetailItem label="First Name" value={application.first_name} copyable field="first_name" />
                <DetailItem label="Surname" value={application.last_name} copyable field="last_name" />
                <DetailItem
                  label="ID Number"
                  value={application.id_number}
                  copyable
                  field="id_number"
                  badge={idInvalid ? (
                    <span
                      title={`Invalid SA ID — ${idResult.reason.toLowerCase()}`}
                      className="inline-flex items-center gap-1 rounded border border-destructive/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive"
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      Invalid ID
                    </span>
                  ) : null}
                />
                <DetailItem label="Gender" value={application.gender} field="gender" inputType="select" selectOptions={genderOptions} />
                <DetailItem label="Marital Status" value={application.marital_status} field="marital_status" inputType="select" selectOptions={maritalStatusOptions} />
                <DetailItem label="Qualification" value={application.qualification} field="qualification" />
                <DetailItem label="Email" value={application.email} copyable field="email" />
                <DetailItem label="Phone" value={application.phone} copyable field="phone" />
                <DetailItem
                  label="Driver's License"
                  value={
                    application.has_drivers_license === true ? 'Yes'
                    : application.has_drivers_license === false ? 'No'
                    : null
                  }
                  field="has_drivers_license"
                />
                <DetailItem
                  label="Credit Profile"
                  value={(() => {
                    const map: Record<string, string> = {
                      excellent_good: "Excellent / Good",
                      not_sure: "Not Sure",
                      defaults_arrears: "Defaults / Arrears (Missed payments)",
                      judgements: "Judgements",
                      debt_review: "Debt Review",
                      blacklisted: "Blacklisted",
                      // Legacy values
                      good: "Good (No defaults)",
                      unsure: "Not Sure",
                      bad: "Bad (Have defaults/judgments)",
                    };
                    const cs = application.credit_score_status;
                    if (!cs) return null;
                    return map[cs] || (cs.charAt(0).toUpperCase() + cs.slice(1));
                  })()}
                  field="credit_score_status"
                />
              </div>
            </div>

            {/* Address */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="flex items-center gap-2 font-semibold mb-4">
                <MapPin className="w-4 h-4 text-primary" />
                Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailItem label="Physical Address" value={application.street_address} field="street_address" inputType="textarea" />
                <DetailItem label="Area/Postal Code" value={application.area_code} field="area_code" />
              </div>
            </div>

            {/* Employment */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="flex items-center gap-2 font-semibold mb-4">
                <Building className="w-4 h-4 text-primary" />
                Employment
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <DetailItem label="Employer" value={application.employer_name} field="employer_name" />
                <DetailItem label="Job Title" value={application.job_title} field="job_title" />
                <DetailItem label="Period at Employer" value={application.employment_period} field="employment_period" />
              </div>
            </div>

            {/* Financials - Hide for cash buyers */}
            {(application as any).buyer_type !== 'cash' && (
              <div className="glass-card rounded-xl p-6">
                <h3 className="flex items-center gap-2 font-semibold mb-4">
                  <Wallet className="w-4 h-4 text-primary" />
                  Financials
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <DetailItem 
                    label="Gross Salary" 
                    value={isEditing ? application.gross_salary : (application.gross_salary ? formatPrice(application.gross_salary) : null)} 
                    field="gross_salary" 
                    inputType="number" 
                  />
                  <DetailItem 
                    label="Net Salary" 
                    value={isEditing ? application.net_salary : (application.net_salary ? formatPrice(application.net_salary) : null)} 
                    field="net_salary" 
                    inputType="number" 
                  />
                  <DetailItem 
                    label="Second/Spouse Income" 
                    value={isEditing ? (application as any).additional_income : ((application as any).additional_income ? formatPrice((application as any).additional_income) : null)} 
                    field="additional_income" 
                    inputType="number" 
                  />
                  <DetailItem label="Bank" value={application.bank_name} field="bank_name" inputType="select" selectOptions={bankOptions} />
                  <DetailItem label="Account Type" value={application.account_type} field="account_type" inputType="select" selectOptions={accountTypeOptions} />
                  <DetailItem label="Account Number" value={application.account_number} field="account_number" />
                </div>
                {/* Total Household Income Display */}
                {(application.gross_salary || (application as any).additional_income) && (
                  <div className="mt-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Household Income</p>
                    <p className="text-lg font-bold text-primary">
                      {formatPrice((application.gross_salary || 0) + ((application as any).additional_income || 0))}
                    </p>
                  </div>
                )}
                <div className="mt-4">
                  <DetailItem 
                    label="Expenses Summary" 
                    value={application.expenses_summary} 
                    field="expenses_summary" 
                    inputType="textarea" 
                  />
                </div>
              </div>
            )}

            {/* Cash Buyer Info */}
            {(application as any).buyer_type === 'cash' && (
              <div className="glass-card rounded-xl p-6">
                <h3 className="flex items-center gap-2 font-semibold mb-4">
                  <Wallet className="w-4 h-4 text-primary" />
                  Cash Buyer
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="Buyer Type" value="Cash / EFT" />
                  <DetailItem label="Source of Funds" value={(application as any).source_of_funds} field="source_of_funds" />
                </div>
              </div>
            )}

            {/* Next of Kin */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="flex items-center gap-2 font-semibold mb-4">
                <Users className="w-4 h-4 text-primary" />
                Next of Kin
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="Name" value={application.kin_name} field="kin_name" />
                <DetailItem label="Contact" value={application.kin_contact} field="kin_contact" />
              </div>
            </div>
          </motion.div>

          {/* Right Column - Deal Workflow */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Voice AI Co-Pilot + Call Timeline */}
            <ClientCallTimeline
              clientEmail={application.email}
              clientPhone={application.phone}
              clientName={application.first_name || application.full_name || 'Client'}
              applicationId={application.id}
            />

            {/* Deal Expenses (admin only — deal_expenses is admin-RLS). Costs incurred
                FOR this deal, separate from the car's own reconditioning expenses. */}
            {isSuperAdmin && (
              <div className="glass-card rounded-xl p-6">
                <DealExpensesSection applicationId={application.id} title="Deal Expenses" />
                <p className="text-[11px] text-muted-foreground mt-3">
                  Costs on this deal (e.g. fuel to fetch the car, transport). These roll into the deal's profit when you finalize, alongside the car's own reconditioning expenses.
                </p>
              </div>
            )}

            {/* Status Controller */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="font-semibold mb-4">Status Controller</h3>
              
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                {(application as any).bank_reference && (
                  <BankReferenceBadge
                    reference={(application as any).bank_reference}
                    onEdit={() => setEditBankRefOpen(true)}
                  />
                )}
                <StatusBadge
                  track="finance"
                  value={application.status}
                  labelOverrides={financeLabels}
                  styleOverrides={financeStyles}
                  className="px-3 py-1.5 text-sm uppercase tracking-wider"
                />
                {financeStatusToDealStage(application.status) && (
                  <StatusBadge
                    track="deal"
                    value={financeStatusToDealStage(application.status)!}
                    className="px-3 py-1.5 text-sm uppercase tracking-wider"
                  />
                )}
                {/* Customizable client-facing status — independent of finance. */}
                {(application as any).client_status && (
                  <StatusBadge
                    track="client"
                    value={(application as any).client_status}
                    labelOverrides={clientLabels}
                    styleOverrides={clientStyles}
                    className="px-3 py-1.5 text-sm uppercase tracking-wider"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Change Status</Label>
                  <Select
                    value={application.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filterStatusOptionsForRole(STATUS_OPTIONS, role, application.status).map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Credit Check</Label>
                  <Select
                    value={((application as any).credit_check_status || 'pending') as string}
                    onValueChange={async (v) => {
                      if (v === 'pending') {
                        try {
                          await updateApplication.mutateAsync({
                            id: application.id,
                            updates: { credit_check_status: 'pending' } as any,
                          });
                          setApplication(prev => prev ? ({ ...prev, credit_check_status: 'pending' } as any) : null);
                        } catch (e) { /* hook toasts */ }
                        return;
                      }
                      setCreditCheckOutcome(v as CreditCheckOutcome);
                      setCreditCheckModalOpen(true);
                    }}
                  >
                    <SelectTrigger
                      className={
                        (application as any).credit_check_status === 'passed'
                          ? 'border-emerald-500/40 text-emerald-300'
                          : (application as any).credit_check_status === 'failed'
                            ? 'border-red-500/40 text-red-300'
                            : ''
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="passed">Passed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Change Client Status — customizable track, isolated writer. */}
              {clientStatuses.length > 0 && (
                <div className="mt-3">
                  <Label className="text-sm text-muted-foreground mb-2 block">Change Client Status</Label>
                  <StatusSelect
                    track="client"
                    value={(application as any).client_status || ''}
                    onChange={handleClientStatusChange}
                    options={clientStatuses}
                    labelOverrides={clientLabels}
                  />
                </div>
              )}

              {application.status === 'declined' && application.declined_reason && (
                <Alert variant="destructive" className="mt-4 bg-red-500/10 border-red-500/30">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Decline Reason</AlertTitle>
                  <AlertDescription>{application.declined_reason}</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Document Vault - Show when validations_pending */}
            {application.status === 'validations_pending' && (
              <div className="glass-card rounded-xl p-6">
                <h3 className="flex items-center gap-2 font-semibold mb-4">
                  <FileText className="w-4 h-4 text-primary" />
                  Document Checklist
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Documents required from client:
                </p>
                <ul className="space-y-2">
                  {['3 Months Bank Statements', 'Copy of ID', 'Valid Drivers License', '3 Months Payslips'].map((doc) => (
                    <li key={doc} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-4 h-4 rounded border border-border" />
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Vehicle Selection - Direct Assignment */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Car className="w-4 h-4 text-primary" />
                  Selected Vehicle
                </h3>
              </div>
              
              {/* Current Selected Vehicle */}
              <div className="mb-4">
                <Label className="text-sm text-muted-foreground mb-2 block">Assigned Vehicle</Label>
                {matches.length > 0 && (matches[0] as any).vehicles ? (
                  <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-3">
                    {(matches[0] as any).vehicles?.images?.[0] && (
                      <img 
                        src={(matches[0] as any).vehicles.images[0]} 
                        alt="" 
                        className="w-12 h-12 rounded object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {(matches[0] as any).vehicles?.year} {(matches[0] as any).vehicles?.make} {(matches[0] as any).vehicles?.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice((matches[0] as any).vehicles?.price)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No vehicle assigned</p>
                )}
              </div>

              {/* Assign/Change Vehicle Button */}
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setVehicleModalOpen(true)}
              >
                <Car className="w-4 h-4 mr-2" />
                {matches.length > 0 ? 'Change Vehicle' : 'Assign Vehicle'}
              </Button>
            </div>

            {/* Vehicle Matchmaking - Always visible */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Car className="w-4 h-4 text-primary" />
                  Matchmaking Engine
                </h3>
              </div>

              {/* Max Monthly Installment Input */}
              <div className="mb-4">
                <Label className="text-sm text-muted-foreground mb-2 block">Max Monthly Installment (R/pm)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="e.g., 5000"
                    value={approvedBudget}
                    onChange={(e) => setApprovedBudget(e.target.value)}
                    className="text-lg font-semibold"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!approvedBudget) return;
                      await updateApplication.mutateAsync({ 
                        id: application.id, 
                        updates: { approved_budget: parseFloat(approvedBudget) } as any
                      });
                      toast.success('Monthly budget saved');
                    }}
                  >
                    Save
                  </Button>
                </div>
                {approvedBudget && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ R{Math.round((parseFloat(approvedBudget) * (1 - Math.pow(1 + (0.1375 / 12), -72))) / (0.1375 / 12)).toLocaleString()} buying power
                  </p>
                )}
              </div>

              <Separator className="my-4" />

              {/* Curated Vehicles Header */}
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium">Curated Vehicles</h4>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      // Finance calculation constants
                      const RATE = 0.1375; // 13.75% Interest
                      const MONTHS = 72;   // Standard Term
                      const MONTHLY_RATE = RATE / 12;
                      
                      // Get monthly budget - fallback to 30% of net salary if not set
                      const monthlyBudget = approvedBudget 
                        ? parseFloat(approvedBudget) 
                        : (application.net_salary ? application.net_salary * 0.3 : 5000);
                      
                      // Formula: PV = PMT * (1 - (1 + r)^-n) / r
                      const maxPrice = (monthlyBudget * (1 - Math.pow(1 + MONTHLY_RATE, -MONTHS))) / MONTHLY_RATE;
                      
                      console.log(`User Budget: R${monthlyBudget}/pm -> Buying Power: R${Math.round(maxPrice)}`);
                      
                      // Filter and sort by price descending (best value first)
                      const matchedVehicles = vehicles
                        .filter(v => v.status === 'available' && v.price <= maxPrice && !matches.some((m: any) => m.vehicle_id === v.id))
                        .sort((a, b) => b.price - a.price)
                        .slice(0, 3);
                      
                      if (matchedVehicles.length === 0) {
                        toast.error(`No vehicles found under R${monthlyBudget.toLocaleString()}/pm`);
                        return;
                      }
                      
                      matchedVehicles.forEach(v => {
                        addMatch.mutateAsync({ applicationId: application.id, vehicleId: v.id });
                      });
                      toast.success(`Found ${matchedVehicles.length} vehicles under R${monthlyBudget.toLocaleString()}/pm (≈ R${Math.round(maxPrice).toLocaleString()} cash)`);
                    }}
                    className="text-primary border-primary/30 hover:bg-primary/10"
                  >
                    <Zap className="w-4 h-4 mr-1" /> Auto-Match
                  </Button>
                  <Button size="sm" onClick={() => setVehicleModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              {matchesLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No vehicles matched yet. Add vehicles to show the client their curated options.
                </p>
              ) : (
                <div className="space-y-3">
                  {matches.map((match: any) => (
                    <Card key={match.id} className="bg-muted/30">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {match.vehicles?.images?.[0] && (
                            <img 
                              src={match.vehicles.images[0]} 
                              alt="" 
                              className="w-12 h-12 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium text-sm">
                              {match.vehicles?.year} {match.vehicles?.make} {match.vehicles?.model}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(match.vehicles?.price)}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => handleRemoveVehicle(match.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Client Documents */}
            <ClientDocumentViewer
              applicationId={application.id}
              accessToken={(application as any).access_token}
              clientName={application.first_name || application.full_name}
            />

            {/* Documents Hub — uploads here also appear in the client profile and Documents Hub */}
            <div className="glass-card rounded-xl p-6 space-y-5">
              <DocumentManager
                title="Documents"
                description="Upload client, vehicle and deal documents. Stored centrally in the Documents Hub."
                category="client"
                clientId={application.user_id || undefined}
                applicationId={application.id}
              />
              <DocumentManager
                title="Vehicle documents"
                category="vehicle"
                clientId={application.user_id || undefined}
                applicationId={application.id}
                vehicleId={(application as any).selected_vehicle_id || application.vehicle_id || undefined}
              />
              <DocumentManager
                title="Deal & contracts"
                category="deal"
                clientId={application.user_id || undefined}
                applicationId={application.id}
              />
            </div>

            {/* Quick Contact */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="font-semibold mb-4">Quick Contact</h3>
              <div className="space-y-2">
                <a 
                  href={`tel:${application.phone}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {application.phone}
                </a>
                <a 
                  href={`mailto:${application.email}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {application.email}
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Decline Application
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for declining this application. This will be recorded and shown to the user.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="declineReason">Reason for Decline</Label>
            <Textarea
              id="declineReason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g., Insufficient income, poor credit history..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDecline}>
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Revision — warning confirmation before emailing the client */}
      <Dialog open={revisionConfirmOpen} onOpenChange={setRevisionConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Request Revision?
            </DialogTitle>
            <DialogDescription>
              This emails {application.first_name} a secure re-sign link and sets the application
              status to <strong>Needs Revision</strong>. Only do this when you actually need the
              client to review and re-sign. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={async () => { setRevisionConfirmOpen(false); await handleRequestRevision(); }}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Yes, Request Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Selection Modal */}
      <Dialog open={vehicleModalOpen} onOpenChange={setVehicleModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Vehicle to Client Options</DialogTitle>
            <DialogDescription>
              Select a vehicle to add to {application.first_name}'s curated options
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search vehicles..."
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filteredVehicles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No available vehicles found
              </p>
            ) : (
              filteredVehicles.slice(0, 20).map((vehicle) => (
                <Card 
                  key={vehicle.id} 
                  className="bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleAddVehicle(vehicle.id)}
                >
                  <CardContent className="p-3 flex items-center gap-4">
                    {vehicle.images?.[0] && (
                      <img 
                        src={vehicle.images[0]} 
                        alt="" 
                        className="w-16 h-12 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">
                        {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.variant}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(vehicle.price)} • {vehicle.mileage?.toLocaleString()} km
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Finance Podium Modal */}
      <FinancePodiumModal
        open={podiumModalOpen}
        onOpenChange={setPodiumModalOpen}
        applicationId={application.id}
        approvedBudget={(application as any).approved_budget}
      />

      {/* Finalize Deal Modal - Uses activeVehicle for fresh data */}
      <FinalizeDealModal
        isOpen={finalizeDealModalOpen}
        onClose={() => setFinalizeDealModalOpen(false)}
        applicationId={application.id}
        vehicleId={(matches[0] as any)?.vehicle_id || ''}
        vehiclePrice={activeVehicle?.price || 0}
        vehicleMileage={activeVehicle?.mileage || 0}
        vehicleStatus={activeVehicle?.status}
        vehicle={activeVehicle}
        onSuccess={handleFinalizeDealSuccess}
        onVehicleChange={async (newVehicleId) => {
          // Update the application's vehicle_id when changed in the modal
          await supabase
            .from('finance_applications')
            .update({ vehicle_id: newVehicleId })
            .eq('id', application.id);
          
          // Refresh data
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['application-matches', application.id] }),
            queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
            queryClient.invalidateQueries({ queryKey: ['finance-applications'] }),
          ]);
          await refetchMatches();
          await refetchVehicles();
        }}
      />

      {/* OTP Modal */}
      <OTPModal
        open={otpModalOpen}
        onOpenChange={setOtpModalOpen}
        applicationData={{
          clientName: `${application.first_name || ''} ${application.last_name || ''}`.trim() || application.full_name,
          idNumber: application.id_number || '',
          address: application.street_address || '',
          email: application.email,
          phone: application.phone,
        }}
        vehicleData={activeVehicle ? {
          make: activeVehicle.make,
          model: activeVehicle.model,
          variant: activeVehicle.variant || undefined,
          year: activeVehicle.year,
          vin: activeVehicle.vin || undefined,
          engineCode: activeVehicle.engine_code || undefined,
          mileage: activeVehicle.mileage,
          color: activeVehicle.color || undefined,
          price: activeVehicle.price,
          stockNumber: activeVehicle.stock_number || undefined,
        } : undefined}
        dealId={application.id}
      />

      {/* Contract Sent Modal */}
      <ContractSentModal
        isOpen={contractSentModalOpen}
        onClose={() => setContractSentModalOpen(false)}
        applicationId={application.id}
        clientName={`${application.first_name || ''} ${application.last_name || ''}`.trim() || application.full_name}
        onSuccess={handleContractSentSuccess}
      />

      {/* Comment gate for status changes (finance or client). Confirm runs the
          matching isolated writer + a status_change note. */}
      {commentGate && (
        <CommentGateModal
          open
          required={commentRequiredFor(commentGate.status)}
          prompt={commentPromptFor(commentGate.status)}
          onCancel={() => setCommentGate(null)}
          onConfirm={(comment) => {
            const { track, status } = commentGate;
            setCommentGate(null);
            if (track === 'finance') void writeFinanceStatus(status, comment);
            else void writeClientStatus(status, comment);
          }}
        />
      )}

      {/* Bank Reference capture for Ready to Submit / Application Submitted */}
      <BankReferenceModal
        open={bankRefModalOpen}
        onOpenChange={setBankRefModalOpen}
        defaultValue={(application as any)?.bank_reference || ''}
        showFAndIAssignment
        defaultFAndIId={(application as any)?.assigned_f_and_i || null}
        clientName={`${(application as any)?.first_name || ''} ${(application as any)?.last_name || ''}`.trim() || (application as any)?.full_name || ''}
        docsReceived={!!((application as any)?.docs_email || (application as any)?.docs_whatsapp)}
        onConfirm={async (reference, fniId) => {
          if (!application) return;
          try {
            const updates: any = { status: bankRefTargetStatus, bank_reference: reference };
            if (fniId !== undefined) {
              updates.assigned_f_and_i = fniId;
              updates.assigned_f_and_i_at = fniId ? new Date().toISOString() : null;
            }
            await updateApplication.mutateAsync({ id: application.id, updates });
            setApplication(prev => prev ? ({ ...prev, ...updates } as any) : null);
            // Submission email + WhatsApp are sent by updateApplication (the hook).
            toast.success(bankRefTargetStatus === 'ready_to_submit' ? 'Marked ready to submit' : 'Application submitted to bank');
          } catch (err) {
            console.error('Bank ref submission failed:', err);
          }
        }}
      />

      {/* Standalone Bank Reference Editor */}
      <BankReferenceModal
        open={editBankRefOpen}
        onOpenChange={setEditBankRefOpen}
        defaultValue={(application as any)?.bank_reference || ''}
        showFAndIAssignment
        defaultFAndIId={(application as any)?.assigned_f_and_i || null}
        clientName={`${(application as any)?.first_name || ''} ${(application as any)?.last_name || ''}`.trim() || (application as any)?.full_name || ''}
        docsReceived={!!((application as any)?.docs_email || (application as any)?.docs_whatsapp)}
        onConfirm={async (reference, fniId) => {
          if (!application) return;
          try {
            const updates: any = { bank_reference: reference };
            if (fniId !== undefined) {
              updates.assigned_f_and_i = fniId;
              updates.assigned_f_and_i_at = fniId ? new Date().toISOString() : null;
            }
            await updateApplication.mutateAsync({
              id: application.id,
              updates,
            });
            setApplication(prev => prev ? ({ ...prev, ...updates } as any) : null);
            toast.success('Bank reference updated');
          } catch (err) {
            console.error('Bank ref update failed:', err);
            toast.error('Failed to update bank reference');
          }
        }}
      />

      {/* Credit Check Pass/Fail Modal */}
      <CreditCheckResultModal
        open={creditCheckModalOpen}
        onOpenChange={setCreditCheckModalOpen}
        outcome={creditCheckOutcome}
        applicationId={application.id}
        onSaved={(u) => {
          setApplication(prev => prev ? ({ ...prev, ...u } as any) : null);
          queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
        }}
      />
    </AdminLayout>
  );
};

export default AdminDealRoom;
