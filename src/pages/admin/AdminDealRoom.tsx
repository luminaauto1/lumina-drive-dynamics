import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { 
  ArrowLeft, User, MapPin, Building, Wallet, Users, Phone, Mail, 
  MessageCircle, Car, Plus, X, Search, FileText, CheckCircle, AlertTriangle, Copy, Check,
  Download, PartyPopper, Edit2, Save
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
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
import { useUpdateFinanceApplication, FinanceApplication } from '@/hooks/useFinanceApplications';
import { useApplicationMatches, useAddApplicationMatch, useRemoveApplicationMatch } from '@/hooks/useApplicationMatches';
import { useCreateAftersalesRecord } from '@/hooks/useAftersales';
import { STATUS_OPTIONS, STATUS_STYLES, ADMIN_STATUS_LABELS, getWhatsAppMessage } from '@/lib/statusConfig';
import { generateFinancePDF } from '@/lib/generateFinancePDF';
import { toast } from 'sonner';

const AdminDealRoom = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [application, setApplication] = useState<FinanceApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [approvedBudget, setApprovedBudget] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<FinanceApplication>>({});

  const { data: vehicles = [] } = useVehicles();
  const { data: matches = [], isLoading: matchesLoading } = useApplicationMatches(id || '');
  const updateApplication = useUpdateFinanceApplication();
  const addMatch = useAddApplicationMatch();
  const removeMatch = useRemoveApplicationMatch();
  const createAftersalesRecord = useCreateAftersalesRecord();

  useEffect(() => {
    if (id) {
      fetchApplication();
    }
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
    
    try {
      await updateApplication.mutateAsync({ id: application.id, updates: { status: newStatus } });
      setApplication(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (error) {
      console.error('Failed to update status:', error);
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
    } catch (error) {
      console.error('Failed to decline application:', error);
    }
  };

  const openWhatsApp = () => {
    if (!application) return;
    const phone = application.phone?.replace(/\D/g, '') || '';
    if (!phone) {
      // Show error if no phone
      alert('No phone number available for this client');
      return;
    }
    const formattedPhone = phone.startsWith('0') ? `27${phone.slice(1)}` : phone;
    const name = application.first_name || application.full_name?.split(' ')[0] || 'Customer';
    const message = getWhatsAppMessage(application.status, name, matches.length);
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleAddVehicle = async (vehicleId: string) => {
    if (!application) return;
    await addMatch.mutateAsync({ applicationId: application.id, vehicleId });
    setVehicleModalOpen(false);
    setVehicleSearch('');
  };

  const handleRemoveVehicle = async (matchId: string) => {
    if (!application) return;
    await removeMatch.mutateAsync({ matchId, applicationId: application.id });
  };

  const handleDownloadPDF = () => {
    if (!application) return;
    const selectedVehicle = matches.find((m: any) => m.vehicles)?.vehicles;
    const vehicleDetails = selectedVehicle 
      ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
      : undefined;
    generateFinancePDF(application, vehicleDetails);
    toast.success('PDF downloaded');
  };

  const handleFinalizeDeal = async () => {
    if (!application) return;
    
    // Get the selected vehicle from matches
    const selectedMatch = matches[0] as any;
    if (!selectedMatch?.vehicle_id) {
      toast.error('Please add a vehicle to this application before finalizing');
      return;
    }

    try {
      // Update status to finalized
      await updateApplication.mutateAsync({ 
        id: application.id, 
        updates: { status: 'finalized' } 
      });

      // Create aftersales record
      await createAftersalesRecord.mutateAsync({
        vehicleId: selectedMatch.vehicle_id,
        customerId: application.user_id,
        customerName: `${application.first_name || ''} ${application.last_name || ''}`.trim() || application.full_name,
        customerEmail: application.email,
        customerPhone: application.phone,
        financeApplicationId: application.id,
      });

      // Update vehicle status to sold
      await supabase
        .from('vehicles')
        .update({ status: 'sold' })
        .eq('id', selectedMatch.vehicle_id);

      setApplication(prev => prev ? { ...prev, status: 'finalized' } : null);
      toast.success('Deal finalized! Aftersales record created.');
    } catch (error) {
      console.error('Error finalizing deal:', error);
      toast.error('Failed to finalize deal');
    }
  };

  const availableVehicles = vehicles.filter(v => 
    v.status === 'available' && 
    !matches.some((m: any) => m.vehicle_id === v.id)
  );

  const filteredVehicles = vehicleSearch 
    ? availableVehicles.filter(v => 
        `${v.make} ${v.model} ${v.variant || ''}`.toLowerCase().includes(vehicleSearch.toLowerCase())
      )
    : availableVehicles;

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

  const saveEdits = async () => {
    if (!application) return;
    try {
      await updateApplication.mutateAsync({ 
        id: application.id, 
        updates: editedData as any
      });
      setApplication(prev => prev ? { ...prev, ...editedData } : null);
      setIsEditing(false);
      setEditedData({});
      toast.success('Application updated');
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

  const DetailItem = ({ 
    label, 
    value, 
    copyable = false, 
    field,
    inputType = 'text',
    selectOptions = []
  }: { 
    label: string; 
    value: string | number | null | undefined; 
    copyable?: boolean; 
    field?: string;
    inputType?: InputType;
    selectOptions?: SelectOption[];
  }) => (
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
        </div>
      )}
    </div>
  );

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
            onClick={() => navigate('/admin/finance')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Applications
          </Button>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold">
                {application.first_name} {application.last_name}
              </h1>
              <p className="text-muted-foreground text-sm">
                Application ID: {application.id.slice(0, 8)}...
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isEditing ? (
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
                    size="sm"
                    onClick={saveEdits}
                    className="bg-primary hover:bg-primary/90 text-xs md:text-sm"
                  >
                    <Save className="w-4 h-4 mr-1 md:mr-2" />
                    Save
                  </Button>
                </>
              ) : (
                <>
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
                  {application.status === 'approved' && (
                    <Button
                      onClick={handleFinalizeDeal}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs md:text-sm"
                    >
                      <PartyPopper className="w-4 h-4 mr-1 md:mr-2" />
                      Finalize
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
              )}
            </div>
          </div>
        </motion.div>

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
                <DetailItem label="ID Number" value={application.id_number} copyable field="id_number" />
                <DetailItem label="Gender" value={application.gender} field="gender" inputType="select" selectOptions={genderOptions} />
                <DetailItem label="Marital Status" value={application.marital_status} field="marital_status" inputType="select" selectOptions={maritalStatusOptions} />
                <DetailItem label="Qualification" value={application.qualification} field="qualification" />
                <DetailItem label="Email" value={application.email} copyable field="email" />
                <DetailItem label="Phone" value={application.phone} copyable field="phone" />
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
                  <DetailItem label="Bank" value={application.bank_name} field="bank_name" inputType="select" selectOptions={bankOptions} />
                  <DetailItem label="Account Type" value={application.account_type} field="account_type" inputType="select" selectOptions={accountTypeOptions} />
                  <DetailItem label="Account Number" value={application.account_number} field="account_number" />
                </div>
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
            {/* Status Controller */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="font-semibold mb-4">Status Controller</h3>
              
              <div className="mb-4">
                <span className={`px-3 py-1.5 text-sm uppercase tracking-wider rounded border ${STATUS_STYLES[application.status] || STATUS_STYLES.pending}`}>
                  {ADMIN_STATUS_LABELS[application.status] || application.status}
                </span>
              </div>

              <Label className="text-sm text-muted-foreground mb-2 block">Change Status</Label>
              <Select 
                value={application.status} 
                onValueChange={handleStatusChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                    ⚡ Auto-Match
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
    </AdminLayout>
  );
};

export default AdminDealRoom;
