import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  User,
  MapPin,
  Users,
  Wallet,
  Shield,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import AdminLayout from '@/components/admin/AdminLayout';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, title: 'Client Info', icon: UserPlus },
  { id: 2, title: 'Personal Details', icon: User },
  { id: 3, title: 'Address & Employment', icon: MapPin },
  { id: 4, title: 'Next of Kin', icon: Users },
  { id: 5, title: 'Financials', icon: Wallet },
  { id: 6, title: 'Finalize', icon: Shield },
];

const AdminCreateApplication = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillData = location.state as { prefillEmail?: string; prefillPhone?: string; prefillName?: string } | null;
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    // Client Contact (Step 1 - Admin Only)
    client_email: '',
    client_phone: '',
    // Personal
    first_name: '',
    last_name: '',
    id_number: '',
    marital_status: '',
    gender: '',
    qualification: '',
    // Address
    street_address: '',
    area_code: '',
    // Employment
    employer_name: '',
    job_title: '',
    employment_period: '',
    // Next of Kin
    kin_name: '',
    kin_contact: '',
    // Banking
    bank_name: '',
    account_type: '',
    account_number: '',
    // Financials
    gross_salary: '',
    net_salary: '',
    expenses_summary: '',
    // Consent
    popia_consent: false,
    // Preferred Vehicle
    preferred_vehicle_text: '',
    // Anti-Time Wasting
    has_drivers_license: '',
    credit_score_status: '',
    // Notes
    admin_notes: '',
  });

  // Prefill from navigation state if coming from CRM
  useEffect(() => {
    if (prefillData) {
      setFormData(prev => ({
        ...prev,
        client_email: prefillData.prefillEmail || '',
        client_phone: prefillData.prefillPhone || '',
        first_name: prefillData.prefillName?.split(' ')[0] || '',
        last_name: prefillData.prefillName?.split(' ').slice(1).join(' ') || '',
      }));
    }
  }, [prefillData]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.client_email || !formData.client_phone) {
          toast.error('Client email and phone are required');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.client_email)) {
          toast.error('Please enter a valid email address');
          return false;
        }
        if (!/^0\d{9}$/.test(formData.client_phone)) {
          toast.error('Phone must be 10 digits starting with 0');
          return false;
        }
        return true;
      case 2:
        if (!formData.first_name || !formData.last_name) {
          toast.error('First name and last name are required');
          return false;
        }
        return true;
      case 3:
        if (!formData.street_address || !formData.employer_name) {
          toast.error('Address and employer name are required');
          return false;
        }
        return true;
      case 4:
        if (!formData.kin_name || !formData.kin_contact) {
          toast.error('Next of kin details are required');
          return false;
        }
        if (!/^0\d{9}$/.test(formData.kin_contact)) {
          toast.error('Next of kin phone must be 10 digits starting with 0');
          return false;
        }
        return true;
      case 5:
        if (!formData.bank_name || !formData.gross_salary || !formData.net_salary || !formData.expenses_summary) {
          toast.error('Bank name, salaries, and expenses are required');
          return false;
        }
        return true;
      case 6:
        if (!formData.popia_consent) {
          toast.error('POPIA consent is required');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 6));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setIsSubmitting(true);

    try {
      // Check if a profile/user exists for this email
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, user_id, full_name')
        .eq('email', formData.client_email.toLowerCase().trim())
        .maybeSingle();

      // If existing user found, notify admin
      if (existingProfile) {
        toast.info(`Existing client found: ${existingProfile.full_name || 'Unknown'}. Application will be linked to their profile.`);
      }

      // Use existing user_id if found, otherwise use shadow ID
      const userId = existingProfile?.user_id || '00000000-0000-0000-0000-000000000000';

      // Prepare the application data
      const applicationData = {
        user_id: userId,
        full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.client_email.trim().toLowerCase(),
        phone: formData.client_phone.trim(),
        id_number: formData.id_number?.trim() || null,
        marital_status: formData.marital_status || null,
        gender: formData.gender || null,
        qualification: formData.qualification || null,
        street_address: formData.street_address.trim(),
        area_code: formData.area_code?.trim() || null,
        employer_name: formData.employer_name.trim(),
        job_title: formData.job_title?.trim() || null,
        employment_period: formData.employment_period || null,
        kin_name: formData.kin_name.trim(),
        kin_contact: formData.kin_contact.trim(),
        bank_name: formData.bank_name,
        account_type: formData.account_type || null,
        account_number: formData.account_number?.trim() || null,
        gross_salary: formData.gross_salary ? parseFloat(formData.gross_salary) : null,
        net_salary: formData.net_salary ? parseFloat(formData.net_salary) : null,
        expenses_summary: formData.expenses_summary?.trim() || null,
        popia_consent: formData.popia_consent,
        preferred_vehicle_text: formData.preferred_vehicle_text?.trim() || null,
        has_drivers_license: formData.has_drivers_license === 'yes',
        credit_score_status: formData.credit_score_status || 'unsure',
        notes: formData.admin_notes?.trim() || 'Created by Admin on behalf of client',
        status: 'pending',
      };

      const { error } = await supabase
        .from('finance_applications')
        .insert(applicationData as any);

      if (error) {
        console.error('Submission error:', error);
        toast.error('Failed to create application');
        return;
      }

      // Also create a lead entry if this is a new client (no existing profile)
      if (!existingProfile) {
        await supabase.from('leads').insert({
          client_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
          client_email: formData.client_email.trim().toLowerCase(),
          client_phone: formData.client_phone.trim(),
          source: 'Admin Created',
          status: 'new',
          notes: `Application created by admin. ${formData.admin_notes || ''}`,
        } as any);
      }

      toast.success(existingProfile 
        ? `Application linked to existing client: ${existingProfile.full_name || formData.first_name}` 
        : 'Application created successfully!'
      );
      navigate('/admin/finance');
    } catch (err) {
      console.error('Error creating application:', err);
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Create Application | Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="p-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Button variant="ghost" onClick={() => navigate('/admin/finance')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-semibold">Create Application</h1>
          <p className="text-muted-foreground">Submit a finance application on behalf of a client</p>
        </motion.div>

        <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
          <UserPlus className="w-4 h-4" />
          <AlertDescription className="text-amber-200">
            This application will be linked to the client's email. If they already have an account, it will appear in their dashboard.
          </AlertDescription>
        </Alert>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8 relative">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-border -z-10" />
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isComplete = currentStep > step.id;
            return (
              <div key={step.id} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isComplete ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs mt-2 hidden sm:block ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Form Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-8"
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Client Contact Info */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold mb-4">Client Contact Information</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Enter the client's email and phone. This will be used to link the application to their account if they have one.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_email">Client Email *</Label>
                    <Input
                      id="client_email"
                      type="email"
                      value={formData.client_email}
                      onChange={(e) => handleInputChange('client_email', e.target.value)}
                      placeholder="client@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_phone">Client Phone *</Label>
                    <Input
                      id="client_phone"
                      type="tel"
                      value={formData.client_phone}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                        handleInputChange('client_phone', cleaned);
                      }}
                      placeholder="0721234567"
                      maxLength={10}
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Personal Details */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold mb-4">Personal Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Surname *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="id_number">ID Number</Label>
                    <Input
                      id="id_number"
                      value={formData.id_number}
                      onChange={(e) => handleInputChange('id_number', e.target.value)}
                      placeholder="e.g., 9001015009087"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Marital Status</Label>
                    <Select value={formData.marital_status} onValueChange={(v) => handleInputChange('marital_status', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={formData.gender} onValueChange={(v) => handleInputChange('gender', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Has Driver's License?</Label>
                    <Select value={formData.has_drivers_license} onValueChange={(v) => handleInputChange('has_drivers_license', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Credit Status</Label>
                    <Select value={formData.credit_score_status} onValueChange={(v) => handleInputChange('credit_score_status', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good (No defaults)</SelectItem>
                        <SelectItem value="unsure">Not Sure</SelectItem>
                        <SelectItem value="bad">Bad (Has defaults)</SelectItem>
                        <SelectItem value="blacklisted">Blacklisted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Qualification</Label>
                    <Select value={formData.qualification} onValueChange={(v) => handleInputChange('qualification', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="matric">Matric</SelectItem>
                        <SelectItem value="diploma">Diploma</SelectItem>
                        <SelectItem value="degree">Degree</SelectItem>
                        <SelectItem value="postgraduate">Postgraduate</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Address & Employment */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold mb-4">Address & Employment</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Physical Address *</Label>
                    <AddressAutocomplete
                      value={formData.street_address}
                      onChange={(value) => handleInputChange('street_address', value)}
                      onPostalCodeChange={(code) => handleInputChange('area_code', code)}
                      placeholder="Start typing address..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Area/Postal Code</Label>
                    <Input
                      value={formData.area_code}
                      onChange={(e) => handleInputChange('area_code', e.target.value)}
                      placeholder="e.g., 2000"
                    />
                  </div>
                </div>
                <div className="border-t border-border pt-6">
                  <h3 className="font-medium mb-4">Employment Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Employer Name *</Label>
                      <Input
                        value={formData.employer_name}
                        onChange={(e) => handleInputChange('employer_name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Job Title</Label>
                      <Input
                        value={formData.job_title}
                        onChange={(e) => handleInputChange('job_title', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Period at Employer</Label>
                      <Input
                        value={formData.employment_period}
                        onChange={(e) => handleInputChange('employment_period', e.target.value)}
                        placeholder="e.g., 2 years"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Next of Kin */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold mb-4">Next of Kin</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Next of Kin Name *</Label>
                    <Input
                      value={formData.kin_name}
                      onChange={(e) => handleInputChange('kin_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Next of Kin Contact *</Label>
                    <Input
                      value={formData.kin_contact}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                        handleInputChange('kin_contact', cleaned);
                      }}
                      placeholder="0721234567"
                      maxLength={10}
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 5: Financials */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold mb-4">Financial Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name *</Label>
                    <Select value={formData.bank_name} onValueChange={(v) => handleInputChange('bank_name', v)}>
                      <SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ABSA">ABSA</SelectItem>
                        <SelectItem value="Capitec">Capitec</SelectItem>
                        <SelectItem value="FNB">FNB</SelectItem>
                        <SelectItem value="Nedbank">Nedbank</SelectItem>
                        <SelectItem value="Standard Bank">Standard Bank</SelectItem>
                        <SelectItem value="African Bank">African Bank</SelectItem>
                        <SelectItem value="TymeBank">TymeBank</SelectItem>
                        <SelectItem value="Discovery Bank">Discovery Bank</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select value={formData.account_type} onValueChange={(v) => handleInputChange('account_type', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="Savings">Savings</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input
                      value={formData.account_number}
                      onChange={(e) => handleInputChange('account_number', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gross Salary (R) *</Label>
                    <Input
                      type="number"
                      value={formData.gross_salary}
                      onChange={(e) => handleInputChange('gross_salary', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Net Salary (R) *</Label>
                    <Input
                      type="number"
                      value={formData.net_salary}
                      onChange={(e) => handleInputChange('net_salary', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Monthly Expenses Breakdown *</Label>
                  <Textarea
                    value={formData.expenses_summary}
                    onChange={(e) => handleInputChange('expenses_summary', e.target.value)}
                    placeholder="e.g., Rent: R5000, Car: R3000, Groceries: R2000..."
                    required
                  />
                </div>
              </motion.div>
            )}

            {/* Step 6: Finalize */}
            {currentStep === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold mb-4">Finalize Application</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Preferred Vehicle (Optional)</Label>
                    <Textarea
                      value={formData.preferred_vehicle_text}
                      onChange={(e) => handleInputChange('preferred_vehicle_text', e.target.value)}
                      placeholder="e.g., Looking for a 2020 VW Golf..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Admin Notes</Label>
                    <Textarea
                      value={formData.admin_notes}
                      onChange={(e) => handleInputChange('admin_notes', e.target.value)}
                      placeholder="Internal notes about this application..."
                    />
                  </div>
                  <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
                    <Checkbox
                      id="popia_consent"
                      checked={formData.popia_consent}
                      onCheckedChange={(checked) => handleInputChange('popia_consent', checked as boolean)}
                    />
                    <Label htmlFor="popia_consent" className="text-sm cursor-pointer">
                      Client has consented to POPIA (Protection of Personal Information Act)
                    </Label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Previous
            </Button>
            
            {currentStep < 6 ? (
              <Button onClick={nextStep}>
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.popia_consent}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? 'Creating...' : 'Create Application'}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
};

export default AdminCreateApplication;
