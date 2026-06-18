import { useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Vendor, VendorType, useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor,
} from '@/hooks/useVendors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Building2, Plus, Pencil, Trash2, Banknote, Truck } from 'lucide-react';
import { VendorDocumentsSection } from '@/components/admin/VendorDocumentsSection';

const TYPE_LABEL: Record<VendorType, string> = {
  supplier: 'Supplier (we buy from)',
  finance_house: 'Finance house (we sell to)',
  both: 'Supplier & Finance house',
};
const TYPE_BADGE: Record<VendorType, string> = {
  supplier: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  finance_house: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  both: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const emptyVendor: Partial<Vendor> = { name: '', vendor_type: 'supplier', is_active: true };

const AdminVendors = () => {
  const { data: vendors = [], isLoading } = useVendors();
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | VendorType>('all');
  const [editing, setEditing] = useState<Partial<Vendor> | null>(null); // open form when not null
  const [toDelete, setToDelete] = useState<Vendor | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (typeFilter !== 'all' && v.vendor_type !== typeFilter) return false;
      if (!q) return true;
      return [v.name, v.contact_person, v.email, v.vat_number, v.registration_number]
        .some((f) => (f || '').toLowerCase().includes(q));
    });
  }, [vendors, search, typeFilter]);

  const isNew = editing != null && !editing.id;

  const save = async () => {
    if (!editing?.name?.trim()) return;
    const payload = {
      name: editing.name,
      vendor_type: editing.vendor_type || 'supplier',
      is_active: editing.is_active ?? true,
      registration_number: editing.registration_number || null,
      vat_number: editing.vat_number || null,
      contact_person: editing.contact_person || null,
      email: editing.email || null,
      phone: editing.phone || null,
      address: editing.address || null,
      bank_name: editing.bank_name || null,
      bank_account_number: editing.bank_account_number || null,
      bank_branch_code: editing.bank_branch_code || null,
      invoice_notes: editing.invoice_notes || null,
    };
    if (editing.id) {
      await updateVendor.mutateAsync({ id: editing.id, ...payload } as any);
    } else {
      const created = await createVendor.mutateAsync(payload as any);
      // keep the form open on the freshly-created vendor so docs can be added
      setEditing(created);
      return;
    }
    setEditing(null);
  };

  const set = (patch: Partial<Vendor>) => setEditing((p) => ({ ...(p || {}), ...patch }));

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" /> Vendors
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Suppliers you buy cars from, and finance houses you invoice deals to.
            </p>
          </div>
          <Button onClick={() => setEditing({ ...emptyVendor })}>
            <Plus className="w-4 h-4 mr-1" /> Add Vendor
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search name, contact, VAT no.…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="supplier">Suppliers</SelectItem>
              <SelectItem value="finance_house">Finance houses</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold">Vendor</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Contact</TableHead>
                    <TableHead className="font-semibold">VAT No.</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No vendors yet — add your first supplier or finance house.
                    </TableCell></TableRow>
                  )}
                  {filtered.map((v) => (
                    <TableRow key={v.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setEditing(v)}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          {v.name}
                          {!v.is_active && <Badge variant="outline" className="text-[10px] opacity-70">inactive</Badge>}
                        </div>
                        {v.address && <div className="text-xs text-muted-foreground truncate max-w-[260px]">{v.address}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TYPE_BADGE[v.vendor_type]}>
                          {v.vendor_type === 'finance_house'
                            ? <Banknote className="w-3 h-3 mr-1" />
                            : <Truck className="w-3 h-3 mr-1" />}
                          {v.vendor_type === 'both' ? 'Both' : v.vendor_type === 'finance_house' ? 'Finance' : 'Supplier'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{v.contact_person || '—'}</div>
                        <div className="text-xs text-muted-foreground">{v.phone || v.email || ''}</div>
                      </TableCell>
                      <TableCell className="text-sm">{v.vat_number || '—'}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(v)} aria-label="Edit">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(v)} aria-label="Delete">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={editing != null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add Vendor' : `Edit — ${editing?.name}`}</DialogTitle>
            <DialogDescription>
              Used as the "bought from" source at stock-in and the "bill-to" party on finance invoices.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Vendor name <span className="text-red-400">*</span></Label>
                  <Input value={editing.name || ''} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Dealfin Finance / ABC Auctions" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={editing.vendor_type || 'supplier'} onValueChange={(v) => set({ vendor_type: v as VendorType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supplier">{TYPE_LABEL.supplier}</SelectItem>
                      <SelectItem value="finance_house">{TYPE_LABEL.finance_house}</SelectItem>
                      <SelectItem value="both">{TYPE_LABEL.both}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 pt-7">
                  <Switch checked={editing.is_active ?? true} onCheckedChange={(c) => set({ is_active: c })} id="vendor-active" />
                  <Label htmlFor="vendor-active">Active</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Company Reg No." value={editing.registration_number} onChange={(v) => set({ registration_number: v })} />
                <Field label="VAT No." value={editing.vat_number} onChange={(v) => set({ vat_number: v })} />
                <Field label="Contact Person" value={editing.contact_person} onChange={(v) => set({ contact_person: v })} />
                <Field label="Phone" value={editing.phone} onChange={(v) => set({ phone: v })} />
                <Field label="Email" value={editing.email} onChange={(v) => set({ email: v })} />
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea rows={2} value={editing.address || ''} onChange={(e) => set({ address: e.target.value })} />
              </div>

              <div>
                <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-3">Banking</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Bank" value={editing.bank_name} onChange={(v) => set({ bank_name: v })} />
                  <Field label="Account No." value={editing.bank_account_number} onChange={(v) => set({ bank_account_number: v })} />
                  <Field label="Branch Code" value={editing.bank_branch_code} onChange={(v) => set({ bank_branch_code: v })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Invoicing notes / bill-to details</Label>
                <Textarea rows={2} value={editing.invoice_notes || ''} onChange={(e) => set({ invoice_notes: e.target.value })}
                  placeholder="Exact name & details to print on invoices addressed to this vendor." />
              </div>

              {/* Documents — only once the vendor exists */}
              {editing.id ? (
                <VendorDocumentsSection vendorId={editing.id} />
              ) : (
                <p className="text-xs text-muted-foreground border-t pt-4">
                  Save the vendor first to attach documents (company reg, VAT cert, agreements…).
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Close</Button>
            <Button onClick={save} disabled={!editing?.name?.trim() || createVendor.isPending || updateVendor.isPending}>
              {isNew ? 'Create Vendor' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={toDelete != null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete vendor?</DialogTitle>
            <DialogDescription>
              "{toDelete?.name}" will be permanently removed. This is blocked if it's still linked to a vehicle or deal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteVendor.isPending}
              onClick={async () => { if (toDelete) { await deleteVendor.mutateAsync(toDelete.id); setToDelete(null); } }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

const Field = ({ label, value, onChange }: { label: string; value?: string | null; onChange: (v: string) => void }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input value={value || ''} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default AdminVendors;
