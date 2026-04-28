import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, Copy, Gift, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { APP_DOMAIN } from "@/lib/appConfig";

interface HandoverSetupModalProps {
  dealId: string;
  currentPhotos?: string[];
  clientName?: string;
  applicationId?: string;
  firstName?: string;
  lastName?: string;
}

export const HandoverSetupModal = ({ dealId, currentPhotos = [], clientName = '', applicationId, firstName = '', lastName = '' }: HandoverSetupModalProps) => {
  const [photos, setPhotos] = useState<string[]>(currentPhotos);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nameFormat, setNameFormat] = useState('full');
  const [customName, setCustomName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const getDisplayName = () => {
    if (nameFormat === 'first') return firstName || '';
    if (nameFormat === 'full') return `${firstName || ''} ${lastName || ''}`.trim();
    if (nameFormat === 'last') return `Mr/Ms ${lastName || ''}`;
    return customName;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);

    const newUrls: string[] = [];
    for (const file of Array.from(e.target.files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${dealId}/${Date.now()}-${safeName}`;
      const { data, error } = await supabase.storage.from('delivery-photos').upload(fileName, file);
      if (!error && data) {
        // Store the storage path; signed URLs are generated on demand for the public handover page
        newUrls.push(fileName);
      }
    }

    if (newUrls.length > 0) {
      const updatedPhotos = [...photos, ...newUrls];
      await (supabase as any).from('deal_records').update({ delivery_photos: updatedPhotos }).eq('id', dealId);
      setPhotos(updatedPhotos);
      toast.success(`${newUrls.length} photo(s) uploaded`);
    }
    setUploading(false);
  };

  const handleSaveHandoverConfig = async () => {
    if (!applicationId) {
      toast.error("No linked application found for this deal");
      return;
    }
    setIsSaving(true);
    const finalName = getDisplayName();

    const { error } = await supabase
      .from('finance_applications')
      .update({ handover_name: finalName } as any)
      .eq('id', applicationId);

    setIsSaving(false);
    if (error) {
      toast.error("Failed to save handover configuration");
    } else {
      toast.success(`Handover name saved: "${finalName}"`);
    }
  };

  const copyLink = async () => {
    const url = `${APP_DOMAIN}/handover/${dealId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Handover link copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link.");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-green-500 hover:text-green-400 hover:bg-green-500/10" title="Setup Handover">
          <Gift className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Digital Handover Setup</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* UPLOAD AREA */}
          <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center">
            {uploading ? <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> : <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />}
            <p className="text-sm text-muted-foreground mb-3">Click to upload delivery photos</p>
            <input
              id="photo-upload"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('photo-upload')?.click()}
              disabled={uploading}
            >
              Select Photos
            </Button>
          </div>

          {/* PREVIEW */}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt={`Delivery ${i + 1}`} className="w-full h-20 object-cover rounded-md" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs px-2 py-1 h-auto"
                      onClick={async () => {
                        const updatedPhotos = photos.filter((_, idx) => idx !== i);
                        const { error } = await (supabase as any).from('deal_records').update({ delivery_photos: updatedPhotos }).eq('id', dealId);
                        if (error) {
                          console.error("Error removing photo:", error);
                          toast.error("Failed to remove photo.");
                          return;
                        }
                        setPhotos(updatedPhotos);
                        toast.success("Photo removed.");
                      }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* HANDOVER NAME CONFIGURATION */}
          <div className="space-y-3 p-4 bg-black/20 border border-white/10 rounded-md">
            <h3 className="text-sm font-medium text-zinc-200">Handover Display Name</h3>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Select Display Name Format</Label>
              <Select value={nameFormat} onValueChange={setNameFormat}>
                <SelectTrigger className="w-full bg-black/50 border-white/10 text-sm h-9">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10">
                  <SelectItem value="first" className="text-xs">First Name Only ({firstName || '—'})</SelectItem>
                  <SelectItem value="full" className="text-xs">Full Name ({firstName} {lastName})</SelectItem>
                  <SelectItem value="last" className="text-xs">Surname (Mr/Ms {lastName || '—'})</SelectItem>
                  <SelectItem value="custom" className="text-xs">Custom (e.g., Mr. & Mrs. Smith)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {nameFormat === 'custom' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Enter Custom Name</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="bg-black/50 border-white/10 h-9 text-sm focus:border-primary"
                  placeholder="e.g., Mr. & Mrs. Smith"
                />
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              Preview: <span className="text-emerald-400 font-medium">Congratulations, {getDisplayName() || '...'}</span>
            </p>

            <Button
              onClick={handleSaveHandoverConfig}
              disabled={isSaving || (nameFormat === 'custom' && !customName) || !applicationId}
              size="sm"
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10"
            >
              <Save className="w-3 h-3 mr-1.5" />
              {isSaving ? 'Saving...' : 'Save Name to Database'}
            </Button>
          </div>

          {/* LINK GENERATOR */}
          <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-800">
            <div className="min-w-0 mr-3">
              <p className="text-xs font-semibold text-emerald-500">Handover Link Ready</p>
              <p className="text-xs text-muted-foreground truncate">
                {APP_DOMAIN}/handover/{dealId}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={copyLink}>
              <Copy className="w-3 h-3 mr-1" />
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
