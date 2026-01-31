import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSellCarRequests, SellCarRequest } from '@/hooks/useSellCarRequests';
import { formatPrice } from '@/lib/formatters';
import { format } from 'date-fns';
import { 
  Car, Phone, Mail, Calendar, Image, MessageSquare, 
  Eye, CheckCircle, XCircle, Loader2, ShoppingCart, Clock
} from 'lucide-react';

const AdminCarsToBuy = () => {
  const { requests, isLoading, updateRequest, newRequests, contactedRequests, purchasedRequests } = useSellCarRequests();
  const [selectedRequest, setSelectedRequest] = useState<SellCarRequest | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const statusColors: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    contacted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    purchased: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const filteredRequests = filterStatus === 'all' 
    ? requests 
    : requests.filter(r => r.status === filterStatus);

  const openDetails = (request: SellCarRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_notes || '');
    setDetailsOpen(true);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    await updateRequest.mutateAsync({ id, status: newStatus });
  };

  const handleSaveNotes = async () => {
    if (!selectedRequest) return;
    await updateRequest.mutateAsync({ id: selectedRequest.id, admin_notes: adminNotes });
    setNotesModalOpen(false);
  };

  const openWhatsApp = (phone: string, vehicleMake: string, vehicleModel: string) => {
    const message = `Hi! I'm from Lumina Auto. Thank you for submitting your ${vehicleMake} ${vehicleModel} for valuation. I'd like to discuss it further. When would be a good time to chat?`;
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Cars To Buy</h1>
          <p className="text-muted-foreground">
            Manage vehicle submissions from sellers
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">New</p>
                  <p className="text-2xl font-bold text-blue-400">{newRequests}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Contacted</p>
                  <p className="text-2xl font-bold text-amber-400">{contactedRequests}</p>
                </div>
                <Phone className="h-8 w-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Purchased</p>
                  <p className="text-2xl font-bold text-green-400">{purchasedRequests}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-purple-400">{requests.length}</p>
                </div>
                <Car className="h-8 w-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="purchased">Purchased</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {filteredRequests.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Car className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Submissions Yet</h3>
              <p className="text-muted-foreground text-center">
                Seller submissions will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="hidden md:table-cell">Price</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden sm:table-cell">Photos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(request.created_at), 'dd MMM')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.vehicle_make} {request.vehicle_model}</p>
                          <p className="text-sm text-muted-foreground">
                            {request.vehicle_year || 'N/A'} • {request.vehicle_mileage ? `${request.vehicle_mileage.toLocaleString()} km` : 'N/A'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {request.desired_price ? formatPrice(request.desired_price) : '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.client_name}</p>
                          <p className="text-sm text-muted-foreground">{request.client_contact}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <Image className="h-4 w-4 text-muted-foreground" />
                          <span>{request.photos_urls?.length || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[request.status] || statusColors.new}>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDetails(request)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openWhatsApp(request.client_contact, request.vehicle_make, request.vehicle_model)}
                            title="WhatsApp"
                            className="text-green-400 hover:text-green-300"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      {/* Details Sheet */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedRequest && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  {selectedRequest.vehicle_make} {selectedRequest.vehicle_model}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-6">
                {/* Status Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={selectedRequest.status === 'contacted' ? 'default' : 'outline'}
                    onClick={() => handleStatusChange(selectedRequest.id, 'contacted')}
                  >
                    <Phone className="h-4 w-4 mr-1" /> Mark Contacted
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedRequest.status === 'purchased' ? 'default' : 'outline'}
                    className={selectedRequest.status === 'purchased' ? 'bg-green-600' : ''}
                    onClick={() => handleStatusChange(selectedRequest.id, 'purchased')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Purchased
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-400"
                    onClick={() => handleStatusChange(selectedRequest.id, 'rejected')}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>

                {/* Vehicle Details */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-medium">Vehicle Details</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Make</p>
                        <p className="font-medium">{selectedRequest.vehicle_make}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Model</p>
                        <p className="font-medium">{selectedRequest.vehicle_model}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Year</p>
                        <p className="font-medium">{selectedRequest.vehicle_year || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Mileage</p>
                        <p className="font-medium">{selectedRequest.vehicle_mileage ? `${selectedRequest.vehicle_mileage.toLocaleString()} km` : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Condition</p>
                        <p className="font-medium">{selectedRequest.condition || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Asking Price</p>
                        <p className="font-medium text-primary">
                          {selectedRequest.desired_price ? formatPrice(selectedRequest.desired_price) : 'Not specified'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Client Details */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-medium">Client Details</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${selectedRequest.client_contact}`} className="text-primary hover:underline">
                          {selectedRequest.client_contact}
                        </a>
                      </div>
                      {selectedRequest.client_email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${selectedRequest.client_email}`} className="text-primary hover:underline">
                            {selectedRequest.client_email}
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Submitted {format(new Date(selectedRequest.created_at), 'dd MMM yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                    <Button
                      className="w-full mt-4 bg-green-600 hover:bg-green-700"
                      onClick={() => openWhatsApp(selectedRequest.client_contact, selectedRequest.vehicle_make, selectedRequest.vehicle_model)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" /> WhatsApp Client
                    </Button>
                  </CardContent>
                </Card>

                {/* Photos */}
                {selectedRequest.photos_urls && selectedRequest.photos_urls.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Photos ({selectedRequest.photos_urls.length})
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedRequest.photos_urls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt={`Photo ${idx + 1}`}
                            className="w-full aspect-video object-cover rounded-lg hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Notes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">Admin Notes</h3>
                    <Button variant="ghost" size="sm" onClick={() => setNotesModalOpen(true)}>
                      Edit
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedRequest.admin_notes || 'No notes yet'}
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Notes Modal */}
      <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Admin Notes</DialogTitle>
          </DialogHeader>
          <div>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add notes about this submission..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNotes} disabled={updateRequest.isPending}>
              {updateRequest.isPending ? 'Saving...' : 'Save Notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCarsToBuy;
