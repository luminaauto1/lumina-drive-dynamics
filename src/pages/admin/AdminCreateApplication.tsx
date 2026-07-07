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
  Check,
  ChevronsUpDown,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import AdminLayout from '@/components/admin/AdminLayout';
import AddManualEntryModal from '@/components/admin/AddManualEntryModal';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
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
  const [manualEntryOpen, setManualEntryOpen] = useState(false);

  // Existing client lookup
  type ClientOption = {
    email: string;
    full_name: string | null;
    phone: string | null;
    latest_application_id: string;
  };
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [linkedClient, setLinkedClient] = useState<ClientOption | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);


  
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

  // Load distinct existing clients (most recent application per email)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('finance_applications')
        .select('id, email, full_name, phone, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) {
        console.warn('Client lookup load failed:', error.message);
        return;
      }
      const seen = new Set<string>();
      const unique: ClientOption[] = [];
      for (const row of data || []) {
        const email = (row.email || '').toLowerCase().trim();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        unique.push({
          email,
          full_name: row.full_name,
          phone: row.phone,
          latest_application_id: row.id,
        });
      }
      setClientOptions(unique);
    })();
  }, []);

  const hydrateFromClient = async (client: ClientOption) => {
    setIsHydrating(true);
    try {
      const { data, error } = await supabase
        .from('finance_applications')
        .select('*')
        .eq('id', client.latest_application_id)
        .maybeSingle();
      if (error || !data) {
        toast.error('Could not load client data');
        return;
      }
      setFormData((prev) => ({
        ...prev,
        client_email: (data.email || '').toLowerCase(),
        client_phone: data.phone || '',
        first_name: data.first_name || (data.full_name || '').split(' ')[0] || '',
        last_name: data.last_name || (data.full_name || '').split(' ').slice(1).join(' ') || '',
        id_number: data.id_number || '',
        marital_status: data.marital_status || '',
        gender: data.gender || '',
        qualification: data.qualification || '',
        street_address: data.street_address || '',
        area_code: data.area_code || '',
        employer_name: data.employer_name || '',
        job_title: data.job_title || '',
        employment_period: data.employment_period || '',
        kin_name: data.kin_name || '',
        kin_contact: data.kin_contact || '',
        bank_name: data.bank_name || '',
        account_type: data.account_type || '',
        account_number: data.account_number || '',
        gross_salary: data.gross_salary != null ? String(data.gross_salary) : '',
        net_salary: data.net_salary != null ? String(data.net_salary) : '',
        expenses_summary: data.expenses_summary || '',
        has_drivers_license: data.has_drivers_license === true ? 'yes' : data.has_drivers_license === false ? 'no' : '',
        credit_score_status: data.credit_score_status || '',
        preferred_vehicle_text: '',
        popia_consent: false,
        admin_notes: '',
      }));
      setLinkedClient(client);
      setLookupOpen(false);
      toast.success(`Loaded data for ${client.full_name || client.email}. All fields are editable.`);
    } finally {
      setIsHydrating(false);
    }
  };

  const clearLinkedClient = () => {
    setLinkedClient(null);
    setFormData({
      client_email: '', client_phone: '', first_name: '', last_name: '',
      id_number: '', marital_status: '', gender: '', qualification: '',
      street_address: '', area_code: '', employer_name: '', job_title: '',
      employment_period: '', kin_name: '', kin_contact: '',
      bank_name: '', account_type: '', account_number: '',
      gross_salary: '', net_salary: '', expenses_summary: '',
      popia_consent: false, preferred_vehicle_text: '',
      has_drivers_license: '', credit_score_status: '', admin_notes: '',
    });
    toast.info('Form reset');
  };

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
        // Relaxed phone validation - allow various formats
        const phoneDigits = formData.client_phone.replace(/\D/g, '');
        if (phoneDigits.length < 9 || phoneDigits.length > 12) {
          toast.error('Phone number must be 9-12 digits');
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
        if (!formData.kin_name || !formData.kin_contact) {
          toast.error('Next of kin details are required');
          return false;
        }
        // Relaxed kin phone validation
        const kinPhoneDigits = formData.kin_contact.replace(/\D/g, '');
        if (kinPhoneDigits.length < 9 || kinPhoneDigits.length > 12) {
          toast.error('Next of kin phone must be 9-12 digits');
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

  // Helper to sanitize numeric values (strips R, spaces, commas)
  const sanitizeNumeric = (value: string): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/[R\s,]/gi, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setIsSubmitting(true);

    try {
      // Check if a profile/user exists for this email
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name')
        .eq('email', formData.client_email.toLowerCase().trim())
        .maybeSingle();

      if (profileError) {
        console.error('Profile lookup error:', profileError);
        // Continue anyway - non-critical error
      }

      // If existing user found, notify admin
      if (existingProfile) {
        toast.info(`Existing client found: ${existingProfile.full_name || 'Unknown'}. Application will be linked to their profile.`);
      }

      // If admin linked an existing client, the looked-up profile email MUST match
      // the form email — otherwise we'd silently attach this app to the wrong client.
      if (linkedClient && linkedClient.email !== formData.client_email.toLowerCase().trim()) {
        toast.error('Linked client email no longer matches the form email. Clear the selection or restore the original email.');
        setIsSubmitting(false);
        return;
      }

      // Use existing user_id if found, otherwise use shadow ID for admin-created applications
      const userId = existingProfile?.user_id || '00000000-0000-0000-0000-000000000000';

      // Capture the staff member who created this application (admin/sales/F&I)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const createdBy = authUser?.id || null;

      // Sanitize and prepare the application data
      const sanitizedGrossSalary = sanitizeNumeric(formData.gross_salary);
      const sanitizedNetSalary = sanitizeNumeric(formData.net_salary);

      const applicationData = {
        user_id: userId,
        created_by: createdBy,
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
        gross_salary: sanitizedGrossSalary,
        net_salary: sanitizedNetSalary,
        expenses_summary: formData.expenses_summary?.trim() || null,
        popia_consent: formData.popia_consent,
        preferred_vehicle_text: formData.preferred_vehicle_text?.trim() || null,
        has_drivers_license: formData.has_drivers_license === 'yes',
        credit_score_status: formData.credit_score_status || 'unsure',
        notes: formData.admin_notes?.trim() || 'Created by Admin on behalf of client',
        status: 'pending',
        // Admin-created on behalf of a client → tag the origin explicitly.
        submission_source: 'manual',
      };

      console.log('Submitting application data:', { ...applicationData, user_id: '[REDACTED]' });

      // HARD GUARD: this flow must always INSERT a brand new finance_applications row.
      // Never UPDATE the linked client's previous application. We deliberately do NOT
      // pass an `id` and do NOT use `.upsert()` here.
      if ('id' in (applicationData as any)) {
        console.error('Refusing to submit: applicationData unexpectedly contains an id.');
        toast.error('Internal error: application payload must not contain an id.');
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await supabase
        .from('finance_applications')
        .insert(applicationData as any)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Supabase insert error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        toast.error(`Submission Failed: ${error.message || 'Unknown database error'}`, {
          description: error.hint || error.details || undefined,
          duration: 8000,
        });
        return;
      }

      console.log('Application created successfully:', data?.id);

      // Universal activity trail (fire-and-forget).
      void logActivity({
        actionType: 'application_created',
        note: `Application created for ${applicationData.full_name}`,
        applicationId: data?.id ?? null,
        clientEmail: applicationData.email ?? null,
        clientPhone: applicationData.phone ?? null,
      });

      // Also create a lead entry if this is a new client (no existing profile)
      if (!existingProfile) {
        const { error: leadError } = await supabase.from('leads').insert({
          client_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
          client_email: formData.client_email.trim().toLowerCase(),
          client_phone: formData.client_phone.trim(),
          source: 'Admin Created',
          status: 'new',
          notes: `Application created by admin. ${formData.admin_notes || ''}`,
        } as any);

        if (leadError) {
          console.warn('Lead creation failed (non-critical):', leadError.message);
        }
      }

      toast.success(existingProfile 
        ? `Application linked to existing client: ${existingProfile.full_name || formData.first_name}` 
        : 'Application created successfully!'
      );
      navigate('/admin/finance');
    } catch (err: any) {
      console.error('Unexpected error creating application:', err);
      toast.error(`Error: ${err?.message || 'An unexpected error occurred'}`, {
        description: 'Check the console for details',
        duration: 8000,
      });
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Create Application</h1>
              <p className="text-muted-foreground">Submit a finance application on behalf of a client</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setManualEntryOpen(true)} className="shrink-0">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Manual Entry
            </Button>
          </div>
        </motion.div>

        <AddManualEntryModal open={manualEntryOpen} onOpenChange={setManualEntryOpen} />

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

                {/* Existing Client Lookup */}
                <div className="space-y-2 mb-6 p-4 rounded-lg border border-border bg-muted/30">
                  <Label>Link Existing Client (Optional)</Label>
                  <div className="flex gap-2">
                    <Popover open={lookupOpen} onOpenChange={setLookupOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={lookupOpen}
                          className="flex-1 justify-between font-normal"
                          disabled={isHydrating}
                        >
                          {linkedClient ? (
                            <span className="flex items-center gap-2 truncate">
                              <Badge variant="secondary" className="shrink-0">Linked</Badge>
                              <span className="truncate">{linkedClient.full_name || linkedClient.email}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {isHydrating ? 'Loading client data…' : 'Search by name, email or phone…'}
                            </span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command
                          filter={(value, search) => {
                            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                          }}
                        >
                          <CommandInput placeholder="Type name, email or phone…" />
                          <CommandList>
                            <CommandEmpty>No matching clients.</CommandEmpty>
                            <CommandGroup>
                              {clientOptions.map((c) => {
                                const label = `${c.full_name || ''} ${c.email} ${c.phone || ''}`.trim();
                                return (
                                  <CommandItem
                                    key={c.email}
                                    value={label}
                                    onSelect={() => hydrateFromClient(c)}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        linkedClient?.email === c.email ? 'opacity-100' : 'opacity-0',
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="text-sm">{c.full_name || '(No name)'}</span>
                                      <span className="text-xs text-muted-foreground">{c.email}{c.phone ? ` • ${c.phone}` : ''}</span>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {linkedClient && (
                      <Button variant="ghost" size="icon" onClick={clearLinkedClient} title="Clear selection & reset form">
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select a returning client to pre-fill the form. A new application will still be created and linked to their existing profile. All fields remain editable.
                  </p>
                </div>

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
