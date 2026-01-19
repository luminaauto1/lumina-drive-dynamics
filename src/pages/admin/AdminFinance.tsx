import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Search, MessageCircle, ExternalLink, Trash2, Archive, UserPlus } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useFinanceApplications, useUpdateFinanceApplication, useDeleteFinanceApplication, FinanceApplication } from '@/hooks/useFinanceApplications';
import { formatPrice } from '@/hooks/useVehicles';
import { STATUS_OPTIONS, STATUS_STYLES, ADMIN_STATUS_LABELS, getWhatsAppMessage } from '@/lib/statusConfig';

const AdminFinance = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');

  const { data: applications = [], isLoading } = useFinanceApplications();
  const updateApplication = useUpdateFinanceApplication();
  const deleteApplication = useDeleteFinanceApplication();

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
    
    // Filter by active/archived
    const isArchived = app.status === 'archived';
    const matchesViewMode = viewMode === 'archived' ? isArchived : !isArchived;

    return matchesSearch && matchesStatus && matchesViewMode;
  });

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

  // Stats for active applications only
  const activeApps = applications.filter(a => a.status !== 'archived');

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
          <Button onClick={() => navigate('/admin/finance/create')} className="w-fit">
            <UserPlus className="w-4 h-4 mr-2" />
            Create Application
          </Button>
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
                  const badCredit = ['bad', 'blacklisted'].includes((app as any).credit_score_status || '');
                  const hasWarning = lowSalary || noLicense || badCredit;
                  
                  return (
                  <TableRow 
                    key={app.id} 
                    className="border-white/10 hover:bg-white/5 cursor-pointer"
                    onClick={() => navigate(`/admin/finance/${app.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{app.first_name} {app.last_name}</p>
                          <p className="text-xs text-muted-foreground">{app.email}</p>
                        </div>
                        {hasWarning && (
                          <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            ⚠ RISK
                          </span>
                        )}
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
                    <TableCell>
                      <span className={`px-2 py-1 text-xs uppercase tracking-wider rounded border ${STATUS_STYLES[app.status] || STATUS_STYLES.pending}`}>
                        {ADMIN_STATUS_LABELS[app.status] || app.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
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
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
      </div>
    </AdminLayout>
  );
};

export default AdminFinance;
