import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Sheet } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLeads, useUpdateLead } from '@/hooks/useLeads';
import { useFinanceApplications, useUpdateFinanceApplication } from '@/hooks/useFinanceApplications';
import { STATUS_OPTIONS as FINANCE_STATUS_OPTIONS } from '@/lib/statusConfig';

const LEAD_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'lost', label: 'Lost' },
];

interface GridRow {
  id: string;
  type: 'lead' | 'finance';
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
  options: { value: string; label: string }[];
}

const CRMSheet = () => {
  const [activeTab, setActiveTab] = useState('leads');

  const { data: leads = [] } = useLeads();
  const { data: apps = [] } = useFinanceApplications();
  const updateLead = useUpdateLead();
  const updateApp = useUpdateFinanceApplication();

  function formatAppRow(app: any): GridRow {
    return {
      id: app.id,
      type: 'finance',
      firstName: app.first_name || app.full_name?.split(' ')[0] || 'Unknown',
      lastName: app.last_name || app.full_name?.split(' ').slice(1).join(' ') || '',
      phone: app.phone || 'N/A',
      status: app.status || 'pending',
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

  return (
    <AdminLayout>
      <Helmet>
        <title>CRM Sheet | Lumina Admin</title>
      </Helmet>

      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Sheet className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">CRM Spreadsheet</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            High-density overview and rapid status triage.
          </p>
        </div>

        {/* Data Grid Area */}
        <div className="flex-1 overflow-auto p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Surname</TableHead>
                <TableHead>Cell No.</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gridData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No records found in this view.
                  </TableCell>
                </TableRow>
              ) : (
                gridData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.firstName}</TableCell>
                    <TableCell>{row.lastName}</TableCell>
                    <TableCell className="font-mono text-xs">{row.phone}</TableCell>
                    <TableCell>
                      <Select
                        value={row.status}
                        onValueChange={(val) => handleStatusChange(row.id, row.type, val)}
                      >
                        <SelectTrigger className="h-7 text-xs w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {row.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Bottom Tabs */}
        <div className="border-t border-border p-2 bg-card">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="apps_received">Apps Received</TabsTrigger>
              <TabsTrigger value="pre_approved">Pre-Approved</TabsTrigger>
              <TabsTrigger value="validated">Validated</TabsTrigger>
              <TabsTrigger value="aftersales">Aftersales</TabsTrigger>
              <TabsTrigger value="declined">Declined</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </AdminLayout>
  );
};

export default CRMSheet;
