import { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Search, Phone, Mail, FileText, MessageCircle, User, MapPin, Wallet, Users, Building } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useFinanceApplications, useUpdateFinanceApplication, FinanceApplication } from '@/hooks/useFinanceApplications';
import { formatPrice } from '@/hooks/useVehicles';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'pre-approved', label: 'Pre-Approved' },
  { value: 'validations_needed', label: 'Validations Needed' },
  { value: 'declined', label: 'Declined' },
];

const AdminFinance = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedApplication, setSelectedApplication] = useState<FinanceApplication | null>(null);

  const { data: applications = [], isLoading } = useFinanceApplications();
  const updateApplication = useUpdateFinanceApplication();

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

    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (appId: string, newStatus: string) => {
    await updateApplication.mutateAsync({ id: appId, updates: { status: newStatus } });
    if (selectedApplication?.id === appId) {
      setSelectedApplication(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'pre-approved': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      declined: 'bg-red-500/20 text-red-400 border-red-500/30',
      validations_needed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };

    const labels: Record<string, string> = {
      pending: 'Pending',
      'pre-approved': 'Pre-Approved',
      declined: 'Declined',
      validations_needed: 'Validations Needed',
    };

    return (
      <span className={`px-2 py-1 text-xs uppercase tracking-wider rounded border ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getWhatsAppMessage = (app: FinanceApplication): string => {
    const name = app.first_name || app.full_name?.split(' ')[0] || 'Customer';
    
    switch (app.status) {
      case 'pending':
        return `Hi ${name}, we have received your finance application and are currently reviewing it. We will be in touch shortly.`;
      case 'validations_needed':
        return `Hi ${name}, great news! You are pre-approved for vehicle finance. Please send us the following documents to proceed:\n\n• 3 months bank statements\n• Copy of ID\n• Valid Driver's License\n• 3 months payslips\n\nReply to this message with your documents.`;
      case 'pre-approved':
        return `Hi ${name}, congratulations! Your finance application has been pre-approved. Please contact us to discuss the next steps and finalize your vehicle purchase.`;
      case 'declined':
        return `Hi ${name}, unfortunately we were unable to approve your finance application at this time. Please feel free to contact us to discuss alternative options.`;
      default:
        return `Hi ${name}, regarding your finance application...`;
    }
  };

  const openWhatsApp = (app: FinanceApplication) => {
    const phone = app.phone?.replace(/\D/g, '') || '';
    const formattedPhone = phone.startsWith('0') ? `27${phone.slice(1)}` : phone;
    const message = getWhatsAppMessage(app);
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const DetailItem = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || 'N/A'}</p>
    </div>
  );

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
          className="mb-6"
        >
          <h1 className="text-3xl font-semibold mb-2">Finance Applications</h1>
          <p className="text-muted-foreground">Manage and process finance applications</p>
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
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"
        >
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-amber-400">{applications.filter(a => a.status === 'pending').length}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-blue-400">{applications.filter(a => a.status === 'validations_needed').length}</p>
            <p className="text-sm text-muted-foreground">Validations</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-emerald-400">{applications.filter(a => a.status === 'pre-approved').length}</p>
            <p className="text-sm text-muted-foreground">Pre-Approved</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-red-400">{applications.filter(a => a.status === 'declined').length}</p>
            <p className="text-sm text-muted-foreground">Declined</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold">{applications.length}</p>
            <p className="text-sm text-muted-foreground">Total</p>
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
              {searchQuery || statusFilter !== 'all' ? 'No applications match your filters' : 'No finance applications yet'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">ID Number</TableHead>
                  <TableHead className="text-muted-foreground">Net Salary</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app) => (
                  <TableRow 
                    key={app.id} 
                    className="border-white/10 hover:bg-white/5 cursor-pointer"
                    onClick={() => setSelectedApplication(app)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{app.first_name} {app.last_name}</p>
                        <p className="text-xs text-muted-foreground">{app.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.id_number || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.net_salary ? formatPrice(app.net_salary) : 'N/A'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select 
                        value={app.status} 
                        onValueChange={(value) => handleStatusChange(app.id, value)}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
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
                          onClick={() => setSelectedApplication(app)}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </motion.div>
      </div>

      {/* Application Details Sheet */}
      <Sheet open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Application Details
            </SheetTitle>
          </SheetHeader>
          
          {selectedApplication && (
            <div className="mt-6 space-y-6">
              {/* Status & Actions */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Current Status</p>
                  {getStatusBadge(selectedApplication.status)}
                </div>
                <Button
                  onClick={() => openWhatsApp(selectedApplication)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Send Update
                </Button>
              </div>

              {/* Update Status */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Change Status</p>
                <Select 
                  value={selectedApplication.status} 
                  onValueChange={(value) => handleStatusChange(selectedApplication.id, value)}
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
              </div>

              <Separator />

              {/* Personal Details */}
              <div>
                <h3 className="flex items-center gap-2 font-semibold mb-3">
                  <User className="w-4 h-4" />
                  Personal Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="First Name" value={selectedApplication.first_name} />
                  <DetailItem label="Surname" value={selectedApplication.last_name} />
                  <DetailItem label="ID Number" value={selectedApplication.id_number} />
                  <DetailItem label="Gender" value={selectedApplication.gender} />
                  <DetailItem label="Marital Status" value={selectedApplication.marital_status} />
                  <DetailItem label="Qualification" value={selectedApplication.qualification} />
                  <DetailItem label="Email" value={selectedApplication.email} />
                  <DetailItem label="Phone" value={selectedApplication.phone} />
                </div>
              </div>

              <Separator />

              {/* Address */}
              <div>
                <h3 className="flex items-center gap-2 font-semibold mb-3">
                  <MapPin className="w-4 h-4" />
                  Address
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <DetailItem label="Physical Address" value={selectedApplication.street_address} />
                  </div>
                  <DetailItem label="Area/Postal Code" value={selectedApplication.area_code} />
                </div>
              </div>

              <Separator />

              {/* Employment */}
              <div>
                <h3 className="flex items-center gap-2 font-semibold mb-3">
                  <Building className="w-4 h-4" />
                  Employment
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="Employer" value={selectedApplication.employer_name} />
                  <DetailItem label="Job Title" value={selectedApplication.job_title} />
                  <DetailItem label="Period at Employer" value={selectedApplication.employment_period} />
                </div>
              </div>

              <Separator />

              {/* Next of Kin */}
              <div>
                <h3 className="flex items-center gap-2 font-semibold mb-3">
                  <Users className="w-4 h-4" />
                  Next of Kin
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="Name" value={selectedApplication.kin_name} />
                  <DetailItem label="Contact" value={selectedApplication.kin_contact} />
                </div>
              </div>

              <Separator />

              {/* Financials */}
              <div>
                <h3 className="flex items-center gap-2 font-semibold mb-3">
                  <Wallet className="w-4 h-4" />
                  Financial Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="Bank" value={selectedApplication.bank_name?.toUpperCase()} />
                  <DetailItem label="Account Type" value={selectedApplication.account_type} />
                  <DetailItem label="Account Number" value={selectedApplication.account_number} />
                  <DetailItem label="Gross Salary" value={selectedApplication.gross_salary ? formatPrice(selectedApplication.gross_salary) : null} />
                  <DetailItem label="Net Salary" value={selectedApplication.net_salary ? formatPrice(selectedApplication.net_salary) : null} />
                  <div className="col-span-2">
                    <DetailItem label="Expenses Summary" value={selectedApplication.expenses_summary} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Consent & Meta */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">POPIA Consent</p>
                  <p className={selectedApplication.popia_consent ? 'text-green-400' : 'text-red-400'}>
                    {selectedApplication.popia_consent ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p>{new Date(selectedApplication.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Quick Contact */}
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.open(`tel:${selectedApplication.phone}`, '_self')}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.open(`mailto:${selectedApplication.email}`, '_blank')}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
};

export default AdminFinance;