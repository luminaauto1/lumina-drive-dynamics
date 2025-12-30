import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Plus, Search, Trash2, Edit2, Upload, X, GripVertical } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle, formatPrice, Vehicle, VehicleInsert } from '@/hooks/useVehicles';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const vehicleSchema = z.object({
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  variant: z.string().optional(),
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  mileage: z.coerce.number().min(0),
  color: z.string().optional(),
  vin: z.string().optional(),
  transmission: z.string().min(1, 'Transmission is required'),
  fuel_type: z.string().min(1, 'Fuel type is required'),
  price: z.coerce.number().min(0, 'Price must be positive'),
  status: z.enum(['available', 'reserved', 'sold']),
  finance_available: z.boolean(),
  description: z.string().optional(),
  engine_code: z.string().optional(),
  service_history: z.string().optional(),
  youtube_url: z.string().optional(),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

const AdminInventoryPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<Vehicle | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { data: vehicles = [], isLoading } = useVehicles();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const deleteVehicleMutation = useDeleteVehicle();

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      make: '',
      model: '',
      variant: '',
      year: new Date().getFullYear(),
      mileage: 0,
      color: '',
      vin: '',
      transmission: 'Automatic',
      fuel_type: 'Petrol',
      price: 0,
      status: 'available',
      finance_available: true,
      description: '',
      engine_code: '',
      service_history: '',
      youtube_url: '',
    },
  });

  const filteredVehicles = vehicles.filter(v => {
    const search = searchQuery.toLowerCase();
    return (
      v.make.toLowerCase().includes(search) ||
      v.model.toLowerCase().includes(search) ||
      v.variant?.toLowerCase().includes(search)
    );
  });

  const openAddSheet = () => {
    setEditingVehicle(null);
    form.reset({
      make: '',
      model: '',
      variant: '',
      year: new Date().getFullYear(),
      mileage: 0,
      color: '',
      vin: '',
      transmission: 'Automatic',
      fuel_type: 'Petrol',
      price: 0,
      status: 'available',
      finance_available: true,
      description: '',
      engine_code: '',
      service_history: '',
      youtube_url: '',
    });
    setImages([]);
    setIsSheetOpen(true);
  };

  const openEditSheet = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    form.reset({
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant || '',
      year: vehicle.year,
      mileage: vehicle.mileage,
      color: vehicle.color || '',
      vin: vehicle.vin || '',
      transmission: vehicle.transmission,
      fuel_type: vehicle.fuel_type,
      price: vehicle.price,
      status: vehicle.status as 'available' | 'reserved' | 'sold',
      finance_available: vehicle.finance_available ?? true,
      description: vehicle.description || '',
      engine_code: vehicle.engine_code || '',
      service_history: vehicle.service_history || '',
      youtube_url: vehicle.youtube_url || '',
    });
    setImages(vehicle.images || []);
    setIsSheetOpen(true);
  };

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `vehicles/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('vehicle-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('vehicle-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setImages(prev => [...prev, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} image(s) uploaded`);
    } catch (error: any) {
      toast.error('Failed to upload images: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    setImages(prev => {
      const newImages = [...prev];
      const [moved] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, moved);
      return newImages;
    });
  };

  const onSubmit = async (data: VehicleFormData) => {
    const vehicleData: VehicleInsert = {
      make: data.make,
      model: data.model,
      variant: data.variant || null,
      year: data.year,
      mileage: data.mileage,
      color: data.color || null,
      vin: data.vin || null,
      transmission: data.transmission,
      fuel_type: data.fuel_type,
      price: data.price,
      status: data.status,
      finance_available: data.finance_available,
      description: data.description || null,
      engine_code: data.engine_code || null,
      service_history: data.service_history || null,
      youtube_url: data.youtube_url || null,
      images,
    };

    if (editingVehicle) {
      await updateVehicle.mutateAsync({ id: editingVehicle.id, updates: vehicleData });
    } else {
      await createVehicle.mutateAsync(vehicleData);
    }

    setIsSheetOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteVehicle) return;
    await deleteVehicleMutation.mutateAsync(deleteVehicle.id);
    setDeleteVehicle(null);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      available: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      reserved: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      sold: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
      <span className={`px-2 py-1 text-xs uppercase tracking-wider rounded border ${styles[status] || styles.available}`}>
        {status}
      </span>
    );
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Inventory Manager | Lumina Auto Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"
        >
          <div>
            <h1 className="text-3xl font-semibold mb-2">Inventory Manager</h1>
            <p className="text-muted-foreground">Manage your vehicle listings</p>
          </div>
          <Button onClick={openAddSheet} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Vehicle
          </Button>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredVehicles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery ? 'No vehicles match your search' : 'No vehicles in inventory. Add your first vehicle!'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-muted-foreground">Image</TableHead>
                  <TableHead className="text-muted-foreground">Stock #</TableHead>
                  <TableHead className="text-muted-foreground">Vehicle</TableHead>
                  <TableHead className="text-muted-foreground">Price</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground text-center">Finance</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => (
                  <TableRow key={vehicle.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      {vehicle.images && vehicle.images[0] ? (
                        <img
                          src={vehicle.images[0]}
                          alt={`${vehicle.make} ${vehicle.model}`}
                          className="w-20 h-14 object-cover rounded"
                        />
                      ) : (
                        <div className="w-20 h-14 bg-secondary rounded flex items-center justify-center text-muted-foreground text-xs">
                          No Image
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {vehicle.id.slice(0, 8).toUpperCase()}
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
                        checked={vehicle.finance_available ?? true}
                        onCheckedChange={async (checked) => {
                          await updateVehicle.mutateAsync({
                            id: vehicle.id,
                            updates: { finance_available: checked },
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditSheet(vehicle)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteVehicle(vehicle)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </motion.div>
      </div>

      {/* Add/Edit Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</SheetTitle>
            <SheetDescription>
              {editingVehicle ? 'Update vehicle details' : 'Add a new vehicle to your inventory'}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Basic Info</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Make</FormLabel>
                        <FormControl>
                          <Input placeholder="BMW" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="M4" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="variant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Variant</FormLabel>
                        <FormControl>
                          <Input placeholder="Competition" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mileage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mileage (km)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <FormControl>
                          <Input placeholder="Frozen White" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VIN</FormLabel>
                        <FormControl>
                          <Input placeholder="Optional" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="engine_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Engine Code</FormLabel>
                        <FormControl>
                          <Input placeholder="S58" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="transmission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transmission</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Automatic">Automatic</SelectItem>
                            <SelectItem value="Manual">Manual</SelectItem>
                            <SelectItem value="DCT">DCT</SelectItem>
                            <SelectItem value="CVT">CVT</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fuel_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fuel Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Petrol">Petrol</SelectItem>
                            <SelectItem value="Diesel">Diesel</SelectItem>
                            <SelectItem value="Hybrid">Hybrid</SelectItem>
                            <SelectItem value="Electric">Electric</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Pricing</h3>
                
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price (ZAR)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Media Center */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Media Center</h3>
                
                {/* Image Upload */}
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className={`w-8 h-8 ${isUploading ? 'animate-pulse' : ''} text-muted-foreground`} />
                    <p className="text-sm text-muted-foreground">
                      {isUploading ? 'Uploading...' : 'Click to upload images'}
                    </p>
                  </label>
                </div>

                {/* Image Preview Grid */}
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((url, index) => (
                      <div key={url} className="relative group aspect-video">
                        <img
                          src={url}
                          alt={`Vehicle ${index + 1}`}
                          className="w-full h-full object-cover rounded"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="p-1 bg-destructive rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => moveImage(index, index - 1)}
                              className="p-1 bg-secondary rounded text-xs"
                            >
                              ←
                            </button>
                          )}
                          {index < images.length - 1 && (
                            <button
                              type="button"
                              onClick={() => moveImage(index, index + 1)}
                              className="p-1 bg-secondary rounded text-xs"
                            >
                              →
                            </button>
                          )}
                        </div>
                        {index === 0 && (
                          <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-1 rounded">
                            Main
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="youtube_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>YouTube Video URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://youtube.com/watch?v=..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Status Control */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Status Control</h3>
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="available" id="available" />
                            <Label htmlFor="available" className="text-emerald-400">Available</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="reserved" id="reserved" />
                            <Label htmlFor="reserved" className="text-amber-400">Reserved</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="sold" id="sold" />
                            <Label htmlFor="sold" className="text-red-400">Sold</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="finance_available"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <FormLabel>Finance Available</FormLabel>
                        <p className="text-sm text-muted-foreground">Allow customers to apply for finance</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Additional Info</h3>
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Vehicle description..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="service_history"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service History</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select service history" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Full Franchise Service History">Full Franchise Service History</SelectItem>
                          <SelectItem value="Partial Service History">Partial Service History</SelectItem>
                          <SelectItem value="No Service History">No Service History</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsSheetOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={createVehicle.isPending || updateVehicle.isPending}
                >
                  {createVehicle.isPending || updateVehicle.isPending ? 'Saving...' : 'Save Vehicle'}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteVehicle} onOpenChange={() => setDeleteVehicle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteVehicle?.year} {deleteVehicle?.make} {deleteVehicle?.model}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminInventoryPage;