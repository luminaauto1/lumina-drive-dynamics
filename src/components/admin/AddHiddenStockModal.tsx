import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Ghost } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  id_number: string | null;
  email?: string | null;
  phone?: string | null;
}

export const AddHiddenStockModal = ({ onSuccess }: { onSuccess: () => void }) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    make: "", model: "", year: new Date().getFullYear(),
    vin: "", registration_number: "", mileage: 0,
    color: "", cost_price: 0,
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("none");

  useEffect(() => {
    if (isOpen) {
      const fetchClients = async () => {
        const { data } = await supabase
          .from('finance_applications')
          .select('id, first_name, last_name, id_number, email, phone')
          .neq('status', 'delivered')
          .order('created_at', { ascending: false });
        if (data) setClients(data);
      };
      fetchClients();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.make || !formData.model) {
      toast.error("Make and Model are required");
      return;
    }
    setLoading(true);
    try {
      const { data: vehicle, error: vError } = await supabase
        .from('vehicles')
        .insert({
          make: formData.make,
          model: formData.model,
          year: formData.year,
          vin: formData.vin || null,
          registration_number: formData.registration_number || null,
          mileage: formData.mileage,
          color: formData.color || null,
          cost_price: formData.cost_price,
          status: 'hidden',
          price: 0,
          transmission: 'Automatic',
          fuel_type: 'Petrol',
          finance_available: true,
          reserved_for_application_id: selectedClientId !== "none" ? selectedClientId : null,
        })
        .select()
        .single();

      if (vError) throw vError;

      if (selectedClientId && selectedClientId !== "none") {
        // Full link so the Deal Room, Finalize, and Client Profile all see this car:
        // write BOTH vehicle FKs (readers prefer selected_vehicle_id), advance the
        // application status, and create the application_matches row the Deal Room
        // reads from. Previously only vehicle_id was set and no match was created,
        // so finalize errored "please add a vehicle" and the profile showed none.
        await supabase
          .from('finance_applications')
          .update({
            vehicle_id: vehicle.id,
            selected_vehicle_id: vehicle.id,
            status: 'vehicle_selected',
          })
          .eq('id', selectedClientId);

        await supabase
          .from('application_matches')
          .insert({ application_id: selectedClientId, vehicle_id: vehicle.id, notes: 'Client-specific hidden stock' });

        // Refresh everything that depends on the link so no page refresh is needed.
        queryClient.invalidateQueries({ queryKey: ['finance-applications'] });
        queryClient.invalidateQueries({ queryKey: ['application-matches', selectedClientId] });
        queryClient.invalidateQueries({ queryKey: ['user-application-matches'] });
      }
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });

      toast.success(selectedClientId !== "none" ? "Hidden car added & linked to client!" : "Hidden stock added!");
      setIsOpen(false);
      onSuccess();
      setFormData({ make: "", model: "", year: new Date().getFullYear(), vin: "", registration_number: "", mileage: 0, color: "", cost_price: 0 });
      setSelectedClientId("none");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string | number) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-muted text-muted-foreground hover:bg-muted/20">
          <Ghost className="w-4 h-4" />
          Add Hidden Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Hidden / Client Stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Client Link */}
          <div className="space-y-1.5">
            <Label>Link to Client (Optional)</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No Client Yet —</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} — {c.email || c.phone || c.id_number || 'no contact'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Make *</Label>
              <Input value={formData.make} onChange={e => update('make', e.target.value)} placeholder="e.g. BMW" />
            </div>
            <div className="space-y-1.5">
              <Label>Model *</Label>
              <Input value={formData.model} onChange={e => update('model', e.target.value)} placeholder="e.g. 320d M Sport" />
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" value={formData.year} onChange={e => update('year', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Input value={formData.color} onChange={e => update('color', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>VIN</Label>
              <Input value={formData.vin} onChange={e => update('vin', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reg Number</Label>
              <Input value={formData.registration_number} onChange={e => update('registration_number', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mileage (km)</Label>
              <Input type="number" value={formData.mileage} onChange={e => update('mileage', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cost Price (R)</Label>
              <Input type="number" value={formData.cost_price} onChange={e => update('cost_price', Number(e.target.value))} className="font-semibold" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Hidden Stock
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
