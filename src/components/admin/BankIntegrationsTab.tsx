import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, X, Edit2, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFinanceBanks, useCreateFinanceBank, useUpdateFinanceBank, useDeleteFinanceBank, FinanceBank } from '@/hooks/useFinanceBanks';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const BankIntegrationsTab = () => {
  const { data: banks = [], isLoading } = useFinanceBanks();
  const createBank = useCreateFinanceBank();
  const updateBank = useUpdateFinanceBank();
  const deleteBank = useDeleteFinanceBank();

  const [newBankName, setNewBankName] = useState('');
  const [newBankUrl, setNewBankUrl] = useState('');
  const [editingBank, setEditingBank] = useState<FinanceBank | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');

  const handleAddBank = async () => {
    if (!newBankName.trim()) return;
    await createBank.mutateAsync({
      name: newBankName.trim(),
      signing_url: newBankUrl.trim() || undefined,
    });
    setNewBankName('');
    setNewBankUrl('');
  };

  const handleStartEdit = (bank: FinanceBank) => {
    setEditingBank(bank);
    setEditName(bank.name);
    setEditUrl(bank.signing_url || '');
  };

  const handleSaveEdit = async () => {
    if (!editingBank || !editName.trim()) return;
    await updateBank.mutateAsync({
      id: editingBank.id,
      name: editName.trim(),
      signing_url: editUrl.trim() || undefined,
    });
    setEditingBank(null);
  };

  const handleCancelEdit = () => {
    setEditingBank(null);
  };

  const handleDelete = async (id: string) => {
    await deleteBank.mutateAsync(id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6 space-y-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <Building2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Bank Integrations</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure financing banks and their default contract signing links.
      </p>

      {/* Add New Bank */}
      <div className="p-4 bg-muted/30 rounded-lg space-y-4">
        <Label className="font-medium">Add New Bank</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bank-name" className="text-xs text-muted-foreground">Bank Name *</Label>
            <Input
              id="bank-name"
              placeholder="e.g., MFC, WesBank"
              value={newBankName}
              onChange={(e) => setNewBankName(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="bank-url" className="text-xs text-muted-foreground">Default Signing URL</Label>
            <div className="flex gap-2">
              <Input
                id="bank-url"
                placeholder="https://bank.com/sign/"
                value={newBankUrl}
                onChange={(e) => setNewBankUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleAddBank} 
                disabled={!newBankName.trim() || createBank.isPending}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Existing Banks */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading banks...</p>
      ) : banks.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No banks configured yet. Add your first bank above.
        </p>
      ) : (
        <div className="space-y-2">
          {banks.map((bank) => (
            <div 
              key={bank.id} 
              className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
            >
              {editingBank?.id === bank.id ? (
                // Edit Mode
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Bank Name"
                    className="h-9"
                  />
                  <Input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="Signing URL"
                    className="h-9 md:col-span-2"
                  />
                </div>
              ) : (
                // Display Mode
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{bank.name}</p>
                    {bank.signing_url ? (
                      <a 
                        href={bank.signing_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1"
                      >
                        {bank.signing_url}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">No default URL</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1 ml-2">
                {editingBank?.id === bank.id ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSaveEdit}
                      disabled={updateBank.isPending}
                      className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCancelEdit}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleStartEdit(bank)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Bank?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove "{bank.name}" from your bank list. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(bank.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default BankIntegrationsTab;
