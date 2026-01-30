import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Rental, useRentalLogs, useRentals } from '@/hooks/useRentals';
import { format } from 'date-fns';
import { formatPrice } from '@/lib/formatters';
import { 
  Car, User, Banknote, Plus, Minus, TrendingUp, TrendingDown, 
  Calendar, Trash2, MoreVertical 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RentalDetailSheetProps {
  rental: Rental | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RentalDetailSheet = ({ rental, open, onOpenChange }: RentalDetailSheetProps) => {
  const { updateRental, deleteRental } = useRentals();
  const { logs, createLog, deleteLog, totalIncome, totalExpenses } = useRentalLogs(rental?.id ?? null);
  
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logType, setLogType] = useState<'income' | 'expense'>('income');
  const [logDescription, setLogDescription] = useState('');
  const [logAmount, setLogAmount] = useState('');
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  if (!rental) return null;

  const assetCost = Number(rental.purchase_price) + Number(rental.initial_recon_cost);
  const netProfit = totalIncome - totalExpenses - assetCost;

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    maintenance: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    available: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    sold: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const handleLogSubmit = async () => {
    if (!logDescription || !logAmount) return;

    await createLog.mutateAsync({
      rental_id: rental.id,
      type: logType,
      description: logDescription,
      amount: Number(logAmount),
      log_date: logDate,
    });

    setLogModalOpen(false);
    setLogDescription('');
    setLogAmount('');
    setLogDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateRental.mutateAsync({ id: rental.id, status: newStatus });
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this rental? All logs will be deleted.')) {
      await deleteRental.mutateAsync(rental.id);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  {rental.vehicle_make_model}
                </SheetTitle>
                <p className="text-sm text-muted-foreground mt-1">{rental.registration_number}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusColors[rental.status] || statusColors.available}>
                  {rental.status}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                      Set Active
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('available')}>
                      Set Available
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('maintenance')}>
                      Set Maintenance
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('sold')}>
                      Mark as Sold
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      Delete Rental
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </SheetHeader>

          {/* Profit Summary */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="p-3 text-center">
                <TrendingUp className="h-4 w-4 mx-auto text-green-400 mb-1" />
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="font-bold text-green-400">{formatPrice(totalIncome)}</p>
              </CardContent>
            </Card>
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-3 text-center">
                <TrendingDown className="h-4 w-4 mx-auto text-red-400 mb-1" />
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="font-bold text-red-400">{formatPrice(totalExpenses + assetCost)}</p>
              </CardContent>
            </Card>
            <Card className={netProfit >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20'}>
              <CardContent className="p-3 text-center">
                <Banknote className="h-4 w-4 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Net P/L</p>
                <p className={`font-bold ${netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatPrice(netProfit)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Renter Info */}
          {rental.renter_name && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Current Renter</span>
                </div>
                <p className="text-sm">{rental.renter_name}</p>
                {rental.renter_contact && (
                  <p className="text-sm text-muted-foreground">{rental.renter_contact}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>Rent: {formatPrice(rental.monthly_rent)}/mo</span>
                  <span>Due: {rental.payment_day}th</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mb-6">
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                setLogType('income');
                setLogDescription(`${format(new Date(), 'MMMM')} Rent`);
                setLogAmount(String(rental.monthly_rent));
                setLogModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Log Payment
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
              onClick={() => {
                setLogType('expense');
                setLogDescription('');
                setLogAmount('');
                setLogModalOpen(true);
              }}
            >
              <Minus className="h-4 w-4 mr-1" /> Log Expense
            </Button>
          </div>

          {/* History Timeline */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Transaction History
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No transactions yet
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      log.type === 'income' 
                        ? 'bg-green-500/5 border-green-500/20' 
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{log.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.log_date), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${
                        log.type === 'income' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {log.type === 'income' ? '+' : '-'}{formatPrice(log.amount)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteLog.mutate(log.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Log Entry Modal */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {logType === 'income' ? 'Log Payment' : 'Log Expense'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Description</Label>
              <Input
                placeholder={logType === 'income' ? 'e.g. March Rent' : 'e.g. New Tyres'}
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (R)</Label>
                <Input
                  type="number"
                  value={logAmount}
                  onChange={(e) => setLogAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLogSubmit}
              disabled={!logDescription || !logAmount || createLog.isPending}
              className={logType === 'income' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {createLog.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RentalDetailSheet;
