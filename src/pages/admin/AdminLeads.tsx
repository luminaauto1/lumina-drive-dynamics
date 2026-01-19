import { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Search, Phone, Mail, Car, Trash2, Eye } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useLeads, useUpdateLead, useDeleteLead, Lead } from '@/hooks/useLeads';
import ClientGenomeDrawer from '@/components/admin/ClientGenomeDrawer';

const AdminLeads = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: leads = [], isLoading } = useLeads();
  const updateLead = useUpdateLead();
  const deleteLeadMutation = useDeleteLead();

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchQuery || 
      lead.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.client_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.client_phone?.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    await updateLead.mutateAsync({ id: leadId, updates: { status: newStatus } });
  };

  const handleDelete = async () => {
    if (!deleteLead) return;
    await deleteLeadMutation.mutateAsync(deleteLead.id);
    setDeleteLead(null);
  };

  const handleRowClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDrawerOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      contacted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      sold: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      dead: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
      <span className={`px-2 py-1 text-xs uppercase tracking-wider rounded border ${styles[status] || styles.new}`}>
        {status}
      </span>
    );
  };

  const getSourceBadge = (source: string) => {
    const styles: Record<string, string> = {
      'Finance Form': 'bg-purple-500/20 text-purple-400',
      'Contact Page': 'bg-blue-500/20 text-blue-400',
      'WhatsApp Click': 'bg-emerald-500/20 text-emerald-400',
      website: 'bg-gray-500/20 text-gray-400',
    };

    return (
      <span className={`px-2 py-1 text-xs rounded ${styles[source] || styles.website}`}>
        {source}
      </span>
    );
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Leads CRM | Lumina Auto Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-semibold mb-2">Leads & CRM</h1>
          <p className="text-muted-foreground">Manage customer inquiries and leads • Click a row to open Client 360</p>
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
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="dead">Dead</SelectItem>
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
            <p className="text-2xl font-bold text-blue-400">{leads.filter(l => l.status === 'new').length}</p>
            <p className="text-sm text-muted-foreground">New Leads</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-amber-400">{leads.filter(l => l.status === 'contacted').length}</p>
            <p className="text-sm text-muted-foreground">Contacted</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold text-emerald-400">{leads.filter(l => l.status === 'sold').length}</p>
            <p className="text-sm text-muted-foreground">Converted</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-2xl font-bold">{leads.length}</p>
            <p className="text-sm text-muted-foreground">Total Leads</p>
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
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery || statusFilter !== 'all' ? 'No leads match your filters' : 'No leads yet'}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-muted-foreground">Source</TableHead>
                  <TableHead className="text-muted-foreground">Client</TableHead>
                  <TableHead className="text-muted-foreground">Contact</TableHead>
                  <TableHead className="text-muted-foreground">Vehicle</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow 
                    key={lead.id} 
                    className="border-white/10 hover:bg-white/5 cursor-pointer"
                    onClick={() => handleRowClick(lead)}
                  >
                    <TableCell>{getSourceBadge(lead.source)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{lead.client_name || 'Unknown'}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        {lead.client_phone && (
                          <a 
                            href={`tel:${lead.client_phone}`} 
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="w-3 h-3" />
                            {lead.client_phone}
                          </a>
                        )}
                        {lead.client_email && (
                          <a 
                            href={`mailto:${lead.client_email}`} 
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="w-3 h-3" />
                            {lead.client_email}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.vehicle ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Car className="w-3 h-3 text-muted-foreground" />
                          {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No vehicle</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select 
                        value={lead.status} 
                        onValueChange={(value) => handleStatusChange(lead.id, value)}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="sold">Sold</SelectItem>
                          <SelectItem value="dead">Dead</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRowClick(lead)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteLead(lead)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Client Genome Drawer */}
      <ClientGenomeDrawer 
        lead={selectedLead}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLead} onOpenChange={() => setDeleteLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this lead from {deleteLead?.client_name || 'Unknown'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminLeads;
