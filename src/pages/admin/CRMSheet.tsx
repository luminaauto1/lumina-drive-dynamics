import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Sheet, Plus, ArrowRightLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useLeads, useUpdateLead, useCreateLead } from '@/hooks/useLeads';
import { useFinanceApplications, useUpdateFinanceApplication } from '@/hooks/useFinanceApplications';
import { STATUS_OPTIONS as FINANCE_STATUS_OPTIONS } from '@/lib/statusConfig';
import { toast } from 'sonner';

const LEAD_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted to App' },
  { value: 'lost', label: 'Lost' },
];

interface GridRow {
  id: string;
  type: 'lead' | 'finance';
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
  notes: string;
  options: { value: string; label: string }[];
}

const getStatusColor = (status: string) => {
  const green = ['approved', 'delivered', 'finalized', 'qualified'];
  const red = ['declined', 'lost'];
  const blue = ['pre_approved', 'vehicle_selected', 'validations_pending'];
  const yellow = ['new', 'pending', 'contacted', 'in_progress'];

  if (green.includes(status)) return 'border-l-emerald-500 bg-emerald-500/5';
  if (red.includes(status)) return 'border-l-red-500 bg-red-500/5';
  if (blue.includes(status)) return 'border-l-blue-500 bg-blue-500/5';
  if (yellow.includes(status)) return 'border-l-amber-500 bg-amber-500/5';
  return 'border-l-zinc-500 bg-zinc-500/5';
};

const CRMSheet = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('leads');
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');

  const { data: leads = [] } = useLeads();
  const { data: apps = [] } = useFinanceApplications();
  const updateLead = useUpdateLead();
  const createLead = useCreateLead();
  const updateApp = useUpdateFinanceApplication();

  function formatAppRow(app: any): GridRow {
    return {
      id: app.id,
      type: 'finance',
      firstName: app.first_name || app.full_name?.split(' ')[0] || 'Unknown',
      lastName: app.last_name || app.full_name?.split(' ').slice(1).join(' ') || '',
      phone: app.phone || 'N/A',
      status: app.status || 'pending',
      notes: app.notes || '',
      options: FINANCE_STATUS_OPTIONS,
    };
  }

  const gridData: GridRow[] = useMemo(() => {
    switch (activeTab) {
      case 'leads':
        return leads.map((l) => ({
          id: l.id,
          type: 'lead' as const,
          firstName: l.client_name?.split(' ')[0] || 'Unknown',
          lastName: l.client_name?.split(' ').slice(1).join(' ') || '',
          phone: l.client_phone || 'N/A',
          status: l.status || 'new',
          notes: l.notes || '',
          options: LEAD_STATUS_OPTIONS,
        }));
      case 'apps_received':
        return apps.filter((a) => a.status === 'pending').map(formatAppRow);
      case 'pre_approved':
        return apps.filter((a) => a.status === 'pre_approved').map(formatAppRow);
      case 'validated':
        return apps
          .filter((a) => ['validations_pending', 'approved', 'vehicle_selected'].includes(a.status))
          .map(formatAppRow);
      case 'aftersales':
        return apps.filter((a) => ['finalized', 'delivered'].includes(a.status)).map(formatAppRow);
      case 'declined':
        return apps.filter((a) => a.status === 'declined').map(formatAppRow);
      default:
        return [];
    }
  }, [activeTab, leads, apps]);

  const handleStatusChange = async (id: string, type: string, newStatus: string) => {
    if (type === 'lead') {
      await updateLead.mutateAsync({ id, updates: { status: newStatus } as any });
    } else {
      await updateApp.mutateAsync({ id, updates: { status: newStatus } });
    }
  };

  const handleNotesChange = async (id: string, type: string, newNotes: string) => {
    if (type === 'lead') {
      await updateLead.mutateAsync({ id, updates: { notes: newNotes } as any });
    } else {
      await updateApp.mutateAsync({ id, updates: { notes: newNotes } as any });
    }
    toast.success('Comment saved');
  };

  const handleAddLead = async () => {
    if (!newLeadName || !newLeadPhone) {
      toast.error('Name and Phone are required');
      return;
    }
    try {
      await createLead.mutateAsync({
        source: 'Manual Addition',
        client_name: newLeadName,
        client_phone: newLeadPhone,
        status: 'new',
        notes: '',
        client_email: null,
        vehicle_id: null,
      } as any);
      setAddLeadOpen(false);
      setNewLeadName('');
      setNewLeadPhone('');
      toast.success('Lead successfully added');
    } catch {
      toast.error('Failed to create lead');
    }
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>CRM Sheet | Lumina Admin</title>
      </Helmet>

      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sheet className="w-4 h-4 text-primary" />
              <h1 className="text-sm font-bold text-foreground">CRM Spreadsheet</h1>
            </div>
            <p className="text-[10px] text-muted-foreground">High-density overview and rapid triage.</p>
          </div>
          <Button size="sm" onClick={() => setAddLeadOpen(true)} className="bg-primary hover:bg-primary/90 text-xs h-7">
            <Plus className="w-3 h-3 mr-1" /> Add Lead
          </Button>
        </div>

        {/* Data Grid */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="h-7">
                <TableHead className="text-[10px] py-1 px-2">Name</TableHead>
                <TableHead className="text-[10px] py-1 px-2">Surname</TableHead>
                <TableHead className="text-[10px] py-1 px-2">Cell No.</TableHead>
                <TableHead className="text-[10px] py-1 px-2">Status</TableHead>
                <TableHead className="text-[10px] py-1 px-2">Comments</TableHead>
                <TableHead className="text-[10px] py-1 px-2 w-10">Act.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gridData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs">
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                gridData.map((row) => (
                  <TableRow key={row.id} className={`h-7 border-l-2 ${getStatusColor(row.status)}`}>
                    <TableCell className="py-0.5 px-2 text-[11px] font-medium">{row.firstName}</TableCell>
                    <TableCell className="py-0.5 px-2 text-[11px]">{row.lastName}</TableCell>
                    <TableCell className="py-0.5 px-2 text-[11px] font-mono">{row.phone}</TableCell>
                    <TableCell className="py-0.5 px-2">
                      <Select
                        value={row.status}
                        onValueChange={(val) => handleStatusChange(row.id, row.type, val)}
                      >
                        <SelectTrigger className="h-6 text-[10px] w-[130px] border-transparent bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {row.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-0.5 px-2">
                      <Input
                        defaultValue={row.notes}
                        onBlur={(e) => {
                          if (e.target.value !== row.notes) {
                            handleNotesChange(row.id, row.type, e.target.value);
                          }
                        }}
                        className="h-6 text-[10px] bg-transparent border-transparent hover:border-muted focus:border-primary px-1 w-full rounded-none"
                        placeholder="Add comment..."
                      />
                    </TableCell>
                    <TableCell className="py-0.5 px-2">
                      {row.type === 'lead' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          title="Convert to Finance Application"
                          onClick={() => navigate(`/admin/finance/create?leadId=${row.id}`)}
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Bottom Tabs */}
        <div className="border-t border-border px-2 py-1 bg-card">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start overflow-x-auto h-8">
              <TabsTrigger value="leads" className="text-[10px] py-1 px-2">Leads</TabsTrigger>
              <TabsTrigger value="apps_received" className="text-[10px] py-1 px-2">Apps Received</TabsTrigger>
              <TabsTrigger value="pre_approved" className="text-[10px] py-1 px-2">Pre-Approved</TabsTrigger>
              <TabsTrigger value="validated" className="text-[10px] py-1 px-2">Validated</TabsTrigger>
              <TabsTrigger value="aftersales" className="text-[10px] py-1 px-2">Aftersales</TabsTrigger>
              <TabsTrigger value="declined" className="text-[10px] py-1 px-2">Declined</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Add Lead Modal */}
      <Dialog open={addLeadOpen} onOpenChange={setAddLeadOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Quick Add Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Full Name</Label>
              <Input value={newLeadName} onChange={(e) => setNewLeadName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cell Number</Label>
              <Input value={newLeadPhone} onChange={(e) => setNewLeadPhone(e.target.value)} placeholder="082 123 4567" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLeadOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLead}>Save Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default CRMSheet;
