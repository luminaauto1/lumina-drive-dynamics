import { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Search, Phone, Mail, Heart, Eye, MessageCircle, Users, UserCheck, Snowflake, Flame, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCRM, CRMProfile } from '@/hooks/useCRM';
import ClientGenomeDrawer from '@/components/admin/ClientGenomeDrawer';

const AdminLeads = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProfile, setSelectedProfile] = useState<CRMProfile | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: profiles = [], isLoading } = useCRM();

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = !searchQuery || 
      profile.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.phone?.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || profile.internal_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleRowClick = (profile: CRMProfile) => {
    setSelectedProfile(profile);
    setIsDrawerOpen(true);
  };

  const getInternalStatusBadge = (status: string) => {
    const config: Record<string, { className: string; icon: React.ReactNode }> = {
      new: { className: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Sparkles className="w-3 h-3" /> },
      contacted: { className: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: <Phone className="w-3 h-3" /> },
      warm: { className: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <Flame className="w-3 h-3" /> },
      cold: { className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: <Snowflake className="w-3 h-3" /> },
      converted: { className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <UserCheck className="w-3 h-3" /> },
    };

    const { className, icon } = config[status] || config.new;
    return (
      <Badge variant="outline" className={`${className} flex items-center gap-1`}>
        {icon}
        {status}
      </Badge>
    );
  };

  const getFinanceStatusBadge = (applications: CRMProfile['finance_applications']) => {
    if (applications.length === 0) {
      return <span className="text-muted-foreground text-sm">None</span>;
    }
    
    const latestApp = applications[0];
    const statusStyles: Record<string, string> = {
      pending: 'bg-gray-500/20 text-gray-400',
      'application_submitted': 'bg-blue-500/20 text-blue-400',
      'pre_approved': 'bg-purple-500/20 text-purple-400',
      'docs_received': 'bg-amber-500/20 text-amber-400',
      'validations_submitted': 'bg-orange-500/20 text-orange-400',
      'validations_complete': 'bg-teal-500/20 text-teal-400',
      'contract_sent': 'bg-indigo-500/20 text-indigo-400',
      'contract_signed': 'bg-cyan-500/20 text-cyan-400',
      'vehicle_delivered': 'bg-emerald-500/20 text-emerald-400',
    };

    const displayStatus = latestApp.status.replace(/_/g, ' ');
    return (
      <Badge className={`${statusStyles[latestApp.status] || statusStyles.pending} text-xs capitalize`}>
        {displayStatus}
      </Badge>
    );
  };

  const openWhatsApp = (phone: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  // Calculate stats
  const stats = {
    total: profiles.length,
    new: profiles.filter(p => p.internal_status === 'new').length,
    warm: profiles.filter(p => p.internal_status === 'warm').length,
    converted: profiles.filter(p => p.internal_status === 'converted').length,
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Client Command Center | Lumina Auto Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-semibold mb-2">Client Command Center</h1>
          <p className="text-muted-foreground">360° view of all users, leads, and interactions • Click a row to open Client Genome</p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col md:flex-row gap-4 mb-6"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="warm">Warm</SelectItem>
              <SelectItem value="cold">Cold</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Total Clients</p>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <p className="text-sm text-muted-foreground">New</p>
            </div>
            <p className="text-2xl font-bold text-blue-400">{stats.new}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-orange-400" />
              <p className="text-sm text-muted-foreground">Warm Leads</p>
            </div>
            <p className="text-2xl font-bold text-orange-400">{stats.warm}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <p className="text-sm text-muted-foreground">Converted</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{stats.converted}</p>
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
          ) : filteredProfiles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery || statusFilter !== 'all' ? 'No clients match your filters' : 'No clients yet'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableHead className="text-muted-foreground">Name / Contact</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Finance</TableHead>
                    <TableHead className="text-muted-foreground">Wishlist</TableHead>
                    <TableHead className="text-muted-foreground">Last Active</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile) => (
                    <TableRow 
                      key={profile.id} 
                      className="border-white/10 hover:bg-white/5 cursor-pointer"
                      onClick={() => handleRowClick(profile)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-semibold">{profile.full_name || 'Unknown'}</p>
                          <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                            {profile.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {profile.email}
                              </span>
                            )}
                            {profile.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {profile.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getInternalStatusBadge(profile.internal_status || 'new')}
                      </TableCell>
                      <TableCell>
                        {getFinanceStatusBadge(profile.finance_applications)}
                      </TableCell>
                      <TableCell>
                        {profile.wishlist_count > 0 ? (
                          <span className="flex items-center gap-1 text-pink-400">
                            <Heart className="w-4 h-4 fill-current" />
                            {profile.wishlist_count} Cars
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {profile.last_active_at 
                          ? formatDistanceToNow(new Date(profile.last_active_at), { addSuffix: true })
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {profile.phone && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => openWhatsApp(profile.phone, e)}
                              className="text-emerald-400 hover:text-emerald-300"
                              title="Open WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRowClick(profile)}
                            className="text-blue-400 hover:text-blue-300"
                            title="View Client Genome"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Client Genome Drawer */}
      <ClientGenomeDrawer 
        profile={selectedProfile}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
    </AdminLayout>
  );
};

export default AdminLeads;
