import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SignaturePad from "@/components/SignaturePad";
import { Loader2, Plus, Trash2, Building2, Users, PenLine, Check } from "lucide-react";
import { toast } from "sonner";

type Party = {
  full_name: string;
  id_number: string;
  designation: string;
  shareholding_percent: string;
  is_public_official?: boolean;
};

const STEPS = [
  { id: 1, label: "Business",  icon: Building2 },
  { id: 2, label: "Ownership", icon: Users },
  { id: 3, label: "Signature", icon: PenLine },
];

const norm = (v: string) => v.replace(/\s+/g, "").trim();
const normDigits = (v: string) => v.replace(/\D/g, "");

const JuristicCapture = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);
  const [id, setId] = useState<string | null>(null);

  // form state
  const [biz, setBiz] = useState({
    company_name: "", trading_name: "", registration_number: "",
    entity_type: "", tax_number: "", vat_number: "",
    nature_of_business: "", registered_address: "", postal_address: "",
    registered_office: "", years_in_business: "",
    contact_phone: "", contact_email: "",
  });
  const [parties, setParties] = useState<Party[]>([
    { full_name: "", id_number: "", designation: "Director", shareholding_percent: "" },
  ]);
  const [sig, setSig] = useState<string | undefined>();
  const [signer, setSigner] = useState({ full_name: "", capacity: "Director", signed_at: "" });
  const [popia, setPopia] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data } = await supabase
        .from("juristic_submissions")
        .select("*")
        .eq("access_token", token)
        .maybeSingle();
      if (data) {
        setId(data.id);
        setSubmitted(data.status === "submitted");
        setBiz({
          company_name: data.company_name ?? "",
          trading_name: data.trading_name ?? "",
          registration_number: data.registration_number ?? "",
          entity_type: data.entity_type ?? "",
          tax_number: data.tax_number ?? "",
          vat_number: data.vat_number ?? "",
          nature_of_business: data.nature_of_business ?? "",
          registered_address: data.registered_address ?? "",
          postal_address: data.postal_address ?? "",
          registered_office: data.registered_office ?? "",
          years_in_business: data.years_in_business ?? "",
          contact_phone: data.contact_phone ?? "",
          contact_email: data.contact_email ?? "",
        });
        if (Array.isArray(data.associated_parties) && data.associated_parties.length) {
          setParties(data.associated_parties as unknown as Party[]);
        }
        setSig(data.signature_image_url ?? undefined);
        setSigner({
          full_name: data.signer_full_name ?? "",
          capacity: data.signer_capacity ?? "Director",
          signed_at: data.signed_at ?? "",
        });
        setPopia(!!data.popia_consent_accepted);
      }
      setLoading(false);
    })();
  }, [token]);

  const payload = useMemo(() => ({
    company_name: biz.company_name.trim(),
    trading_name: biz.trading_name.trim() || null,
    registration_number: norm(biz.registration_number),
    entity_type: biz.entity_type,
    tax_number: normDigits(biz.tax_number),
    vat_number: biz.vat_number ? normDigits(biz.vat_number) : null,
    nature_of_business: biz.nature_of_business.trim(),
    registered_address: biz.registered_address.trim(),
    postal_address: biz.postal_address.trim() || biz.registered_address.trim(),
    registered_office: biz.registered_office.trim() || null,
    years_in_business: biz.years_in_business || null,
    contact_phone: normDigits(biz.contact_phone),
    contact_email: biz.contact_email.trim().toLowerCase(),
    associated_parties: parties.map(p => ({
      full_name: p.full_name.trim(),
      id_number: normDigits(p.id_number),
      designation: p.designation,
      shareholding_percent: p.shareholding_percent,
      is_public_official: !!p.is_public_official,
    })),
    public_official_status: {
      any_public_official: parties.some(p => p.is_public_official),
    },
    signer_full_name: signer.full_name.trim(),
    signer_capacity: signer.capacity,
    signed_at: signer.signed_at.trim() || null,
  }), [biz, parties, signer]);

  const save = async (extra: Record<string, any> = {}) => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase
      .from("juristic_submissions")
      .update({ ...payload, ...extra })
      .eq("id", id);
    setSaving(false);
    if (error) toast.error("Save failed: " + error.message);
  };

  const next = async () => { await save(); setStep(s => Math.min(3, s + 1)); };
  const back = () => setStep(s => Math.max(1, s - 1));

  const submit = async () => {
    if (!id) return;
    if (!sig) return toast.error("Please capture your signature.");
    if (!popia) return toast.error("Please accept POPIA consent.");
    if (!signer.full_name.trim()) return toast.error("Signer full name required.");
    setSubmitting(true);

    // Upload signature PNG to bucket
    let sigPath = sig;
    if (sig.startsWith("data:image/")) {
      const blob = await (await fetch(sig)).blob();
      const path = `${id}/signature.png`;
      const up = await supabase.storage
        .from("juristic-signatures").upload(path, blob, { upsert: true, contentType: "image/png" });
      if (up.error) {
        toast.error("Signature upload failed: " + up.error.message);
        setSubmitting(false); return;
      }
      sigPath = path;
    }

    const { error } = await supabase
      .from("juristic_submissions")
      .update({
        ...payload,
        signature_image_url: sigPath,
        popia_consent_accepted: true,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", id);

    setSubmitting(false);
    if (error) return toast.error("Submission failed: " + error.message);
    setSubmitted(true);
    toast.success("Submission received.");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white/70 p-6 text-center">
        Invalid or expired link.
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <Card className="bg-white/[0.03] border-white/10 backdrop-blur-xl p-8 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/30 mx-auto flex items-center justify-center mb-4">
            <Check className="w-7 h-7 text-emerald-300" />
          </div>
          <h1 className="text-xl font-light text-white mb-2">Submission received</h1>
          <p className="text-sm text-white/60">
            Lumina Auto F&amp;I will compile your bank documents shortly. You may close this window.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <header className="mb-6">
          <p className="text-[10px] tracking-[0.3em] text-white/40 uppercase">Lumina Auto · F&amp;I</p>
          <h1 className="text-2xl font-light mt-1">Juristic Application</h1>
          <p className="text-sm text-white/50">Complete on mobile — no printing required.</p>
        </header>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map(s => (
            <div key={s.id} className="flex-1">
              <div className={`h-1 rounded-full ${step >= s.id ? "bg-white" : "bg-white/10"}`} />
              <div className={`text-[10px] mt-2 tracking-wide ${step >= s.id ? "text-white" : "text-white/40"}`}>
                {String(s.id).padStart(2, "0")} · {s.label}
              </div>
            </div>
          ))}
        </div>

        <Card className="bg-white/[0.03] border-white/10 backdrop-blur-xl p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-widest text-white/60">Business Profile</h2>
              <Field label="Registered Company Name *">
                <Input value={biz.company_name} onChange={e => setBiz({ ...biz, company_name: e.target.value })} className="bg-black/40 border-white/10" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Trading Name">
                  <Input value={biz.trading_name} onChange={e => setBiz({ ...biz, trading_name: e.target.value })} className="bg-black/40 border-white/10" />
                </Field>
                <Field label="Entity Type *">
                  <Select value={biz.entity_type} onValueChange={v => setBiz({ ...biz, entity_type: v })}>
                    <SelectTrigger className="bg-black/40 border-white/10"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pty Ltd">(Pty) Ltd</SelectItem>
                      <SelectItem value="CC">CC</SelectItem>
                      <SelectItem value="Trust">Trust</SelectItem>
                      <SelectItem value="Partnership">Partnership</SelectItem>
                      <SelectItem value="Sole Proprietor">Sole Proprietor</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Registration Number *">
                  <Input value={biz.registration_number} onChange={e => setBiz({ ...biz, registration_number: e.target.value })} className="bg-black/40 border-white/10" placeholder="YYYY/NNNNNN/NN" />
                </Field>
                <Field label="Income Tax Number *">
                  <Input value={biz.tax_number} onChange={e => setBiz({ ...biz, tax_number: e.target.value })} className="bg-black/40 border-white/10" />
                </Field>
              </div>
              <Field label="VAT Number (if registered)">
                <Input value={biz.vat_number} onChange={e => setBiz({ ...biz, vat_number: e.target.value })} className="bg-black/40 border-white/10" />
              </Field>
              <Field label="Nature of Business *">
                <Input value={biz.nature_of_business} onChange={e => setBiz({ ...biz, nature_of_business: e.target.value })} className="bg-black/40 border-white/10" />
              </Field>
              <Field label="Registered Physical Address *">
                <Textarea rows={2} value={biz.registered_address} onChange={e => setBiz({ ...biz, registered_address: e.target.value })} className="bg-black/40 border-white/10" />
              </Field>
              <Field label="Postal Address (if different)">
                <Textarea rows={2} value={biz.postal_address} onChange={e => setBiz({ ...biz, postal_address: e.target.value })} className="bg-black/40 border-white/10" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Registered Office">
                  <Input value={biz.registered_office} onChange={e => setBiz({ ...biz, registered_office: e.target.value })} className="bg-black/40 border-white/10" placeholder="e.g. 123 Main St, Johannesburg" />
                </Field>
                <Field label="Years in Business">
                  <Input type="number" min="0" value={biz.years_in_business} onChange={e => setBiz({ ...biz, years_in_business: e.target.value })} className="bg-black/40 border-white/10" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact Phone *">
                  <Input value={biz.contact_phone} onChange={e => setBiz({ ...biz, contact_phone: e.target.value })} className="bg-black/40 border-white/10" />
                </Field>
                <Field label="Contact Email *">
                  <Input type="email" value={biz.contact_email} onChange={e => setBiz({ ...biz, contact_email: e.target.value })} className="bg-black/40 border-white/10" />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm uppercase tracking-widest text-white/60">Ownership & Control</h2>
                <Button type="button" size="sm" variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10"
                  onClick={() => setParties([...parties, { full_name: "", id_number: "", designation: "Director", shareholding_percent: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Party
                </Button>
              </div>
              <p className="text-xs text-white/50">List directors, trustees, shareholders ≥25%, and ultimate beneficial owners.</p>
              {parties.map((p, i) => (
                <div key={i} className="p-3 rounded-lg border border-white/10 bg-black/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-widest text-white/40">Party {i + 1}</span>
                    {parties.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-white/50 hover:text-red-400"
                        onClick={() => setParties(parties.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Full names" value={p.full_name}
                      onChange={e => setParties(parties.map((x, j) => j === i ? { ...x, full_name: e.target.value } : x))}
                      className="bg-black/40 border-white/10" />
                    <Input placeholder="ID / Passport No." value={p.id_number}
                      onChange={e => setParties(parties.map((x, j) => j === i ? { ...x, id_number: e.target.value } : x))}
                      className="bg-black/40 border-white/10" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={p.designation}
                      onValueChange={v => setParties(parties.map((x, j) => j === i ? { ...x, designation: v } : x))}>
                      <SelectTrigger className="bg-black/40 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Director","Member","Trustee","Partner","Shareholder","UBO"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input placeholder="% Shareholding" value={p.shareholding_percent}
                      onChange={e => setParties(parties.map((x, j) => j === i ? { ...x, shareholding_percent: e.target.value } : x))}
                      className="bg-black/40 border-white/10" />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white/60">
                    <Checkbox checked={!!p.is_public_official}
                      onCheckedChange={c => setParties(parties.map((x, j) => j === i ? { ...x, is_public_official: !!c } : x))} />
                    Politically exposed / public official (FICA)
                  </label>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-widest text-white/60">Digital Signature</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Signer Full Name *"><Input value={signer.full_name} onChange={e => setSigner({ ...signer, full_name: e.target.value })} className="bg-black/40 border-white/10" /></Field>
                <Field label="Capacity">
                  <Select value={signer.capacity} onValueChange={v => setSigner({ ...signer, capacity: v })}>
                    <SelectTrigger className="bg-black/40 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Director","Trustee","Member","Partner","Authorised Signatory"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Place of Signature">
                <Input value={signer.signed_at} onChange={e => setSigner({ ...signer, signed_at: e.target.value })} className="bg-black/40 border-white/10" placeholder="e.g. Pretoria" />
              </Field>
              <div>
                <Label className="text-xs text-white/60 mb-2 block">Signature</Label>
                <SignaturePad existingSignature={sig} onSave={setSig} />
              </div>
              <label className="flex items-start gap-2 text-xs text-white/70">
                <Checkbox checked={popia} onCheckedChange={c => setPopia(!!c)} className="mt-0.5" />
                <span>
                  I consent to Lumina Auto and the receiving credit providers processing the above
                  juristic, beneficial-ownership, and personal information in terms of POPIA and FICA
                  for the purpose of credit assessment and asset finance origination.
                </span>
              </label>
            </div>
          )}

          <div className="flex justify-between mt-6 gap-2">
            <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" disabled={step === 1} onClick={back}>
              Back
            </Button>
            {step < 3 ? (
              <Button onClick={next} disabled={saving} className="bg-white text-black hover:bg-white/90">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting} className="bg-emerald-400 text-black hover:bg-emerald-300">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Securely"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] uppercase tracking-widest text-white/50">{label}</Label>
    {children}
  </div>
);

export default JuristicCapture;
