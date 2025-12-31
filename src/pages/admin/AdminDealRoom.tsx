import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { 
  ArrowLeft, User, MapPin, Building, Wallet, Users, Phone, Mail, 
  MessageCircle, Car, Plus, X, Search, FileText, CheckCircle, AlertTriangle, Copy, Check
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
import { STATUS_OPTIONS, STATUS_STYLES, ADMIN_STATUS_LABELS, getWhatsAppMessage } from '@/lib/statusConfig';
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

  const { data: vehicles = [] } = useVehicles();
  const { data: matches = [], isLoading: matchesLoading } = useApplicationMatches(id || '');
  const updateApplication = useUpdateFinanceApplication();
  const addMatch = useAddApplicationMatch();
  const removeMatch = useRemoveApplicationMatch();

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

  const DetailItem = ({ label, value, copyable = false }: { label: string; value: string | number | null | undefined; copyable?: boolean }) => (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
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
    </div>
  );

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
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold">
                {application.first_name} {application.last_name}
              </h1>
              <p className="text-muted-foreground">
                Application ID: {application.id.slice(0, 8)}...
              </p>
            </div>
            <Button
              onClick={openWhatsApp}
              className="bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Send WhatsApp Update
            </Button>
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
                <DetailItem label="First Name" value={application.first_name} copyable />
                <DetailItem label="Surname" value={application.last_name} copyable />
                <DetailItem label="ID Number" value={application.id_number} copyable />
                <DetailItem label="Gender" value={application.gender} />
                <DetailItem label="Marital Status" value={application.marital_status} />
                <DetailItem label="Qualification" value={application.qualification} />
                <DetailItem label="Email" value={application.email} copyable />
                <DetailItem label="Phone" value={application.phone} copyable />
              </div>
            </div>

            {/* Address */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="flex items-center gap-2 font-semibold mb-4">
                <MapPin className="w-4 h-4 text-primary" />
                Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailItem label="Physical Address" value={application.street_address} />
                <DetailItem label="Area/Postal Code" value={application.area_code} />
              </div>
            </div>

            {/* Employment */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="flex items-center gap-2 font-semibold mb-4">
                <Building className="w-4 h-4 text-primary" />
                Employment
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <DetailItem label="Employer" value={application.employer_name} />
                <DetailItem label="Job Title" value={application.job_title} />
                <DetailItem label="Period at Employer" value={application.employment_period} />
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
                  <DetailItem label="Gross Salary" value={application.gross_salary ? formatPrice(application.gross_salary) : null} />
                  <DetailItem label="Net Salary" value={application.net_salary ? formatPrice(application.net_salary) : null} />
                  <DetailItem label="Bank" value={application.bank_name} />
                  <DetailItem label="Account Type" value={application.account_type} />
                  <DetailItem label="Account Number" value={application.account_number} />
                </div>
                {application.expenses_summary && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-1">Expenses Summary</p>
                    <p className="text-sm bg-muted/50 p-3 rounded">{application.expenses_summary}</p>
                  </div>
                )}
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
                  <DetailItem label="Source of Funds" value={(application as any).source_of_funds} />
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
                <DetailItem label="Name" value={application.kin_name} />
                <DetailItem label="Contact" value={application.kin_contact} />
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

              {/* Approved Budget Input */}
              <div className="mb-4">
                <Label className="text-sm text-muted-foreground mb-2 block">Max Approved Budget (R)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="e.g., 250000"
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
                      toast.success('Budget saved');
                    }}
                  >
                    Save
                  </Button>
                </div>
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
                      // Auto-match: Add top 3 available vehicles within budget
                      const budget = approvedBudget ? parseFloat(approvedBudget) : (application.net_salary ? application.net_salary * 0.3 * 72 : 500000);
                      const matchedVehicles = vehicles
                        .filter(v => v.status === 'available' && v.price <= budget && !matches.some((m: any) => m.vehicle_id === v.id))
                        .slice(0, 3);
                      
                      if (matchedVehicles.length === 0) {
                        toast.error('No vehicles found within budget');
                        return;
                      }
                      
                      matchedVehicles.forEach(v => {
                        addMatch.mutateAsync({ applicationId: application.id, vehicleId: v.id });
                      });
                      toast.success(`Auto-matched ${matchedVehicles.length} vehicles`);
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
