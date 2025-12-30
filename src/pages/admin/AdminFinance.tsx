import { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Search, Phone, Mail, CreditCard, FileText, Trash2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFinanceApplications, useUpdateFinanceApplication, FinanceApplication } from '@/hooks/useFinanceApplications';
import { formatPrice } from '@/hooks/useVehicles';

const AdminFinance = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedApplication, setSelectedApplication] = useState<FinanceApplication | null>(null);

  const { data: applications = [], isLoading } = useFinanceApplications();
  const updateApplication = useUpdateFinanceApplication();

  const filteredApplications = applications.filter(app => {
    const matchesSearch = !searchQuery || 
      app.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.phone.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (appId: string, newStatus: string) => {
    await updateApplication.mutateAsync({ id: appId, updates: { status: newStatus } });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
      processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };

    return (
      <span className={`px-2 py-1 text-xs uppercase tracking-wider rounded border ${styles[status] || styles.pending}`}>
        {status}
      </span>
    );
  };

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
          <p className="text-muted-foreground">Review and manage finance applications</p>
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
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-amber-400">{applications.filter(a => a.status === 'pending').length}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-blue-400">{applications.filter(a => a.status === 'processing').length}</p>
            <p className="text-sm text-muted-foreground">Processing</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-emerald-400">{applications.filter(a => a.status === 'approved').length}</p>
            <p className="text-sm text-muted-foreground">Approved</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold">{applications.length}</p>
            <p className="text-sm text-muted-foreground">Total Applications</p>
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
                  <TableHead className="text-muted-foreground">Applicant</TableHead>
                  <TableHead className="text-muted-foreground">Contact</TableHead>
                  <TableHead className="text-muted-foreground">Vehicle</TableHead>
                  <TableHead className="text-muted-foreground">Income</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app) => (
                  <TableRow key={app.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      <div>
                        <p className="font-medium">{app.full_name}</p>
                        <p className="text-xs text-muted-foreground">{app.employment_status || 'N/A'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        <a href={`tel:${app.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <Phone className="w-3 h-3" />
                          {app.phone}
                        </a>
                        <a href={`mailto:${app.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <Mail className="w-3 h-3" />
                          {app.email}
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      {app.vehicle ? (
                        <span className="text-sm">
                          {app.vehicle.year} {app.vehicle.make} {app.vehicle.model}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">No vehicle</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {app.monthly_income ? formatPrice(app.monthly_income) + '/pm' : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={app.status} 
                        onValueChange={(value) => handleStatusChange(app.id, value)}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedApplication(app)}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </motion.div>
      </div>

      {/* Application Details Modal */}
      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
          </DialogHeader>
          
          {selectedApplication && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{selectedApplication.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ID Number</p>
                  <p className="font-medium">{selectedApplication.id_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedApplication.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedApplication.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employment Status</p>
                  <p className="font-medium">{selectedApplication.employment_status || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employer</p>
                  <p className="font-medium">{selectedApplication.employer_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Income</p>
                  <p className="font-medium">{selectedApplication.monthly_income ? formatPrice(selectedApplication.monthly_income) : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Deposit Amount</p>
                  <p className="font-medium">{selectedApplication.deposit_amount ? formatPrice(selectedApplication.deposit_amount) : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loan Term</p>
                  <p className="font-medium">{selectedApplication.loan_term_months ? `${selectedApplication.loan_term_months} months` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle</p>
                  <p className="font-medium">
                    {selectedApplication.vehicle 
                      ? `${selectedApplication.vehicle.year} ${selectedApplication.vehicle.make} ${selectedApplication.vehicle.model}`
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {selectedApplication.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium">{selectedApplication.notes}</p>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">Update Status</p>
                <Select 
                  value={selectedApplication.status} 
                  onValueChange={(value) => handleStatusChange(selectedApplication.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminFinance;