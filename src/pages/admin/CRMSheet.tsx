import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Sheet, Plus, ArrowRightLeft } from 'lucide-react';
import UniversalClientHub from '@/components/admin/UniversalClientHub';
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
import { format, differenceInDays } from 'date-fns';

const LEAD_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted to App' },
  { value: 'lost', label: 'Lost' },
];

const getStatusColor = (status: string) => {
  const green = ['approved', 'delivered', 'finalized', 'qualified', 'converted'];
  const red = ['declined', 'lost'];
  const blue = ['pre_approved', 'vehicle_selected', 'validations_pending'];
  const yellow = ['new', 'pending', 'contacted', 'in_progress', 'under_review', 'needs_revision'];

  if (green.includes(status)) return 'border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20';
  if (red.includes(status)) return 'border-red-500 bg-red-500/10 hover:bg-red-500/20';
  if (blue.includes(status)) return 'border-blue-500 bg-blue-500/10 hover:bg-blue-500/20';
  if (yellow.includes(status)) return 'border-amber-500 bg-amber-500/10 hover:bg-amber-500/20';
  return 'border-zinc-500 bg-zinc-500/10 hover:bg-zinc-500/20';
};

const getThermalAgeColor = (dateString: string) => {
  if (!dateString) return 'text-muted-foreground';
  const daysOld = differenceInDays(new Date(), new Date(dateString));
  if (daysOld <= 2) return 'text-muted-foreground';
  if (daysOld <= 5) return 'text-amber-400';
  return 'text-red-500 font-semibold';
};

interface GridRow {
  id: string;
  type: 'lead' | 'finance';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
  createdAt: string;
  options: { value: string; label: string }[];
}

function formatAppRow(app: any): GridRow {
  return {
    id: app.id,
    type: 'finance',
    firstName: app.first_name || app.full_name?.split(' ')[0] || 'Unknown',
    lastName: app.last_name || app.full_name?.split(' ').slice(1).join(' ') || '',
    email: app.email || '',
    phone: app.phone || 'N/A',
    status: app.status || 'pending',
    notes: app.notes || '',
    createdAt: app.created_at,
    options: FINANCE_STATUS_OPTIONS,
  };
}

const CRMSheet = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('leads');
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [hubOpen, setHubOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | undefined>();
  const [selectedPhone, setSelectedPhone] = useState<string | undefined>();

  const openClientHub = (email?: string, phone?: string) => {
    setSelectedEmail(email || undefined);
    setSelectedPhone(phone || undefined);
    setHubOpen(true);
  };
  const { data: leads = [] } = useLeads();
  const { data: apps = [] } = useFinanceApplications();
  const updateLead = useUpdateLead();
  const createLead = useCreateLead();
  const updateApp = useUpdateFinanceApplication();

  const gridData: GridRow[] = useMemo(() => {
    const mapLead = (l: any): GridRow => ({
      id: l.id,
      type: 'lead',
      firstName: l.client_name?.split(' ')[0] || 'Unknown',
      lastName: l.client_name?.split(' ').slice(1).join(' ') || '',
      email: l.client_email || '',
      phone: l.client_phone || 'N/A',
      status: l.status || 'new',
      notes: l.notes || '',
      createdAt: l.created_at,
      options: LEAD_STATUS_OPTIONS,
    });

    switch (activeTab) {
      case 'leads':
        return leads.filter(l => !['lost', 'converted'].includes(l.status || '')).map(mapLead);
      case 'apps_received':
        return apps.filter(a => ['pending', 'under_review', 'needs_revision'].includes(a.status)).map(formatAppRow);
      case 'pre_approved':
        return apps.filter(a => ['pre_approved', 'vehicle_selected'].includes(a.status)).map(formatAppRow);
      case 'validated':
        return apps.filter(a => ['validations_pending', 'approved'].includes(a.status)).map(formatAppRow);
      case 'aftersales':
        return apps.filter(a => ['finalized', 'delivered'].includes(a.status)).map(formatAppRow);
      case 'declined': {
        const lostLeads = leads.filter(l => l.status === 'lost').map(mapLead);
        const declinedApps = apps.filter(a => a.status === 'declined').map(formatAppRow);
        return [...lostLeads, ...declinedApps];
      }
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
          <Button size="sm" onClick={() => setAddLeadOpen(true)} className="bg-primary hover:bg-primary/90 text-xs h-8">
            <Plus className="w-3 h-3 mr-1" /> Add Lead
          </Button>
        </div>

        {/* Data Grid - horizontal scroll with expanded min-width */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[900px]">
            <Table>
              <TableHeader>
                <TableRow className="h-7">
                  <TableHead className="text-[10px] py-1 px-2">Name</TableHead>
                  <TableHead className="text-[10px] py-1 px-2">Surname</TableHead>
                  <TableHead className="text-[10px] py-1 px-2">Cell No.</TableHead>
                  <TableHead className="text-[10px] py-1 px-2">Date</TableHead>
                  <TableHead className="text-[10px] py-1 px-2">Status</TableHead>
                  <TableHead className="text-[10px] py-1 px-2">Comments</TableHead>
                  <TableHead className="text-[10px] py-1 px-2 w-10">Act.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gridData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6 text-xs">
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  gridData.map((row) => (
                    <TableRow key={row.id} className={`h-7 border-l-2 ${getStatusColor(row.status)}`}>
                      <TableCell className="py-0.5 px-2 text-[11px] font-medium">
                        <span className="cursor-pointer hover:text-primary hover:underline transition-colors" onClick={() => openClientHub(row.email, row.phone)}>
                          {row.firstName}
                        </span>
                      </TableCell>
                      <TableCell className="py-0.5 px-2 text-[11px]">
                        <span className="cursor-pointer hover:text-primary hover:underline transition-colors" onClick={() => openClientHub(row.email, row.phone)}>
                          {row.lastName}
                        </span>
                      </TableCell>
                      <TableCell className="py-0.5 px-2 text-[11px] font-mono">{row.phone}</TableCell>
                      <TableCell className={`py-0.5 px-2 text-[10px] ${getThermalAgeColor(row.createdAt)}`}>
                        {row.createdAt ? format(new Date(row.createdAt), 'dd MMM') : 'N/A'}
                      </TableCell>
                      <TableCell className="py-0.5 px-2">
                        <Select value={row.status} onValueChange={(val) => handleStatusChange(row.id, row.type, val)}>
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
                          defaultValue=""
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
              <TabsTrigger value="declined" className="text-[10px] py-1 px-2">Lost & Declined</TabsTrigger>
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

      <UniversalClientHub
        open={hubOpen}
        onOpenChange={setHubOpen}
        clientEmail={selectedEmail}
        clientPhone={selectedPhone}
      />
    </AdminLayout>
  );
};

export default CRMSheet;
