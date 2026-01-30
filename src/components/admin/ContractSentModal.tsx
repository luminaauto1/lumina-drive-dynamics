import { useState, useEffect } from 'react';
import { FileSignature, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceBanks } from '@/hooks/useFinanceBanks';
import { useUpdateFinanceApplication } from '@/hooks/useFinanceApplications';

interface ContractSentModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  clientName: string;
  onSuccess: () => void;
}

const ContractSentModal = ({
  isOpen,
  onClose,
  applicationId,
  clientName,
  onSuccess,
}: ContractSentModalProps) => {
  const { data: banks = [], isLoading: banksLoading } = useFinanceBanks();
  const updateApplication = useUpdateFinanceApplication();
  
  const [selectedBankId, setSelectedBankId] = useState('');
  const [signingUrl, setSigningUrl] = useState('');
  
  // Auto-fill signing URL when bank is selected
  useEffect(() => {
    const bank = banks.find(b => b.id === selectedBankId);
    if (bank?.signing_url) {
      setSigningUrl(bank.signing_url);
    }
  }, [selectedBankId, banks]);

  const handleSubmit = async () => {
    const bank = banks.find(b => b.id === selectedBankId);
    if (!bank) return;

    await updateApplication.mutateAsync({
      id: applicationId,
      updates: {
        status: 'contract_sent',
        contract_bank_name: bank.name,
        contract_url: signingUrl || null,
      },
    });

    onSuccess();
    onClose();
    
    // Reset form
    setSelectedBankId('');
    setSigningUrl('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" />
            Send Contract
          </DialogTitle>
          <DialogDescription>
            Record the bank contract details for {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Bank Selection */}
          <div className="space-y-2">
            <Label htmlFor="bank">Financing Bank *</Label>
            <Select value={selectedBankId} onValueChange={setSelectedBankId}>
              <SelectTrigger>
                <SelectValue placeholder={banksLoading ? "Loading banks..." : "Select a bank"} />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {bank.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {banks.length === 0 && !banksLoading && (
              <p className="text-xs text-amber-400">
                No banks configured. Add banks in Settings → Banks.
              </p>
            )}
          </div>

          {/* Signing URL */}
          <div className="space-y-2">
            <Label htmlFor="signing-url">Contract Signing Link</Label>
            <Input
              id="signing-url"
              value={signingUrl}
              onChange={(e) => setSigningUrl(e.target.value)}
              placeholder="https://bank.com/sign/contract-123"
            />
            <p className="text-xs text-muted-foreground">
              The client will see this link in their dashboard to sign the contract
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedBankId || updateApplication.isPending}
          >
            {updateApplication.isPending ? 'Sending...' : 'Confirm Contract Sent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContractSentModal;
