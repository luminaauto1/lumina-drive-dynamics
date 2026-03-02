import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building, MapPin, Phone, User, Plus, X, Search, DollarSign, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  name: string;
  role: string;
  phone: string;
}

interface TradePartner {
  id: string;
  company_name: string;
  type: string;
  location: string | null;
  typical_admin_fee: number | null;
  negotiability: string | null;
  contact_persons: Contact[] | null;
  notes: string | null;
  created_at: string;
}

const AdminNetwork = () => {
  const { toast } = useToast();
  const [partners, setPartners] = useState<TradePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const [formData, setFormData] = useState({
    company_name: "",
    type: "supplier",
    location: "",
    typical_admin_fee: 0,
    negotiability: "medium",
    notes: "",
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState<Contact>({ name: "", role: "", phone: "" });

  const fetchPartners = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("trade_network" as any)
      .select("*")
      .order("company_name");
    if (data) setPartners(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const addContact = () => {
    if (!newContact.name) return;
    setContacts([...contacts, newContact]);
    setNewContact({ name: "", role: "", phone: "" });
  };

  const removeContact = (index: number) => setContacts(contacts.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!formData.company_name) {
      return toast({ variant: "destructive", title: "Company Name Required" });
    }

    const { error } = await supabase
      .from("trade_network" as any)
      .insert({ ...formData, contact_persons: contacts } as any);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Partner Added" });
      setIsOpen(false);
      setFormData({ company_name: "", type: "supplier", location: "", typical_admin_fee: 0, negotiability: "medium", notes: "" });
      setContacts([]);
      fetchPartners();
    }
  };

  const filteredPartners = partners.filter((p) =>
    p.company_name.toLowerCase().includes(search.toLowerCase())
  );
  const suppliers = filteredPartners.filter((p) => p.type === "supplier" || p.type === "both");
  const buyers = filteredPartners.filter((p) => p.type === "buyer" || p.type === "both");

  const PartnerCard = ({ partner }: { partner: TradePartner }) => (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{partner.company_name}</h3>
          {partner.location && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" /> {partner.location}
            </p>
          )}
        </div>
        <Badge variant="outline" className="capitalize">{partner.type}</Badge>
      </div>

      {(partner.type === "supplier" || partner.type === "both") && (
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Standard Admin Fee:</span>
          <span className="font-medium">R {Number(partner.typical_admin_fee || 0).toLocaleString()}</span>
          {partner.negotiability && (
            <Badge variant="secondary" className="ml-auto text-xs capitalize">
              {partner.negotiability}
            </Badge>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Key Contacts</p>
        {partner.contact_persons && partner.contact_persons.length > 0 ? (
          partner.contact_persons.map((c, i) => (
            <div key={i} className="text-sm space-y-0.5">
              <p className="flex items-center gap-1">
                <User className="w-3 h-3" /> {c.name} ({c.role})
              </p>
              <p className="flex items-center gap-1 text-muted-foreground">
                <Phone className="w-3 h-3" /> {c.phone}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No contacts listed.</p>
        )}
      </div>

      {partner.notes && (
        <p className="text-sm text-muted-foreground border-t pt-3">{partner.notes}</p>
      )}
    </Card>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search partners..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Add Partner
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Trade Partner</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Company Name</Label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Partner Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supplier">Vehicle Supplier</SelectItem>
                      <SelectItem value="buyer">Trade Buyer (Client)</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                {formData.type !== "buyer" && (
                  <>
                    <div>
                      <Label>Typical Admin Fee</Label>
                      <Input
                        type="number"
                        value={formData.typical_admin_fee}
                        onChange={(e) => setFormData({ ...formData, typical_admin_fee: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Negotiability</Label>
                      <Select value={formData.negotiability} onValueChange={(v) => setFormData({ ...formData, negotiability: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High (Flexible)</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="strict">Strict (No Movement)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="space-y-3">
                  <Label>Contact Persons</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Name"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    />
                    <Input
                      placeholder="Role"
                      value={newContact.role}
                      onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                    />
                    <Input
                      placeholder="Phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    />
                    <Button type="button" size="sm" onClick={addContact}>Add</Button>
                  </div>
                  <div className="space-y-1">
                    {contacts.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm bg-muted px-3 py-1.5 rounded">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">{c.role}</span>
                        <span className="text-muted-foreground">{c.phone}</span>
                        <button className="ml-auto" onClick={() => removeContact(i)}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <Button className="w-full mt-2" onClick={handleSave}>Save Partner</Button>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="suppliers" className="w-full">
          <TabsList>
            <TabsTrigger value="suppliers" className="gap-2">
              <Building className="w-4 h-4" /> Suppliers ({suppliers.length})
            </TabsTrigger>
            <TabsTrigger value="buyers" className="gap-2">
              <Briefcase className="w-4 h-4" /> Trade Buyers ({buyers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suppliers" className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {suppliers.map((p) => <PartnerCard key={p.id} partner={p} />)}
              {suppliers.length === 0 && !loading && (
                <div className="col-span-3 text-center text-muted-foreground py-12">No suppliers found.</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="buyers" className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {buyers.map((p) => <PartnerCard key={p.id} partner={p} />)}
              {buyers.length === 0 && !loading && (
                <div className="col-span-3 text-center text-muted-foreground py-12">No trade buyers found.</div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminNetwork;
