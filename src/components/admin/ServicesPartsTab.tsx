import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useExtraServices, SERVICE_CATEGORIES, CreateExtraServiceData } from '@/hooks/useExtraServices';
import { formatPrice } from '@/lib/formatters';
import { format } from 'date-fns';
import { Plus, TrendingUp, Banknote, Package, Trash2, Loader2 } from 'lucide-react';

const ServicesPartsTab = () => {
  const { services, isLoading, createService, deleteService, totalProfit, totalRevenue, totalCosts } = useExtraServices();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<CreateExtraServiceData>({
    category: '',
    description: '',
    provider_name: '',
    cost_price: 0,
    selling_price: 0,
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
  });

  const handleSubmit = async () => {
    if (!formData.category || !formData.description) return;

    await createService.mutateAsync(formData);
    setAddModalOpen(false);
    setFormData({
      category: '',
      description: '',
      provider_name: '',
      cost_price: 0,
      selling_price: 0,
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const getCategoryLabel = (value: string) => {
    return SERVICE_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Profit</p>
                <p className="text-2xl font-bold text-green-400">{formatPrice(totalProfit)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-blue-400">{formatPrice(totalRevenue)}</p>
              </div>
              <Banknote className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Jobs Completed</p>
                <p className="text-2xl font-bold text-purple-400">{services.length}</p>
              </div>
              <Package className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <Button onClick={() => setAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Log New Job
        </Button>
      </div>

      {/* Services Table */}
      {services.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Service Jobs</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start tracking extra income from services and parts sales.
            </p>
            <Button onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Log First Job
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Sold For</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => {
                const profit = Number(service.selling_price) - Number(service.cost_price);
                return (
                  <TableRow key={service.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(service.transaction_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(service.category)}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{service.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {service.provider_name || '-'}
                    </TableCell>
                    <TableCell className="text-right text-red-400">
                      {formatPrice(service.cost_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(service.selling_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPrice(profit)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteService.mutate(service.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Job Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log New Service Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description *</Label>
              <Input
                placeholder="e.g. Rubberising for Hilux JD77"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div>
              <Label>Provider Name</Label>
              <Input
                placeholder="Who did the work?"
                value={formData.provider_name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, provider_name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cost Price (R)</Label>
                <Input
                  type="number"
                  value={formData.cost_price || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost_price: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Selling Price (R)</Label>
                <Input
                  type="number"
                  value={formData.selling_price || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, selling_price: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div>
              <Label>Transaction Date</Label>
              <Input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData(prev => ({ ...prev, transaction_date: e.target.value }))}
              />
            </div>

            {/* Profit Preview */}
            {(formData.cost_price || formData.selling_price) && (
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <span className="text-sm text-muted-foreground">Profit: </span>
                <span className={`font-bold ${
                  (formData.selling_price || 0) - (formData.cost_price || 0) >= 0 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {formatPrice((formData.selling_price || 0) - (formData.cost_price || 0))}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.category || !formData.description || createService.isPending}
            >
              {createService.isPending ? 'Saving...' : 'Log Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesPartsTab;
