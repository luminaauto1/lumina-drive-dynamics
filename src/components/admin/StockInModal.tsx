import { useState, useEffect, useCallback } from 'react';
import { PackageCheck, FileText, DollarSign, HeartPulse, Key, Calendar, Gauge, AlertTriangle, ImagePlus, X, GripVertical, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useUpdateVehicle, useCreateVehicle, Vehicle } from '@/hooks/useVehicles';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import SortableImage from '@/components/admin/SortableImage';

interface StockInModalProps {
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
}

const FSH_OPTIONS = ['Full', 'Partial', 'None'] as const;

const StockInModal = ({ vehicle, isOpen, onClose }: StockInModalProps) => {
  const updateVehicle = useUpdateVehicle();
  const createVehicle = useCreateVehicle();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('legal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keepSourcingActive, setKeepSourcingActive] = useState(true);
  
  // Legal Identity
  const [vin, setVin] = useState('');
  const [engineCode, setEngineCode] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [stockNumber, setStockNumber] = useState('');
  const [year, setYear] = useState(vehicle.year);
  const [mileage, setMileage] = useState(vehicle.mileage || 0);
  const [color, setColor] = useState((vehicle as any).color || '');
  
  // Financials
  const [costPrice, setCostPrice] = useState(0);
  const [reconCost, setReconCost] = useState(0);
  const [salePrice, setSalePrice] = useState(vehicle.price);
  
  // Vehicle Health (DNA)
  const [lastServiceDate, setLastServiceDate] = useState('');
  const [lastServiceKm, setLastServiceKm] = useState<number | ''>('');
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [nextServiceKm, setNextServiceKm] = useState<number | ''>('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [servicePlanExpiry, setServicePlanExpiry] = useState('');
  const [spareKeys, setSpareKeys] = useState(false);
  const [fshStatus, setFshStatus] = useState<string>('Full');
  
  // Hidden Source (Client Specific)
  const [isHiddenSource, setIsHiddenSource] = useState(false);
  
  // Photos
  const [images, setImages] = useState<string[]>(vehicle.images || []);
  const [isUploading, setIsUploading] = useState(false);
  
  // Pre-populate with existing data if available
  useEffect(() => {
    if (vehicle) {
      setVin(vehicle.vin || '');
      setEngineCode(vehicle.engine_code || '');
      setYear(vehicle.year);
      setMileage(vehicle.mileage || 0);
      setColor((vehicle as any).color || '');
      setSalePrice(vehicle.price);
      setCostPrice((vehicle as any).cost_price || (vehicle as any).purchase_price || 0);
      setReconCost((vehicle as any).reconditioning_cost || 0);
      setRegistrationNumber((vehicle as any).registration_number || '');
      setLastServiceDate((vehicle as any).last_service_date || '');
      setLastServiceKm((vehicle as any).last_service_km || '');
      setNextServiceDate((vehicle as any).next_service_date || '');
      setNextServiceKm((vehicle as any).next_service_km || '');
      setWarrantyExpiry((vehicle as any).warranty_expiry_date || '');
      setServicePlanExpiry((vehicle as any).service_plan_expiry_date || '');
      setSpareKeys((vehicle as any).spare_keys || false);
      setFshStatus((vehicle as any).fsh_status || 'Full');
      setImages(vehicle.images || []);
    }
  }, [vehicle]);
  
  // DnD Sensors for image reordering
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
  // Image upload handler
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
  
  // Generate next stock number
  useEffect(() => {
    const fetchNextStockNumber = async () => {
      try {
        const { data: latestVehicles } = await supabase
          .from('vehicles')
          .select('stock_number')
          .not('stock_number', 'is', null)
          .order('stock_number', { ascending: false })
          .limit(1);
        
        if (latestVehicles && latestVehicles.length > 0 && latestVehicles[0].stock_number) {
          const lastNumber = latestVehicles[0].stock_number;
          const match = lastNumber.match(/LA(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10) + 1;
            setStockNumber(`LA${String(num).padStart(6, '0')}`);
          }
        } else {
          setStockNumber('LA001134');
        }
      } catch (error) {
        console.error('Failed to fetch stock number:', error);
        setStockNumber('LA001134');
      }
    };
    
    if (isOpen && !stockNumber) {
      fetchNextStockNumber();
    }
  }, [isOpen]);
  
  const estimatedProfit = salePrice - costPrice - reconCost;
  
  const handleSubmit = async () => {
    // Validation
    if (!vin) {
      toast.error('VIN is required');
      setActiveTab('legal');
      return;
    }
    if (!engineCode) {
      toast.error('Engine Number is required');
      setActiveTab('legal');
      return;
    }
    if (!costPrice) {
      toast.error('Cost Price is required');
      setActiveTab('financial');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Determine status: 'hidden' for client-specific sourcing, else 'available'
      const targetStatus = isHiddenSource ? 'hidden' : 'available';
      
      const vehicleData: any = {
        make: vehicle.make,
        model: vehicle.model,
        variant: vehicle.variant,
        year,
        mileage,
        color: color || null,
        vin,
        engine_code: engineCode,
        registration_number: registrationNumber || null,
        stock_number: stockNumber || null,
        transmission: vehicle.transmission,
        fuel_type: vehicle.fuel_type,
        price: salePrice,
        status: targetStatus,
        finance_available: vehicle.finance_available ?? true,
        description: vehicle.description || null,
        images: images, // Use updated images array
        body_type: (vehicle as any).body_type || null,
        is_generic_listing: false, // This is now real stock
        cost_price: costPrice,
        purchase_price: costPrice, // Keep for compatibility
        reconditioning_cost: reconCost,
        // NOTE: Do NOT include estimated_profit - it may be a generated column
        last_service_date: lastServiceDate || null,
        last_service_km: lastServiceKm || null,
        next_service_date: nextServiceDate || null,
        next_service_km: nextServiceKm || null,
        warranty_expiry_date: warrantyExpiry || null,
        service_plan_expiry_date: servicePlanExpiry || null,
        spare_keys: spareKeys,
        fsh_status: fshStatus,
        service_history: fshStatus, // Keep for compatibility
      };
      
      const isSourcingVehicle = vehicle.status === 'sourcing' || (vehicle as any).is_generic_listing;
      
      if (isSourcingVehicle && keepSourcingActive) {
        // CREATE a clone for real stock, keep sourcing example alive
        const { error: insertError } = await supabase
          .from('vehicles')
          .insert(vehicleData);
        
        if (insertError) throw insertError;
        
        // Increment sourced_count on original
        const currentCount = (vehicle as any).sourced_count || 0;
        await supabase
          .from('vehicles')
          .update({ sourced_count: currentCount + 1 })
          .eq('id', vehicle.id);
        
        toast.success('Vehicle stocked in! Sourcing example preserved.');
      } else {
        // UPDATE the existing record directly
        await updateVehicle.mutateAsync({
          id: vehicle.id,
          updates: vehicleData,
        });
        
        toast.success('Vehicle stocked in and converted to real stock!');
      }
      
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      onClose();
      
    } catch (error: any) {
      toast.error('Failed to stock in vehicle: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isSourcingVehicle = vehicle.status === 'sourcing' || (vehicle as any).is_generic_listing;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-primary" />
            Stock-In Wizard
          </DialogTitle>
          <DialogDescription>
            Convert this vehicle to real inventory stock.
          </DialogDescription>
        </DialogHeader>
        
        {/* Vehicle Summary */}
        <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 mb-4">
          <p className="text-lg font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</p>
          <p className="text-sm text-muted-foreground">{vehicle.variant || 'Standard'}</p>
        </div>
        
        {/* Keep Sourcing Example Checkbox - Only for sourcing vehicles */}
        {isSourcingVehicle && (
          <div className="flex items-center space-x-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <Checkbox
              id="keepSourcing"
              checked={keepSourcingActive}
              onCheckedChange={(checked) => setKeepSourcingActive(checked === true)}
            />
            <div className="flex-1">
              <Label htmlFor="keepSourcing" className="text-sm font-medium cursor-pointer">
                Keep original sourcing example active
              </Label>
              <p className="text-xs text-muted-foreground">
                Creates a new stock record while keeping the template for future conversions.
              </p>
            </div>
          </div>
        )}
        
        {/* Hidden Source (Client Specific) Option */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <EyeOff className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label htmlFor="hiddenSource" className="text-sm font-medium cursor-pointer">
                Client Specific Sourcing (Hide from Website)
              </Label>
              <p className="text-xs text-muted-foreground">
                This vehicle will not appear in public inventory.
              </p>
            </div>
          </div>
          <Switch
            id="hiddenSource"
            checked={isHiddenSource}
            onCheckedChange={setIsHiddenSource}
          />
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="legal" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Legal</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">$$$</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-2">
              <HeartPulse className="w-4 h-4" />
              <span className="hidden sm:inline">DNA</span>
            </TabsTrigger>
            <TabsTrigger value="photos" className="gap-2">
              <ImagePlus className="w-4 h-4" />
              <span className="hidden sm:inline">Photos</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Legal Identity Tab */}
          <TabsContent value="legal" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  VIN <span className="text-red-400">*</span>
                </Label>
                <Input
                  placeholder="Enter 17-character VIN"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  maxLength={17}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Engine Number <span className="text-red-400">*</span>
                </Label>
                <Input
                  placeholder="Engine code"
                  value={engineCode}
                  onChange={(e) => setEngineCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input
                  placeholder="e.g., GP 123 456"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock Number</Label>
                <Input
                  placeholder="Auto-generated"
                  value={stockNumber}
                  onChange={(e) => setStockNumber(e.target.value)}
                />
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                />
              </div>
              <div className="space-y-2">
                <Label>Mileage (km)</Label>
                <Input
                  type="number"
                  placeholder="Current odometer"
                  value={mileage || ''}
                  onChange={(e) => setMileage(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  placeholder="e.g., White"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button onClick={() => setActiveTab('financial')}>
                Next →
              </Button>
            </div>
          </TabsContent>
          
          {/* Financials Tab */}
          <TabsContent value="financial" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Cost Price (Paid) <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="What we paid"
                  value={costPrice || ''}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Est. Recon Cost</Label>
                <Input
                  type="number"
                  placeholder="Repairs, polish, etc."
                  value={reconCost || ''}
                  onChange={(e) => setReconCost(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Selling Price</Label>
              <Input
                type="number"
                value={salePrice || ''}
                onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
              />
            </div>
            
            {/* Profit Preview */}
            <div className={`p-4 rounded-lg border ${estimatedProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <p className="text-sm text-muted-foreground mb-1">Estimated Profit</p>
              <p className={`text-2xl font-bold ${estimatedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                R {estimatedProfit.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sale Price - Cost - Recon = Profit
              </p>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab('legal')}>
                ← Back
              </Button>
              <Button onClick={() => setActiveTab('health')}>
                Next →
              </Button>
            </div>
          </TabsContent>
          
          {/* Vehicle Health Tab */}
          <TabsContent value="health" className="space-y-4 mt-4">
            {/* Service History Status */}
            <div className="space-y-2">
              <Label>Service History</Label>
              <Select value={fshStatus} onValueChange={setFshStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select FSH status" />
                </SelectTrigger>
                <SelectContent>
                  {FSH_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt} Service History</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Separator />
            
            {/* Last Service */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Last Service Date
                </Label>
                <Input
                  type="date"
                  value={lastServiceDate}
                  onChange={(e) => setLastServiceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  Last Service KM
                </Label>
                <Input
                  type="number"
                  placeholder="e.g., 85000"
                  value={lastServiceKm}
                  onChange={(e) => setLastServiceKm(e.target.value ? parseInt(e.target.value) : '')}
                />
              </div>
            </div>
            
            {/* Next Service */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Next Service Date</Label>
                <Input
                  type="date"
                  value={nextServiceDate}
                  onChange={(e) => setNextServiceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Next Service KM</Label>
                <Input
                  type="number"
                  placeholder="e.g., 100000"
                  value={nextServiceKm}
                  onChange={(e) => setNextServiceKm(e.target.value ? parseInt(e.target.value) : '')}
                />
              </div>
            </div>
            
            <Separator />
            
            {/* Warranty & Service Plan */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Warranty Expiry</Label>
                <Input
                  type="date"
                  value={warrantyExpiry}
                  onChange={(e) => setWarrantyExpiry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Service Plan Expiry</Label>
                <Input
                  type="date"
                  value={servicePlanExpiry}
                  onChange={(e) => setServicePlanExpiry(e.target.value)}
                />
              </div>
            </div>
            
            {/* Spare Keys */}
            <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
              <Checkbox
                id="spareKeys"
                checked={spareKeys}
                onCheckedChange={(checked) => setSpareKeys(checked === true)}
              />
              <Label htmlFor="spareKeys" className="flex items-center gap-2 cursor-pointer">
                <Key className="w-4 h-4" />
                Spare Keys Available
              </Label>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab('financial')}>
                ← Back
              </Button>
              <Button onClick={() => setActiveTab('photos')}>
                Next →
              </Button>
            </div>
          </TabsContent>
          
          {/* Photos Tab */}
          <TabsContent value="photos" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <ImagePlus className="w-4 h-4" />
                  Vehicle Photos ({images.length})
                </Label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                  <Button asChild variant="outline" size="sm" disabled={isUploading}>
                    <span>
                      {isUploading ? 'Uploading...' : 'Add Photos'}
                    </span>
                  </Button>
                </label>
              </div>
              
              {images.length === 0 ? (
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center">
                  <ImagePlus className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No photos yet. Upload images above.</p>
                  <p className="text-xs text-muted-foreground mt-1">First image will be the cover photo.</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={images} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {images.map((url, idx) => (
                        <SortableImage
                          key={url}
                          id={url}
                          url={url}
                          index={idx}
                          onRemove={removeImage}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              
              <p className="text-xs text-muted-foreground">
                Drag images to reorder. First image becomes the cover photo.
              </p>
            </div>
            
            <div className="flex justify-start">
              <Button variant="outline" onClick={() => setActiveTab('health')}>
                ← Back
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? 'Processing...' : 'Complete Stock-In'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StockInModal;
