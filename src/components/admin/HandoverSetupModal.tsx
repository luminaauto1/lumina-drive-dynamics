import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, Copy, Gift } from "lucide-react";
import { toast } from "sonner";

export const HandoverSetupModal = ({ dealId, currentPhotos = [] }: { dealId: string; currentPhotos?: string[] }) => {
  const [photos, setPhotos] = useState<string[]>(currentPhotos);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);

    const newUrls: string[] = [];
    for (const file of Array.from(e.target.files)) {
      const fileName = `${dealId}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('delivery-photos').upload(fileName, file);
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('delivery-photos').getPublicUrl(fileName);
        newUrls.push(urlData.publicUrl);
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

  const copyLink = () => {
    const url = `https://luminaauto.co.za/handover/${dealId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied! Send this to the client.");
    setTimeout(() => setCopied(false), 2000);
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
                <img key={i} src={url} alt={`Delivery ${i + 1}`} className="w-full h-20 object-cover rounded-md" />
              ))}
            </div>
          )}

          {/* LINK GENERATOR */}
          <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-800">
            <div className="min-w-0 mr-3">
              <p className="text-xs font-semibold text-emerald-500">Handover Link Ready</p>
              <p className="text-xs text-muted-foreground truncate">
                https://luminaauto.co.za/handover/{dealId}
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
