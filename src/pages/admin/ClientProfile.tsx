import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User, Car, FileText, History, Loader2, Building2, Gift } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import JuristicPanel from "@/components/admin/JuristicPanel";
import DocumentManager from "@/components/admin/DocumentManager";
import ClientTimeline from "@/components/admin/ClientTimeline";
import { buildClientTimeline, TimelineItem } from "@/lib/clientTimeline";
import { useDocumentSettings, consumeInvoiceNumber } from "@/hooks/useDocumentSettings";
import { generateInvoicePDF } from "@/lib/generateInvoicePDF";
import { normalizeEmail, normalizePhone } from "@/lib/normalizeContact";
import { toast } from "sonner";

const VEHICLE_JOIN =
  '*, selected_vehicle:vehicles!finance_applications_selected_vehicle_id_fkey(*), linked_vehicle:vehicles!finance_applications_vehicle_id_fkey(*), deal_records(*)';

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  pre_approved: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-emerald-500/20 text-emerald-400',
  contract_sent: 'bg-purple-500/20 text-purple-400',
  contract_signed: 'bg-emerald-500/20 text-emerald-400',
  finalized: 'bg-emerald-600/20 text-emerald-300',
  vehicle_delivered: 'bg-amber-500/20 text-amber-400',
  declined: 'bg-destructive/20 text-destructive',
  declined_conditional: 'bg-muted text-muted-foreground',
  lost: 'bg-muted/50 text-muted-foreground',
};

const vehicleOf = (app: any) => app?.selected_vehicle || app?.linked_vehicle || null;
const vehicleLabel = (v: any) => (v ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() : '');

const ClientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // All finance applications belonging to this PERSON (same email/phone). The
  // person is one profile; each application = one car/deal kept separate.
  const [apps, setApps] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(id);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const { data: docSettings } = useDocumentSettings();

  // The application currently in focus for the per-deal tabs (Documents/Deal/Juristic).
  const activeApp = apps.find((a) => a.id === selectedId) || apps[0] || null;
  // Primary identity record (the one opened from the link, falls back to first).
  const person = apps.find((a) => a.id === id) || apps[0] || null;

  const handleGenerateInvoice = async (app: any) => {
    const deal = app?.deal_records?.[0];
    if (!deal || !docSettings) {
      toast.error('No finalized deal to invoice yet.');
      return;
    }
    setGeneratingId(app.id);
    try {
      const v = vehicleOf(app);
      const label = vehicleLabel(v) || 'Vehicle';
      const lineItems = [{ description: `Vehicle: ${label}`, amount: Number(deal.sold_price || 0) }];
      const addons = Array.isArray(deal.addons_data) ? deal.addons_data : [];
      addons.forEach((a: any) => {
        const price = Number(a?.price || 0);
        if (price > 0) lineItems.push({ description: a?.name || 'Add-on', amount: price });
      });
      const invoiceNumber = await consumeInvoiceNumber(docSettings);
      generateInvoicePDF({
        invoiceNumber,
        date: new Date(deal.sale_date || deal.created_at || Date.now()).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }),
        clientName: `${app.first_name || ''} ${app.last_name || ''}`.trim() || app.full_name || 'Client',
        idNumber: app.id_number || undefined,
        address: [app.street_address, app.area_code].filter(Boolean).join(', ') || undefined,
        email: app.email || undefined,
        phone: app.phone || undefined,
        vehicleLabel: label,
        vin: v?.vin || undefined,
        reg: v?.registration_number || undefined,
        lineItems,
      }, docSettings);
      toast.success(`Invoice ${invoiceNumber} generated`);
    } catch (e: any) {
      toast.error('Invoice generation failed: ' + e.message);
    } finally {
      setGeneratingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      // 1. Load the application opened from the link to learn WHO this is.
      const { data: primary } = await supabase
        .from('finance_applications').select(VEHICLE_JOIN).eq('id', id).maybeSingle();

      if (!primary) { if (!cancelled) { setApps([]); setLoading(false); } return; }

      const email = primary.email as string | null;
      const phone = primary.phone as string | null;

      // 2. Load EVERY application for this same person (by email/phone). This is
      //    visual aggregation only — records stay separate in the database.
      const appOrs: string[] = [];
      if (email) appOrs.push(`email.ilike.${email}`);
      if (phone) appOrs.push(`phone.ilike.${phone}`);
      const { data: matches } = appOrs.length
        ? await supabase.from('finance_applications').select(VEHICLE_JOIN).or(appOrs.join(','))
        : { data: [primary] as any[] };

      // Dedupe by id; make sure the primary is present; then keep only rows that
      // truly belong to this person (normalized email/phone match) to avoid any
      // accidental over-matching.
      const pEmail = normalizeEmail(email);
      const pPhone = normalizePhone(phone);
      const byId = new Map<string, any>();
      for (const a of [primary, ...(matches || [])]) {
        if (!a) continue;
        const sameEmail = pEmail && normalizeEmail(a.email) === pEmail;
        const samePhone = pPhone && normalizePhone(a.phone) === pPhone;
        if (a.id === primary.id || sameEmail || samePhone) byId.set(a.id, a);
      }
      const allApps = [...byId.values()].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );

      // 3. Referrals THIS person made (matched by referrer email/phone). Best-effort.
      let refs: any[] = [];
      try {
        const refOrs: string[] = [];
        if (email) refOrs.push(`referrer_email.ilike.${email}`);
        if (phone) refOrs.push(`referrer_phone.ilike.${phone}`);
        if (refOrs.length) {
          // `referrals` may not be in the generated types — cast to keep TS happy.
          const { data: r } = await (supabase as any).from('referrals').select('*').or(refOrs.join(',')).order('created_at', { ascending: false });
          refs = r || [];
        }
      } catch { /* referrals table optional */ }

      // 4. Unified timeline across ALL of the person's applications.
      const appIds = allApps.map((a) => a.id);
      const tlFilters: string[] = [];
      if (email) tlFilters.push(`client_email.eq.${email}`);
      if (phone) tlFilters.push(`client_phone.eq.${phone}`);
      const [logsRes, leadsRes, offersRes] = await Promise.all([
        tlFilters.length
          ? supabase.from('client_audit_logs').select('*').or(tlFilters.join(',')).order('created_at', { ascending: false }).limit(300)
          : Promise.resolve({ data: [] as any[] }),
        tlFilters.length
          ? supabase.from('leads').select('activity_log').or(tlFilters.join(','))
          : Promise.resolve({ data: [] as any[] }),
        appIds.length
          ? supabase.from('finance_offers').select('id, bank_name, status, created_at, application_id').in('application_id', appIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const leadActivity = (leadsRes.data || []).flatMap((r: any) => Array.isArray(r.activity_log) ? r.activity_log : []);
      const statusHistory = allApps.flatMap((a) => Array.isArray(a.status_history) ? a.status_history : []);
      const dealRecords = allApps.flatMap((a) => a.deal_records || []);

      const tl = buildClientTimeline({
        auditLogs: logsRes.data || [],
        statusHistory,
        leadActivity,
        offers: offersRes.data || [],
        dealRecords,
        application: { created_at: primary.created_at, status: primary.status },
      });

      if (!cancelled) {
        setApps(allApps);
        setReferrals(refs);
        setSelectedId(id);
        setTimeline(tl);
        setLoading(false);
      }
    };
    fetchAll();
    return () => { cancelled = true; };
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

  if (!person) {
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

  const multi = apps.length > 1;

  return (
    <AdminLayout>
      <Helmet>
        <title>{person.full_name || 'Client'} | Profile</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* HEADER — one person, regardless of how many cars/deals they have. */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{person.first_name} {person.last_name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
              {person.id_number && <span>ID: {person.id_number}</span>}
              {person.id_number && <span>•</span>}
              <span>{person.email}</span>
              <span>•</span>
              <span>{person.phone}</span>
            </div>
          </div>
          {multi && (
            <Badge variant="outline" className="text-xs">
              {apps.length} applications
            </Badge>
          )}
        </div>

        <Separator />

        {/* CARS & APPLICATIONS — every car/deal this person has, kept separate. */}
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Car className="w-4 h-4" /> Cars & Applications {multi && <span className="text-muted-foreground font-normal">({apps.length})</span>}
          </h3>
          <div className="space-y-2">
            {apps.map((app) => {
              const v = vehicleOf(app);
              const deal = app.deal_records?.[0];
              const isActive = app.id === activeApp?.id;
              return (
                <div
                  key={app.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(app.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(app.id);
                    }
                  }}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{vehicleLabel(v) || 'No vehicle linked'}</p>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                        {v?.registration_number && <span>Reg: {v.registration_number}</span>}
                        {v?.vin && <span>VIN: {v.vin}</span>}
                        {deal?.sold_price != null && <span>Sold: R {Number(deal.sold_price).toLocaleString()}</span>}
                        {deal?.sale_date && <span>{new Date(deal.sale_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs ${statusColors[app.status] || 'bg-muted text-muted-foreground'}`}>
                        {app.status?.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                      {deal && (
                        <Button
                          variant="outline" size="sm"
                          onClick={(e) => { e.stopPropagation(); handleGenerateInvoice(app); }}
                          disabled={generatingId === app.id}
                        >
                          {generatingId === app.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
                          Invoice
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* REFERRALS this person made. */}
        {referrals.length > 0 && (
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Gift className="w-4 h-4" /> Referrals made <span className="text-muted-foreground font-normal">({referrals.length})</span>
            </h3>
            <div className="space-y-2">
              {referrals.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm">{r.referee_name || 'Referred contact'}</p>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                      {r.referee_phone && <span>{r.referee_phone}</span>}
                      {r.referee_email && <span>{r.referee_email}</span>}
                      {r.created_at && <span>{new Date(r.created_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {r.status && <Badge variant="outline" className="text-xs shrink-0">{String(r.status)}</Badge>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* CONTENT — per-application detail (the selected car) + unified history. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: selected vehicle */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Car className="w-4 h-4" /> {multi ? 'Selected vehicle' : 'Linked Vehicle'}
            </h3>
            {(() => {
              const v = vehicleOf(activeApp);
              return v ? (
                <div className="space-y-2">
                  <p className="font-medium">{v.year} {v.make} {v.model}</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>VIN: {v.vin || 'N/A'}</p>
                    <p>Reg: {v.registration_number || 'N/A'}</p>
                    {v.color && <p>Color: {v.color}</p>}
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">No vehicle linked.</p>;
            })()}
          </Card>

          {/* CENTER: Tabs (History is unified; the rest follow the selected car) */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="history">
              <TabsList>
                <TabsTrigger value="history"><History className="w-3.5 h-3.5 mr-1" /> History</TabsTrigger>
                <TabsTrigger value="documents"><FileText className="w-3.5 h-3.5 mr-1" /> Documents</TabsTrigger>
                <TabsTrigger value="deal"><User className="w-3.5 h-3.5 mr-1" /> Deal Info</TabsTrigger>
                <TabsTrigger value="juristic"><Building2 className="w-3.5 h-3.5 mr-1" /> Juristic</TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-4">
                <Card className="p-5">
                  <p className="text-xs text-muted-foreground mb-4">
                    Unified history across {multi ? 'all this client’s applications' : 'this client'} — notes, calls, reminders, status changes, bank offers and deal events.
                  </p>
                  <ClientTimeline items={timeline} />
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                {multi && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Showing documents for the selected car ({vehicleLabel(vehicleOf(activeApp)) || 'application'}). Pick another above to switch.
                  </p>
                )}
                <Card className="p-5 space-y-5">
                  <DocumentManager
                    title="Client documents"
                    description="ID, driver's licence, proof of address, payslips, bank statements."
                    category="client"
                    clientId={activeApp?.user_id || undefined}
                    applicationId={activeApp?.id}
                  />
                  <DocumentManager
                    title="Vehicle documents"
                    description="DEKRA, NATIS/registration, roadworthy, service history — per vehicle."
                    category="vehicle"
                    clientId={activeApp?.user_id || undefined}
                    applicationId={activeApp?.id}
                    vehicleId={activeApp?.selected_vehicle_id || activeApp?.vehicle_id || undefined}
                  />
                  <DocumentManager
                    title="Deal & contracts"
                    description="Signed contracts, invoices, delivery and handover paperwork."
                    category="deal"
                    clientId={activeApp?.user_id || undefined}
                    applicationId={activeApp?.id}
                  />
                </Card>
              </TabsContent>

              <TabsContent value="deal" className="mt-4">
                <Card className="p-5 space-y-3">
                  {multi && (
                    <p className="text-xs text-muted-foreground">
                      Deal for the selected car ({vehicleLabel(vehicleOf(activeApp)) || 'application'}).
                    </p>
                  )}
                  {activeApp?.deal_records && activeApp.deal_records.length > 0 ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sold Price</span>
                        <span className="font-medium">R {activeApp.deal_records[0].sold_price?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deposit</span>
                        <span className="font-medium">R {activeApp.deal_records[0].client_deposit?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sale Date</span>
                        <span className="font-medium">
                          {activeApp.deal_records[0].sale_date ? new Date(activeApp.deal_records[0].sale_date).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No deal records yet.</p>
                  )}
                  {activeApp?.deal_records && activeApp.deal_records.length > 0 && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => handleGenerateInvoice(activeApp)}
                      disabled={generatingId === activeApp.id}
                      className="w-full mt-2"
                    >
                      {generatingId === activeApp.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
                      Generate Invoice (PDF)
                    </Button>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="juristic" className="mt-4">
                <JuristicPanel applicationId={activeApp?.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ClientProfile;
