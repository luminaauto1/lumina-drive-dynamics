import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Heart, FileText, User, LogOut, Car, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import VehicleCard from '@/components/VehicleCard';
import KineticText from '@/components/KineticText';
import SkeletonCard from '@/components/SkeletonCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useVehicles } from '@/hooks/useVehicles';
import { useUserApplicationMatches } from '@/hooks/useApplicationMatches';
import { USER_STATUS_LABELS, STATUS_STYLES } from '@/lib/statusConfig';
import { toast } from 'sonner';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '' });
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const { data: matchedVehicles = [], isLoading: matchesLoading } = useUserApplicationMatches(user?.id || '');

  // Check if user has an approved application
  const hasApprovedApplication = applications.some(app => app.status === 'approved');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchProfile();
    fetchWishlist();
    fetchApplications();
  }, [user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setProfile({
        full_name: data.full_name || '',
        email: data.email || user.email || '',
        phone: data.phone || '',
      });
    }
  };

  const fetchWishlist = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wishlists')
      .select('vehicle_id')
      .eq('user_id', user.id);

    if (data) {
      setWishlistIds(data.map((w) => w.vehicle_id));
    }
  };

  const fetchApplications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('finance_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setApplications(data);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsUpdating(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
      })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated successfully');
    }
    setIsUpdating(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Get wishlist vehicles from database
  const wishlistVehicles = vehicles.filter((v) =>
    wishlistIds.includes(v.id)
  );

  // Get curated vehicles from matches
  const curatedVehicles = matchedVehicles
    .filter((m: any) => m.vehicles)
    .map((m: any) => m.vehicles);

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>My Account | Lumina Auto</title>
      </Helmet>

      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                <KineticText>My Account</KineticText>
              </h1>
              <p className="text-muted-foreground">
                Welcome back, {profile.full_name || user.email}
              </p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Curated Vehicles Section - Show when user has approved application and matched vehicles */}
          {hasApprovedApplication && curatedVehicles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="glass-card rounded-xl p-6 border-2 border-primary/30 bg-primary/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Your Curated Options</h2>
                    <p className="text-sm text-muted-foreground">
                      These vehicles have been specially selected to match your confirmed budget
                    </p>
                  </div>
                </div>

                {matchesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <SkeletonCard count={3} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {curatedVehicles.map((vehicle: any) => (
                      <VehicleCard key={vehicle.id} vehicle={vehicle} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <Tabs defaultValue="applications" className="space-y-8">
            <TabsList className="glass-card">
              <TabsTrigger value="applications" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileText className="w-4 h-4 mr-2" />
                Applications
              </TabsTrigger>
              <TabsTrigger value="saved" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Heart className="w-4 h-4 mr-2" />
                Saved Cars
              </TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <User className="w-4 h-4 mr-2" />
                Profile
              </TabsTrigger>
            </TabsList>

            <TabsContent value="applications">
              {applications.length > 0 ? (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card rounded-xl p-6"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">Finance Application</h3>
                          <p className="text-sm text-muted-foreground">
                            Submitted: {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${STATUS_STYLES[app.status] || STATUS_STYLES.pending}`}
                        >
                          {USER_STATUS_LABELS[app.status] || app.status}
                        </span>
                      </div>
                      
                      {/* Show curated options message when approved */}
                      {app.status === 'approved' && curatedVehicles.length > 0 && (
                        <Alert className="mt-4 bg-primary/10 border-primary/30">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <AlertTitle className="text-primary">Vehicle Options Ready</AlertTitle>
                          <AlertDescription>
                            We have selected {curatedVehicles.length} vehicle{curatedVehicles.length === 1 ? '' : 's'} that match your budget perfectly. View them above!
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {/* Show declined reason if application was declined */}
                      {app.status === 'declined' && app.declined_reason && (
                        <Alert variant="destructive" className="mt-4 bg-red-500/10 border-red-500/30">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Reason for Decline</AlertTitle>
                          <AlertDescription>
                            {app.declined_reason}
                          </AlertDescription>
                        </Alert>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 glass-card rounded-xl"
                >
                  <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-2xl font-semibold mb-2">No applications yet</h2>
                  <p className="text-muted-foreground mb-6">
                    Apply for finance to unlock your buying power
                  </p>
                  <Link to="/finance-application">
                    <Button className="bg-accent text-accent-foreground">
                      Start Application
                    </Button>
                  </Link>
                </motion.div>
              )}
            </TabsContent>

            <TabsContent value="saved">
              {vehiclesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <SkeletonCard count={3} />
                </div>
              ) : wishlistVehicles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wishlistVehicles.map((vehicle) => (
                    <VehicleCard key={vehicle.id} vehicle={vehicle} />
                  ))}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 glass-card rounded-xl"
                >
                  <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-2xl font-semibold mb-2">No saved cars yet</h2>
                  <p className="text-muted-foreground mb-6">
                    Start exploring and save your favorite vehicles
                  </p>
                  <Link to="/inventory">
                    <Button className="bg-accent text-accent-foreground">
                      <Car className="w-4 h-4 mr-2" />
                      Browse Inventory
                    </Button>
                  </Link>
                </motion.div>
              )}
            </TabsContent>

            <TabsContent value="profile">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-xl"
              >
                <form onSubmit={updateProfile} className="glass-card rounded-xl p-8 space-y-6">
                  <h2 className="text-2xl font-bold">Update Profile</h2>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={profile.full_name}
                      onChange={(e) =>
                        setProfile({ ...profile, full_name: e.target.value })
                      }
                      className="glass-card border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={profile.email}
                      disabled
                      className="glass-card border-border opacity-50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profile.phone}
                      onChange={(e) =>
                        setProfile({ ...profile, phone: e.target.value })
                      }
                      placeholder="+27 00 000 0000"
                      className="glass-card border-border"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isUpdating}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {isUpdating ? 'Updating...' : 'Save Changes'}
                  </Button>
                </form>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
