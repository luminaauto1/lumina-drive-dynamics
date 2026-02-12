import { useEffect, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Search, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";

interface Contact {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  notes: string | null;
  pipeline_stage: string | null;
  source: string;
  created_at: string;
}

const AdminContacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('id, client_name, client_phone, client_email, notes, pipeline_stage, source, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load contacts');
    } else {
      setContacts(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const updateContact = async (id: string, field: string, value: string) => {
    // Optimistic update
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

    setSavingId(id);
    const { error } = await supabase.from('leads').update({ [field]: value }).eq('id', id);
    if (error) {
      toast.error('Save failed');
      fetchContacts(); // revert
    }
    setSavingId(null);
  };

  const addNewRow = async () => {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        client_name: 'New Contact',
        client_phone: '',
        source: 'manual',
        status: 'new',
        pipeline_stage: 'new',
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
    } else if (data) {
      setContacts(prev => [data, ...prev]);
      toast.success('Row added — start typing to fill it in.');
    }
  };

  const filteredContacts = contacts.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.client_name?.toLowerCase().includes(q) ||
      c.client_phone?.includes(q) ||
      c.client_email?.toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout>
      <Helmet>
        <title>Contacts Database | Lumina Auto</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Contacts Database</h1>
            <p className="text-sm text-muted-foreground">Click any cell to edit inline • Auto-saves on change</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-9 w-56"
              />
            </div>
            <Button size="sm" onClick={addNewRow}>
              <Plus className="w-4 h-4 mr-1" /> Add Row
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchContacts(); }}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead className="w-[160px]">Phone</TableHead>
                    <TableHead className="w-[220px]">Email</TableHead>
                    <TableHead className="w-[250px]">Notes / ID</TableHead>
                    <TableHead className="w-[100px]">Source</TableHead>
                    <TableHead className="w-[100px]">Stage</TableHead>
                    <TableHead className="w-[60px]">WA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((c) => {
                    const phone = c.client_phone?.replace(/\D/g, '') || '';
                    const waPhone = phone.startsWith('0') ? `27${phone.slice(1)}` : phone;

                    return (
                      <TableRow key={c.id} className={savingId === c.id ? 'bg-primary/5' : ''}>
                        <TableCell className="p-1">
                          <Input
                            defaultValue={c.client_name || ''}
                            onBlur={e => {
                              if (e.target.value !== (c.client_name || '')) {
                                updateContact(c.id, 'client_name', e.target.value);
                              }
                            }}
                            className="h-8 border-transparent hover:border-border focus:border-border bg-transparent"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            defaultValue={c.client_phone || ''}
                            onBlur={e => {
                              if (e.target.value !== (c.client_phone || '')) {
                                updateContact(c.id, 'client_phone', e.target.value);
                              }
                            }}
                            className="h-8 border-transparent hover:border-border focus:border-border bg-transparent"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            defaultValue={c.client_email || ''}
                            onBlur={e => {
                              if (e.target.value !== (c.client_email || '')) {
                                updateContact(c.id, 'client_email', e.target.value);
                              }
                            }}
                            className="h-8 border-transparent hover:border-border focus:border-border bg-transparent"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            defaultValue={c.notes || ''}
                            onBlur={e => {
                              if (e.target.value !== (c.notes || '')) {
                                updateContact(c.id, 'notes', e.target.value);
                              }
                            }}
                            className="h-8 border-transparent hover:border-border focus:border-border bg-transparent"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{c.source}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{c.pipeline_stage || 'new'}</Badge>
                        </TableCell>
                        <TableCell>
                          {waPhone && (
                            <a
                              href={`https://wa.me/${waPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-500 hover:text-green-400"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminContacts;
