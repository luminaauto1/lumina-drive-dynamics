import { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Edit2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { vehicles as initialVehicles, formatPrice } from '@/data/vehicles';
import { Vehicle } from '@/hooks/useWishlist';

const AdminInventory = () => {
  const [vehicleList, setVehicleList] = useState<Vehicle[]>(initialVehicles);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Edit form state
  const [editPrice, setEditPrice] = useState('');
  const [editStatus, setEditStatus] = useState<Vehicle['status']>('available');
  const [editFinance, setEditFinance] = useState(true);

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setEditPrice(vehicle.price.toString());
    setEditStatus(vehicle.status);
    setEditFinance(vehicle.financeAvailable);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingVehicle) return;

    setVehicleList((prev) =>
      prev.map((v) =>
        v.id === editingVehicle.id
          ? {
              ...v,
              price: Number(editPrice),
              status: editStatus,
              financeAvailable: editFinance,
            }
          : v
      )
    );

    setIsDialogOpen(false);
    setEditingVehicle(null);
  };

  const toggleFinance = (vehicleId: string) => {
    setVehicleList((prev) =>
      prev.map((v) =>
        v.id === vehicleId ? { ...v, financeAvailable: !v.financeAvailable } : v
      )
    );
  };

  const getStatusBadge = (status: Vehicle['status']) => {
    const styles = {
      available: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      sold: 'bg-red-500/20 text-red-400 border-red-500/30',
      incoming: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };

    return (
      <span className={`px-2 py-1 text-xs uppercase tracking-wider rounded border ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <>
      <Helmet>
        <title>Admin Inventory | Lumina Auto</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-semibold mb-2">Inventory Management</h1>
            <p className="text-muted-foreground">Manage vehicle listings, pricing, and availability</p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="glass-card rounded-lg p-4">
              <p className="text-2xl font-bold">{vehicleList.length}</p>
              <p className="text-sm text-muted-foreground">Total Vehicles</p>
            </div>
            <div className="glass-card rounded-lg p-4">
              <p className="text-2xl font-bold text-emerald-400">
                {vehicleList.filter((v) => v.status === 'available').length}
              </p>
              <p className="text-sm text-muted-foreground">Available</p>
            </div>
            <div className="glass-card rounded-lg p-4">
              <p className="text-2xl font-bold text-red-400">
                {vehicleList.filter((v) => v.status === 'sold').length}
              </p>
              <p className="text-sm text-muted-foreground">Sold</p>
            </div>
            <div className="glass-card rounded-lg p-4">
              <p className="text-2xl font-bold text-amber-400">
                {vehicleList.filter((v) => v.status === 'incoming').length}
              </p>
              <p className="text-sm text-muted-foreground">Incoming</p>
            </div>
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-xl overflow-hidden"
          >
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-muted-foreground">Image</TableHead>
                  <TableHead className="text-muted-foreground">Vehicle</TableHead>
                  <TableHead className="text-muted-foreground">Price</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground text-center">Finance</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicleList.map((vehicle) => (
                  <TableRow key={vehicle.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      <img
                        src={vehicle.images[0]}
                        alt={`${vehicle.make} ${vehicle.model}`}
                        className="w-20 h-14 object-cover rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </p>
                        <p className="text-sm text-muted-foreground">{vehicle.variant}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatPrice(vehicle.price)}
                    </TableCell>
                    <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={vehicle.financeAvailable}
                        onCheckedChange={() => toggleFinance(vehicle.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(vehicle)}
                        className="hover:bg-white/10"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="glass-card border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit Vehicle
            </DialogTitle>
          </DialogHeader>

          {editingVehicle && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4">
                <img
                  src={editingVehicle.images[0]}
                  alt={`${editingVehicle.make} ${editingVehicle.model}`}
                  className="w-24 h-16 object-cover rounded"
                />
                <div>
                  <p className="font-medium">
                    {editingVehicle.year} {editingVehicle.make} {editingVehicle.model}
                  </p>
                  <p className="text-sm text-muted-foreground">{editingVehicle.variant}</p>
                </div>
              </div>

              {/* Price Input */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Price (ZAR)</label>
                <Input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="glass-card border-white/10"
                />
              </div>

              {/* Status Select */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Status</label>
                <Select value={editStatus} onValueChange={(val: Vehicle['status']) => setEditStatus(val)}>
                  <SelectTrigger className="glass-card border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10">
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="incoming">Incoming</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Finance Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Finance Available</label>
                <Switch
                  checked={editFinance}
                  onCheckedChange={setEditFinance}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminInventory;