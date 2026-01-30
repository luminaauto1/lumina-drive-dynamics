import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Heart, FileText, User, LogOut, Car, AlertTriangle, Sparkles, HelpCircle, ChevronDown, Edit3, Trash2, Upload, ShoppingCart, FileSignature, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import VehicleCard from '@/components/VehicleCard';
import KineticText from '@/components/KineticText';
import SkeletonCard from '@/components/SkeletonCard';
import FinanceProgressStepper from '@/components/FinanceProgressStepper';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useVehicles } from '@/hooks/useVehicles';
import { useUserApplicationMatches } from '@/hooks/useApplicationMatches';
import { USER_STATUS_LABELS, STATUS_STYLES } from '@/lib/statusConfig';
import { toast } from 'sonner';

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '' });
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSelectingVehicle, setIsSelectingVehicle] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);

  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const { data: matchedVehicles = [], isLoading: matchesLoading, refetch: refetchMatches } = useUserApplicationMatches(user?.id || '');

  // Check if user needs to upload documents (pre_approved status)
  const preApprovedApplication = applications.find(app => app.status === 'pre_approved');
  const needsDocumentUpload = !!preApprovedApplication;
  
  // Check if user has budget confirmed (approved status) - can select vehicle
  const approvedApplication = applications.find(app => app.status === 'approved');
  const canSelectVehicle = !!approvedApplication;
  
  // Check if user has already selected a vehicle
  const vehicleSelectedApplication = applications.find(app => app.status === 'vehicle_selected');
  const hasSelectedVehicle = !!vehicleSelectedApplication;
  
  // Check if user has contract to sign
  const contractSentApplication = applications.find(app => app.status === 'contract_sent');
  const hasContractToSign = !!contractSentApplication;
  
  // Get the main active application for stepper
  const activeApplication = applications.find(app => 
    !['draft', 'archived', 'declined'].includes(app.status)
  );

  // Check for draft applications
  const draftApplications = applications.filter(app => app.status === 'draft');
  const hasDraftApplications = draftApplications.length > 0;

  // Calculate draft application progress
  const getDraftProgress = (app: any) => {
    const step1Fields = ['full_name', 'email', 'phone', 'id_number'];
    const step2Fields = ['employment_status', 'employer_name', 'gross_salary', 'net_salary'];
    const step3Fields = ['kin_name', 'kin_contact', 'bank_name', 'account_type', 'account_number'];
    const step4Fields = ['expenses_summary', 'popia_consent'];
    
    const countFilled = (fields: string[]) => fields.filter(f => app[f]).length;
    
    const step1Done = countFilled(step1Fields) === step1Fields.length;
    const step2Done = countFilled(step2Fields) === step2Fields.length;
    const step3Done = countFilled(step3Fields) === step3Fields.length;
    const step4Done = countFilled(step4Fields) === step4Fields.length;
    
    if (step4Done) return { step: 4, progress: 100 };
    if (step3Done) return { step: 3, progress: 75 };
    if (step2Done) return { step: 2, progress: 50 };
    if (step1Done) return { step: 1, progress: 25 };
    return { step: 0, progress: Math.max(10, (countFilled(step1Fields) / step1Fields.length) * 25) };
  };

  const handleDeleteDraft = async () => {
    if (!deletingDraftId) return;
    
    const { error } = await supabase
      .from('finance_applications')
      .delete()
      .eq('id', deletingDraftId);
    
    if (error) {
      toast.error('Failed to delete draft');
    } else {
      toast.success('Draft deleted');
      fetchApplications();
    }
    setDeletingDraftId(null);
  };

  useEffect(() => {
    // Don't redirect while loading - wait for auth state to resolve
    if (loading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchProfile();
    fetchWishlist();
    fetchApplications();
  }, [user, navigate, loading]);

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

  const handleSelectVehicle = async (vehicleId: string) => {
    if (!approvedApplication) return;
    
    setIsSelectingVehicle(true);
    const { error } = await supabase
      .from('finance_applications')
      .update({ 
        selected_vehicle_id: vehicleId,
        status: 'vehicle_selected'
      })
      .eq('id', approvedApplication.id);

    if (error) {
      toast.error('Failed to select vehicle. Please try again.');
      console.error('Selection error:', error);
    } else {
      toast.success('Vehicle reserved! We are preparing your contract.');
      // Refresh applications to show updated status
      fetchApplications();
    }
    setIsSelectingVehicle(false);
  };

  // Get wishlist vehicles from database
  const wishlistVehicles = vehicles.filter((v) =>
    wishlistIds.includes(v.id)
  );

  // Get curated vehicles from matches
  const curatedVehicles = matchedVehicles
    .filter((m: any) => m.vehicles)
    .map((m: any) => m.vehicles);
  
  // Get the selected vehicle details if any
  const selectedVehicle = vehicleSelectedApplication?.selected_vehicle_id 
    ? vehicles.find(v => v.id === vehicleSelectedApplication.selected_vehicle_id)
    : null;

  if (loading || !user) return null;

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

          {/* Pre-Approved: Upload Documents Section */}
          {needsDocumentUpload && preApprovedApplication && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="glass-card rounded-xl p-6 border-2 border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20 animate-pulse">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="inline-block px-3 py-1 mb-1 text-xs font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full">
                      Bank Requires Documents
                    </span>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
                      You're Pre-Approved!
                    </h2>
                  </div>
                </div>

                <p className="text-muted-foreground mb-6">
                  Congratulations! To proceed with your finance application, please upload the required documents.
                </p>

                <div className="bg-background/50 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold mb-3">Required Documents:</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                      ID Card / Passport
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                      Driver's License
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                      Latest 3 Months Payslips
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                      Latest 3 Months Bank Statements
                    </li>
                  </ul>
                </div>

                <Link to={`/upload-documents/${preApprovedApplication.access_token}`}>
                  <Button size="lg" className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
                    <Upload className="w-5 h-5 mr-2" />
                    Upload Documents Now
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Approved: Select Your Vehicle Section */}
          {canSelectVehicle && !hasSelectedVehicle && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="glass-card rounded-xl p-6 border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <ShoppingCart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="inline-block px-3 py-1 mb-1 text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                      Budget Confirmed
                    </span>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">
                      Select Your Vehicle
                    </h2>
                  </div>
                </div>

                <p className="text-muted-foreground mb-6">
                  Your finance has been approved! Browse our inventory and select the car you want. Click "I want this car" on any vehicle to reserve it.
                </p>

                {approvedApplication?.approved_budget && (
                  <div className="bg-background/50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-muted-foreground">Your Approved Budget:</p>
                    <p className="text-3xl font-bold text-emerald-400">
                      R {approvedApplication.approved_budget.toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Show curated vehicles if available */}
                {curatedVehicles.length > 0 ? (
                  <>
                    <h3 className="text-lg font-semibold mb-4 text-amber-400 flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Vehicles Selected For You
                    </h3>
                    {matchesLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <SkeletonCard count={3} />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                        {curatedVehicles.map((vehicle: any) => (
                          <div key={vehicle.id} className="relative">
                            <VehicleCard vehicle={vehicle} />
                            <Button
                              onClick={() => handleSelectVehicle(vehicle.id)}
                              disabled={isSelectingVehicle}
                              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700"
                            >
                              {isSelectingVehicle ? 'Selecting...' : 'I Want This Car'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-muted-foreground mb-3">Or browse all available vehicles:</p>
                      <Link to="/inventory">
                        <Button variant="outline" size="lg" className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10">
                          <Car className="w-5 h-5 mr-2" />
                          View Full Inventory
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <Link to="/inventory">
                    <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Car className="w-5 h-5 mr-2" />
                      Select Your Vehicle
                    </Button>
                  </Link>
                )}
              </div>
            </motion.div>
          )}

          {/* Vehicle Reserved Section - Show when user has selected a vehicle */}
          {hasSelectedVehicle && selectedVehicle && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="glass-card rounded-xl p-6 border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/10 to-purple-600/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Car className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="inline-block px-3 py-1 mb-1 text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full">
                      Vehicle Reserved
                    </span>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">
                      Preparing Your Contract
                    </h2>
                  </div>
                </div>

                <div className="bg-background/50 rounded-lg p-4 flex items-center gap-4">
                  {selectedVehicle.images?.[0] && (
                    <img 
                      src={selectedVehicle.images[0]} 
                      alt={`${selectedVehicle.make} ${selectedVehicle.model}`}
                      className="w-24 h-16 rounded object-cover"
                    />
                  )}
                  <div>
                    <p className="font-semibold text-lg">
                      {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                    </p>
                    <p className="text-muted-foreground">{selectedVehicle.variant}</p>
                  </div>
                </div>

                <Alert className="mt-4 bg-purple-500/10 border-purple-500/30">
                  <Car className="h-4 w-4 text-purple-400" />
                  <AlertTitle className="text-purple-400">Next Steps</AlertTitle>
                  <AlertDescription>
                    Our team is preparing your contract and will contact you shortly via WhatsApp to finalize the deal.
                  </AlertDescription>
                </Alert>
              </div>
            </motion.div>
          )}

          {/* Contract Signing Section - Show when contract_sent */}
          {hasContractToSign && contractSentApplication && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="glass-card rounded-xl p-6 border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-pulse">
                    <FileSignature className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="inline-block px-3 py-1 mb-1 text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full">
                      Action Required
                    </span>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-indigo-200 bg-clip-text text-transparent">
                      Sign Your Contract
                    </h2>
                  </div>
                </div>

                <p className="text-muted-foreground mb-6">
                  Your finance contract with <span className="font-semibold text-foreground">{(contractSentApplication as any).contract_bank_name || 'our partner bank'}</span> is ready for signing!
                </p>

                {(contractSentApplication as any).contract_url ? (
                  <a 
                    href={(contractSentApplication as any).contract_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button size="lg" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                      <FileSignature className="w-5 h-5" />
                      Go to Signing Page
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                ) : (
                  <Alert className="bg-indigo-500/10 border-indigo-500/30">
                    <FileSignature className="h-4 w-4 text-indigo-400" />
                    <AlertTitle className="text-indigo-400">Signing Link Coming Soon</AlertTitle>
                    <AlertDescription>
                      Our team will share the signing link with you shortly via WhatsApp or email.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </motion.div>
          )}

          {/* Resume Draft Application Section */}
          {hasDraftApplications && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="glass-card rounded-xl p-6 border-2 border-blue-500/40 bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Edit3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="inline-block px-3 py-1 mb-1 text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                      Continue Where You Left Off
                    </span>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent">
                      Resume Your Application
                    </h2>
                  </div>
                </div>

                <div className="space-y-4">
                  {draftApplications.map((draft) => {
                    const { step, progress } = getDraftProgress(draft);
                    return (
                      <div key={draft.id} className="bg-background/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold">Finance Application Draft</p>
                            <p className="text-sm text-muted-foreground">
                              Started: {new Date(draft.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Step {step + 1} of 5
                          </span>
                        </div>
                        
                        <div className="mb-4">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Progress</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            asChild 
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                          >
                            <Link to={`/finance-application?resume=${draft.id}`}>
                              <Edit3 className="w-4 h-4 mr-2" />
                              Continue Application
                            </Link>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => setDeletingDraftId(draft.id)}
                            className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Alert className="mt-4 bg-blue-500/10 border-blue-500/30">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <AlertTitle className="text-blue-400">Your Progress is Saved</AlertTitle>
                  <AlertDescription>
                    Don't worry – all your information has been saved. Click "Continue Application" to pick up right where you left off.
                  </AlertDescription>
                </Alert>
              </div>
            </motion.div>
          )}

          {/* Delete Draft Confirmation Dialog */}
          <AlertDialog open={!!deletingDraftId} onOpenChange={() => setDeletingDraftId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Draft Application?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your draft application and all saved progress. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteDraft}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Draft
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
                      <div className="flex items-center justify-between mb-4">
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
                      
                      {/* Progress Stepper */}
                      {!['draft', 'archived'].includes(app.status) && (
                        <div className="mb-4">
                          <FinanceProgressStepper currentStatus={app.status} />
                        </div>
                      )}
                      
                      {/* Upload Documents Button for Pre-Approved */}
                      {app.status === 'pre_approved' && app.access_token && (
                        <Link to={`/upload-documents/${app.access_token}`}>
                          <Button className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700">
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Required Documents
                          </Button>
                        </Link>
                      )}
                      
                      {/* Select Vehicle button for approved */}
                      {app.status === 'approved' && (
                        <Link to="/inventory">
                          <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">
                            <Car className="w-4 h-4 mr-2" />
                            Select Your Vehicle
                          </Button>
                        </Link>
                      )}
                      
                      {/* Show declined reason if application was declined */}
                      {app.status === 'declined' && (
                        <>
                          {app.declined_reason && (
                            <Alert variant="destructive" className="mt-4 bg-red-500/10 border-red-500/30">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>Reason for Decline</AlertTitle>
                              <AlertDescription>
                                {app.declined_reason}
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          {/* Road to Recovery Card */}
                          <Collapsible className="mt-4">
                            <div className="glass-card rounded-lg p-4 border border-amber-500/30 bg-amber-500/5">
                              <CollapsibleTrigger className="w-full flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <HelpCircle className="w-5 h-5 text-amber-400" />
                                  <span className="font-semibold text-amber-400">Road to Recovery</span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="pt-4">
                                <p className="text-sm text-muted-foreground mb-3">What to do now:</p>
                                <ol className="space-y-2 text-sm text-muted-foreground">
                                  <li className="flex items-start gap-2">
                                    <span className="font-bold text-foreground">1.</span>
                                    <span>Do not apply for more credit for at least 3 months.</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="font-bold text-foreground">2.</span>
                                    <span>Ensure all current accounts are up to date with payments.</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="font-bold text-foreground">3.</span>
                                    <span>Check your credit report for errors at <a href="https://www.clearscore.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">ClearScore</a>.</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="font-bold text-foreground">4.</span>
                                    <span>Consider a cash purchase or larger deposit in the future.</span>
                                  </li>
                                </ol>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        </>
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
