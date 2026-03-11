import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Rental, useRentalLogs, useRentals } from '@/hooks/useRentals';
import { useCreateVehicle } from '@/hooks/useVehicles';
import { format } from 'date-fns';
import { formatPrice } from '@/lib/formatters';
import { 
  Car, User, Banknote, Plus, Minus, TrendingUp, TrendingDown, 
  Calendar, Trash2, MoreVertical, UserMinus, UserPlus, ShoppingBag
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface RentalDetailSheetProps {
  rental: Rental | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RentalDetailSheet = ({ rental, open, onOpenChange }: RentalDetailSheetProps) => {
  const { updateRental, deleteRental } = useRentals();
  const createVehicle = useCreateVehicle();
  const { logs, createLog, deleteLog, totalIncome, totalExpenses } = useRentalLogs(rental?.id ?? null);
  
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logType, setLogType] = useState<'income' | 'expense'>('income');
  const [logDescription, setLogDescription] = useState('');
  const [logAmount, setLogAmount] = useState('');
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Reassign renter state
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [newRenterName, setNewRenterName] = useState('');
  const [newRenterContact, setNewRenterContact] = useState('');
  const [newRenterIdNumber, setNewRenterIdNumber] = useState('');
  const [newMonthlyRent, setNewMonthlyRent] = useState('');
  const [newPaymentDay, setNewPaymentDay] = useState('1');
  const [newDepositAmount, setNewDepositAmount] = useState('');

  // Convert to retail state
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [retailPrice, setRetailPrice] = useState('');
  const [retailYear, setRetailYear] = useState(String(new Date().getFullYear()));
  const [retailMileage, setRetailMileage] = useState('');
  const [retailFuelType, setRetailFuelType] = useState('Petrol');
  const [retailTransmission, setRetailTransmission] = useState('Manual');

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

  // Unassign current renter
  const handleUnassignRenter = async () => {
    if (!confirm('Unassign the current renter? The vehicle will be set to Available.')) return;
    await updateRental.mutateAsync({
      id: rental.id,
      renter_name: null,
      renter_contact: null,
      renter_id_number: null,
      status: 'available',
    } as any);
    toast.success('Renter unassigned — vehicle is now available');
  };

  // Reassign to a new renter
  const handleReassignSubmit = async () => {
    if (!newRenterName) return;
    await updateRental.mutateAsync({
      id: rental.id,
      renter_name: newRenterName,
      renter_contact: newRenterContact || null,
      renter_id_number: newRenterIdNumber || null,
      monthly_rent: newMonthlyRent ? Number(newMonthlyRent) : rental.monthly_rent,
      payment_day: newPaymentDay ? Number(newPaymentDay) : rental.payment_day,
      deposit_amount: newDepositAmount ? Number(newDepositAmount) : rental.deposit_amount,
      status: 'active',
      start_date: format(new Date(), 'yyyy-MM-dd'),
    } as any);
    toast.success(`Vehicle reassigned to ${newRenterName}`);
    setReassignModalOpen(false);
    resetReassignForm();
  };

  const openReassignModal = () => {
    setNewRenterName('');
    setNewRenterContact('');
    setNewRenterIdNumber('');
    setNewMonthlyRent(String(rental.monthly_rent));
    setNewPaymentDay(String(rental.payment_day));
    setNewDepositAmount('');
    setReassignModalOpen(true);
  };

  const resetReassignForm = () => {
    setNewRenterName('');
    setNewRenterContact('');
    setNewRenterIdNumber('');
    setNewMonthlyRent('');
    setNewPaymentDay('1');
    setNewDepositAmount('');
  };

  // Convert rental to retail inventory
  const handleConvertToRetail = async () => {
    if (!retailPrice || !retailYear || !retailMileage) {
      toast.error('Please fill in price, year and mileage');
      return;
    }

    // Parse make & model from the combined field
    const parts = rental.vehicle_make_model.trim().split(' ');
    const make = parts[0] || 'Unknown';
    const model = parts.slice(1).join(' ') || 'Unknown';

    try {
      await createVehicle.mutateAsync({
        make,
        model,
        year: Number(retailYear),
        mileage: Number(retailMileage),
        price: Number(retailPrice),
        fuel_type: retailFuelType,
        transmission: retailTransmission,
        registration_number: rental.registration_number,
        vin: rental.vin_number || undefined,
        purchase_price: Number(rental.purchase_price),
        reconditioning_cost: Number(rental.initial_recon_cost),
        status: 'available',
      });

      // Archive the rental
      await updateRental.mutateAsync({
        id: rental.id,
        status: 'sold',
        renter_name: null,
        renter_contact: null,
        renter_id_number: null,
        notes: `${rental.notes ? rental.notes + '\n' : ''}Converted to retail stock on ${format(new Date(), 'dd MMM yyyy')}`,
      } as any);

      toast.success('Vehicle converted to retail inventory');
      setConvertModalOpen(false);
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Conversion failed: ' + error.message);
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
                    <DropdownMenuSeparator />
                    {rental.renter_name && (
                      <DropdownMenuItem onClick={handleUnassignRenter}>
                        <UserMinus className="h-4 w-4 mr-2" />
                        Unassign Renter
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={openReassignModal}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      {rental.renter_name ? 'Reassign Renter' : 'Assign Renter'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      setRetailPrice(String(rental.purchase_price || ''));
                      setRetailMileage('');
                      setConvertModalOpen(true);
                    }}>
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Convert to Retail Stock
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
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
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Current Renter</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleUnassignRenter}>
                      <UserMinus className="h-3 w-3 mr-1" /> Unassign
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={openReassignModal}>
                      <UserPlus className="h-3 w-3 mr-1" /> Reassign
                    </Button>
                  </div>
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

          {/* No renter - show assign prompt */}
          {!rental.renter_name && rental.status !== 'sold' && (
            <Card className="mb-4 border-dashed">
              <CardContent className="p-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">No renter assigned</p>
                <Button variant="outline" size="sm" onClick={openReassignModal}>
                  <UserPlus className="h-4 w-4 mr-1" /> Assign Renter
                </Button>
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

          {/* Convert to Retail CTA */}
          {rental.status !== 'sold' && (
            <Button
              variant="outline"
              className="w-full mb-6 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              onClick={() => {
                setRetailPrice(String(rental.purchase_price || ''));
                setRetailMileage('');
                setConvertModalOpen(true);
              }}
            >
              <ShoppingBag className="h-4 w-4 mr-1" /> Convert to Retail Stock
            </Button>
          )}

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

      {/* Reassign Renter Modal */}
      <Dialog open={reassignModalOpen} onOpenChange={setReassignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <UserPlus className="h-5 w-5 inline mr-2" />
              {rental.renter_name ? 'Reassign Renter' : 'Assign Renter'}
            </DialogTitle>
            <DialogDescription>
              {rental.renter_name
                ? `Current renter (${rental.renter_name}) will be replaced.`
                : 'Assign a new renter to this vehicle.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Renter Name *</Label>
              <Input
                placeholder="Full Name"
                value={newRenterName}
                onChange={(e) => setNewRenterName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact Number</Label>
                <Input
                  placeholder="Phone"
                  value={newRenterContact}
                  onChange={(e) => setNewRenterContact(e.target.value)}
                />
              </div>
              <div>
                <Label>ID Number</Label>
                <Input
                  placeholder="ID Number"
                  value={newRenterIdNumber}
                  onChange={(e) => setNewRenterIdNumber(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Monthly Rent (R)</Label>
                <Input
                  type="number"
                  value={newMonthlyRent}
                  onChange={(e) => setNewMonthlyRent(e.target.value)}
                />
              </div>
              <div>
                <Label>Deposit (R)</Label>
                <Input
                  type="number"
                  value={newDepositAmount}
                  onChange={(e) => setNewDepositAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Pay Day</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={newPaymentDay}
                  onChange={(e) => setNewPaymentDay(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleReassignSubmit}
              disabled={!newRenterName || updateRental.isPending}
            >
              {updateRental.isPending ? 'Saving...' : 'Assign Renter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Retail Stock Modal */}
      <Dialog open={convertModalOpen} onOpenChange={setConvertModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <ShoppingBag className="h-5 w-5 inline mr-2" />
              Convert to Retail Stock
            </DialogTitle>
            <DialogDescription>
              This will create a new listing in your sales inventory and archive the rental record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium">{rental.vehicle_make_model}</p>
              <p className="text-muted-foreground">{rental.registration_number} {rental.vin_number && `• ${rental.vin_number}`}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Retail Price (R) *</Label>
                <Input
                  type="number"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                />
              </div>
              <div>
                <Label>Year *</Label>
                <Input
                  type="number"
                  value={retailYear}
                  onChange={(e) => setRetailYear(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Mileage (km) *</Label>
                <Input
                  type="number"
                  value={retailMileage}
                  onChange={(e) => setRetailMileage(e.target.value)}
                />
              </div>
              <div>
                <Label>Fuel Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={retailFuelType}
                  onChange={(e) => setRetailFuelType(e.target.value)}
                >
                  <option>Petrol</option>
                  <option>Diesel</option>
                  <option>Hybrid</option>
                  <option>Electric</option>
                </select>
              </div>
              <div>
                <Label>Transmission</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={retailTransmission}
                  onChange={(e) => setRetailTransmission(e.target.value)}
                >
                  <option>Manual</option>
                  <option>Automatic</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConvertToRetail}
              disabled={!retailPrice || !retailMileage || createVehicle.isPending || updateRental.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {createVehicle.isPending ? 'Converting...' : 'Convert & List'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RentalDetailSheet;
