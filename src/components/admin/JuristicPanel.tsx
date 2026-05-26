import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, FileText, Link as LinkIcon, Loader2, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Props { applicationId?: string }

const BANKS = [
  { key: "juristic", label: "Standard Bank Suite" },
  { key: "fic",      label: "FIC Declaration"     },
  { key: "absa",     label: "Absa Profile"        },
  { key: "mfc_ubo",  label: "MFC Profile"         },
  { key: "wesbank",  label: "WesBank Profile"     },
] as const;

const JuristicPanel = ({ applicationId }: Props) => {
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("juristic_submissions").select("*").order("created_at", { ascending: false }).limit(1);
    if (applicationId) q = q.eq("application_id", applicationId) as any;
    const { data } = await q;
    setSub(data?.[0] ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [applicationId]);

  const create = async () => {
    setBusy("create");
    const { data, error } = await supabase
      .from("juristic_submissions")
      .insert({ application_id: applicationId ?? null, status: "draft" })
      .select()
      .maybeSingle();
    setBusy(null);
    if (error) return toast.error(error.message);
    setSub(data);
    toast.success("Capture link created");
  };

  const link = sub ? `${window.location.origin}/juristic/${sub.access_token}` : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Link copied");
  };

  const generate = async (bank: string, label: string) => {
    if (!sub) return;
    setBusy(bank);
    try {
      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/generate-juristic-pdf`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ submission_id: sub.id, bank }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      const u = URL.createObjectURL(blob);
      a.href = u;
      a.download = `${sub.company_name ?? "juristic"}_${bank}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(u);
      toast.success(`${label} ready`);
    } catch (e: any) {
      toast.error("Generation failed: " + e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <Card className="p-5 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></Card>;
  }

  if (!sub) {
    return (
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Juristic / Commercial Asset Finance</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Create a secure capture session for the client. They complete it on mobile (no printing) and
          we auto-populate every bank's juristic, FIC, and UBO documents.
        </p>
        <Button size="sm" onClick={create} disabled={busy === "create"} className="w-full">
          {busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1" /> Create Capture Session</>}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Juristic Capture</h3>
        </div>
        <Badge variant={sub.status === "submitted" ? "default" : "outline"} className="text-[10px]">
          {sub.status}
        </Badge>
      </div>

      {/* Capture link */}
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <LinkIcon className="w-3 h-3" /> Client capture link
        </p>
        <div className="flex gap-2">
          <input readOnly value={link} className="flex-1 text-xs px-2 py-1.5 rounded border border-border bg-muted/30 font-mono" />
          <Button size="sm" variant="outline" onClick={copyLink}><Copy className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="outline" asChild><a href={link} target="_blank" rel="noreferrer">Open</a></Button>
        </div>
      </div>

      {sub.company_name && (
        <div className="text-xs text-muted-foreground space-y-0.5 border-l-2 border-border pl-3">
          <p><span className="text-foreground font-medium">{sub.company_name}</span> · {sub.registration_number ?? "—"}</p>
          <p>{sub.entity_type ?? "—"} · {(sub.associated_parties as any[])?.length ?? 0} parties</p>
        </div>
      )}

      {/* Bank Document Generation */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <FileText className="w-3 h-3" /> Bank Document Generation
        </p>
        {sub.status !== "submitted" && (
          <p className="text-[11px] text-amber-500">Capture not yet submitted — downloads will use whatever has been saved so far.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BANKS.map(b => (
            <Button key={b.key} size="sm" variant="outline" disabled={busy === b.key}
              onClick={() => generate(b.key, b.label)} className="justify-start">
              {busy === b.key ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-2" />}
              {b.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default JuristicPanel;
