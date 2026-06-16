import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User, Car, FileText, History, Loader2, Building2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import JuristicPanel from "@/components/admin/JuristicPanel";
import DocumentManager from "@/components/admin/DocumentManager";
import ClientTimeline from "@/components/admin/ClientTimeline";
import { buildClientTimeline, TimelineItem } from "@/lib/clientTimeline";
import { useDocumentSettings, consumeInvoiceNumber } from "@/hooks/useDocumentSettings";
import { generateInvoicePDF } from "@/lib/generateInvoicePDF";
import { toast } from "sonner";

const ClientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const { data: docSettings } = useDocumentSettings();

  const handleGenerateInvoice = async () => {
    const deal = client?.deal_records?.[0];
    if (!deal || !docSettings) {
      toast.error('No finalized deal to invoice yet.');
      return;
    }
    setGeneratingInvoice(true);
    try {
      const v = client.selected_vehicle || client.linked_vehicle;
      const vehicleLabel = v ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() : 'Vehicle';
      const lineItems = [{ description: `Vehicle: ${vehicleLabel}`, amount: Number(deal.sold_price || 0) }];
      const addons = Array.isArray(deal.addons_data) ? deal.addons_data : [];
      addons.forEach((a: any) => {
        const price = Number(a?.price || 0);
        if (price > 0) lineItems.push({ description: a?.name || 'Add-on', amount: price });
      });
      const invoiceNumber = await consumeInvoiceNumber(docSettings);
      generateInvoicePDF({
        invoiceNumber,
        date: new Date(deal.sale_date || deal.created_at || Date.now()).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }),
        clientName: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.full_name || 'Client',
        idNumber: client.id_number || undefined,
        address: [client.street_address, client.area_code].filter(Boolean).join(', ') || undefined,
        email: client.email || undefined,
        phone: client.phone || undefined,
        vehicleLabel,
        vin: v?.vin || undefined,
        reg: v?.registration_number || undefined,
        lineItems,
      }, docSettings);
      toast.success(`Invoice ${invoiceNumber} generated`);
    } catch (e: any) {
      toast.error('Invoice generation failed: ' + e.message);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  useEffect(() => {
    const fetchClient = async () => {
      // Join the vehicle via BOTH foreign keys — the admin app writes vehicle_id,
      // while older code read selected_vehicle_id (which is rarely set), so the
      // Linked Vehicle card was almost always empty. Coalesce the two below.
      const { data } = await supabase
        .from('finance_applications')
        .select('*, selected_vehicle:vehicles!finance_applications_selected_vehicle_id_fkey(*), linked_vehicle:vehicles!finance_applications_vehicle_id_fkey(*), deal_records(*)')
        .eq('id', id)
        .maybeSingle();

      if (data) {
        setClient(data);
        // Unified timeline: merge every scattered history source for this client.
        // client_audit_logs + leads.activity_log are keyed by email/phone;
        // status_history & deal_records are on the application; offers by app id.
        const filters: string[] = [];
        if (data.email) filters.push(`client_email.eq.${data.email}`);
        if (data.phone) filters.push(`client_phone.eq.${data.phone}`);
        const leadFilters: string[] = [];
        if (data.email) leadFilters.push(`client_email.eq.${data.email}`);
        if (data.phone) leadFilters.push(`client_phone.eq.${data.phone}`);

        const [logsRes, leadsRes, offersRes] = await Promise.all([
          filters.length
            ? supabase.from('client_audit_logs').select('*').or(filters.join(',')).order('created_at', { ascending: false }).limit(200)
            : Promise.resolve({ data: [] as any[] }),
          leadFilters.length
            ? supabase.from('leads').select('activity_log').or(leadFilters.join(','))
            : Promise.resolve({ data: [] as any[] }),
          supabase.from('finance_offers').select('id, bank_name, status, created_at').eq('application_id', id as string),
        ]);

        const leadActivity = (leadsRes.data || [])
          .flatMap((r: any) => Array.isArray(r.activity_log) ? r.activity_log : []);

        setTimeline(buildClientTimeline({
          auditLogs: logsRes.data || [],
          statusHistory: Array.isArray(data.status_history) ? data.status_history : [],
          leadActivity,
          offers: offersRes.data || [],
          dealRecords: data.deal_records || [],
          application: { created_at: data.created_at, status: data.status },
        }));
      }
      setLoading(false);
    };
    fetchClient();
  }, [id]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!client) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-muted-foreground">Client file not found.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Go Back
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const linkedVehicle = client.selected_vehicle || client.linked_vehicle;

  const statusColors: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    pre_approved: 'bg-yellow-500/20 text-yellow-400',
    contract_sent: 'bg-purple-500/20 text-purple-400',
    contract_signed: 'bg-emerald-500/20 text-emerald-400',
    vehicle_delivered: 'bg-amber-500/20 text-amber-400',
    declined: 'bg-destructive/20 text-destructive',
    declined_conditional: 'bg-gray-500/20 text-gray-300',
    lost: 'bg-zinc-800/50 text-zinc-500',
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>{client.full_name || 'Client'} | Profile</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* HEADER */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{client.first_name} {client.last_name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
              {client.id_number && <span>ID: {client.id_number}</span>}
              {client.id_number && <span>•</span>}
              <span>{client.email}</span>
              <span>•</span>
              <span>{client.phone}</span>
            </div>
          </div>
          <Badge className={`text-xs ${statusColors[client.status] || 'bg-muted text-muted-foreground'}`}>
            {client.status?.replace(/_/g, ' ').toUpperCase()}
          </Badge>
        </div>

        <Separator />

        {/* CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Vehicle */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Car className="w-4 h-4" /> Linked Vehicle
            </h3>
            {linkedVehicle ? (
              <div className="space-y-2">
                <p className="font-medium">
                  {linkedVehicle.year} {linkedVehicle.make} {linkedVehicle.model}
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>VIN: {linkedVehicle.vin || 'N/A'}</p>
                  <p>Reg: {linkedVehicle.registration_number || 'N/A'}</p>
                  {linkedVehicle.color && <p>Color: {linkedVehicle.color}</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No vehicle linked.</p>
            )}
          </Card>

          {/* CENTER: Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="history">
              <TabsList>
                <TabsTrigger value="history">
                  <History className="w-3.5 h-3.5 mr-1" /> History
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FileText className="w-3.5 h-3.5 mr-1" /> Documents
                </TabsTrigger>
                <TabsTrigger value="deal">
                  <User className="w-3.5 h-3.5 mr-1" /> Deal Info
                </TabsTrigger>
                <TabsTrigger value="juristic">
                  <Building2 className="w-3.5 h-3.5 mr-1" /> Juristic
                </TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-4">
                <Card className="p-5">
                  <p className="text-xs text-muted-foreground mb-4">
                    Unified history — notes, calls, reminders, status changes, bank offers and deal events.
                  </p>
                  <ClientTimeline items={timeline} />
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <Card className="p-5 space-y-5">
                  <DocumentManager
                    title="Client documents"
                    description="ID, driver's licence, proof of address, payslips, bank statements."
                    category="client"
                    clientId={client.user_id || undefined}
                    applicationId={client.id}
                  />
                  <DocumentManager
                    title="Vehicle documents"
                    description="DEKRA, NATIS/registration, roadworthy, service history — per vehicle."
                    category="vehicle"
                    clientId={client.user_id || undefined}
                    applicationId={client.id}
                    vehicleId={client.selected_vehicle_id || client.vehicle_id || undefined}
                  />
                  <DocumentManager
                    title="Deal & contracts"
                    description="Signed contracts, invoices, delivery and handover paperwork."
                    category="deal"
                    clientId={client.user_id || undefined}
                    applicationId={client.id}
                  />
                </Card>
              </TabsContent>

              <TabsContent value="deal" className="mt-4">
                <Card className="p-5 space-y-3">
                  {client.deal_records && client.deal_records.length > 0 ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sold Price</span>
                        <span className="font-medium">R {client.deal_records[0].sold_price?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deposit</span>
                        <span className="font-medium">R {client.deal_records[0].client_deposit?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sale Date</span>
                        <span className="font-medium">
                          {client.deal_records[0].sale_date
                            ? new Date(client.deal_records[0].sale_date).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No deal records yet.</p>
                  )}
                  {client.deal_records && client.deal_records.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateInvoice}
                      disabled={generatingInvoice}
                      className="w-full mt-2"
                    >
                      {generatingInvoice ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
                      Generate Invoice (PDF)
                    </Button>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="juristic" className="mt-4">
                <JuristicPanel applicationId={client.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ClientProfile;
