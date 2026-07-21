import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Gift } from "lucide-react";
import { HandoverPanel, type HandoverPanelProps } from "@/components/admin/HandoverPanel";

/**
 * Row-action wrapper around HandoverPanel (Deal Ledger). The Deal Desk drawer
 * renders the same panel inline in its Handover tab, so delivery-only roles
 * reach it without the ledger.
 */
export const HandoverSetupModal = (props: HandoverPanelProps) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button size="sm" variant="ghost" className="text-green-500 hover:text-green-400 hover:bg-green-500/10" title="Setup Handover">
        <Gift className="w-4 h-4" />
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Digital Handover Setup</DialogTitle>
      </DialogHeader>
      <HandoverPanel {...props} />
    </DialogContent>
  </Dialog>
);
