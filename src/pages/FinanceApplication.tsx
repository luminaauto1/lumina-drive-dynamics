import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  User,
  MapPin,
  Users,
  Wallet,
  Shield,
  MessageCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import KineticText from "@/components/KineticText";
import SignaturePad from "@/components/SignaturePad";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  financeApplicationStep1Schema,
  financeApplicationStep2Schema,
  financeApplicationStep3Schema,
  financeApplicationStep4Schema,
  financeApplicationStep5Schema,
  financeApplicationFullSchema,
  getFirstZodError,
} from "@/lib/validationSchemas";

const STEPS = [
  { id: 1, title: "Personal Details", icon: User },
  { id: 2, title: "Address & Employment", icon: MapPin },
  { id: 3, title: "Next of Kin", icon: Users },
  { id: 4, title: "Financials", icon: Wallet },
  { id: 5, title: "Permission", icon: Shield },
];

const FinanceApplication = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vehicleId = searchParams.get("vehicle");
  const resumeId = searchParams.get("resume");

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showTrustModal, setShowTrustModal] = useState(true);
  const [resumedApplicationId, setResumedApplicationId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    // Personal
    first_name: "",
    last_name: "",
    id_number: "",
    marital_status: "",
    gender: "",
    qualification: "",
    email: "",
    phone: "",
    // Address
    street_address: "",
    area_code: "",
    // Employment
    employer_name: "",
    job_title: "",
    employment_period_value: "",
    employment_period_unit: "years",
    // Next of Kin
    kin_name: "",
    kin_contact: "",
    // Banking
    bank_name: "",
    account_type: "",
    account_number: "",
    // Financials - Multiple Income Sources
    income_sources: [{ source: "Primary Employment", amount: "" }],
    net_salary: "",
    expenses_summary: "",
    // Consent
    popia_consent: false,
    signature_url: "",
    // Preferred Vehicle
    preferred_vehicle_text: "",
    // Anti-Time Wasting
    has_drivers_license: "",
    credit_score_status: "",
  });

  // Computed employment period for validation and submission
  const getEmploymentPeriod = () => {
    if (!formData.employment_period_value) return "";
    return `${formData.employment_period_value} ${formData.employment_period_unit}`;
  };

  useEffect(() => {
    // Don't redirect while loading - wait for auth state to resolve
    if (loading) return;

    if (!user) {
      navigate("/auth?redirect=/finance-application" + (vehicleId ? `?vehicle=${vehicleId}` : ""));
      return;
    }
    fetchProfile();
    
    // If resuming a draft, load the draft data
    if (resumeId) {
      loadDraftApplication(resumeId);
    }
  }, [user, navigate, vehicleId, loading, resumeId]);

  const loadDraftApplication = async (draftId: string) => {
    const { data, error } = await supabase
      .from("finance_applications")
      .select("*")
      .eq("id", draftId)
      .eq("user_id", user?.id)
      .single();

    if (error || !data) {
      toast.error("Could not load draft application");
      return;
    }

    // Don't show trust modal for resumed applications
    setShowTrustModal(false);
    setResumedApplicationId(draftId);
    
    // Parse employment period if present
    let empPeriodValue = "";
    let empPeriodUnit = "years";
    if (data.employment_period) {
      const match = data.employment_period.match(/^(\d+)\s*(\w+)$/);
      if (match) {
        empPeriodValue = match[1];
        empPeriodUnit = match[2] || "years";
      }
    }

    // Map database fields to form fields
    setFormData({
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      id_number: data.id_number || "",
      marital_status: data.marital_status || "",
      gender: data.gender || "",
      qualification: data.qualification || "",
      email: data.email || "",
      phone: data.phone || "",
      street_address: data.street_address || "",
      area_code: data.area_code || "",
      employer_name: data.employer_name || "",
      job_title: data.job_title || "",
      employment_period_value: empPeriodValue,
      employment_period_unit: empPeriodUnit,
      kin_name: data.kin_name || "",
      kin_contact: data.kin_contact || "",
      bank_name: data.bank_name || "",
      account_type: data.account_type || "",
      account_number: data.account_number || "",
      income_sources: data.gross_salary 
        ? [{ source: "Primary Employment", amount: String(data.gross_salary) }] 
        : [{ source: "Primary Employment", amount: "" }],
      net_salary: data.net_salary ? String(data.net_salary) : "",
      expenses_summary: data.expenses_summary || "",
      popia_consent: data.popia_consent || false,
      signature_url: data.signature_url || "",
      preferred_vehicle_text: data.preferred_vehicle_text || "",
      has_drivers_license: data.has_drivers_license === true ? "yes" : data.has_drivers_license === false ? "no" : "",
      credit_score_status: data.credit_score_status || "",
    });

    // Determine which step the user was on based on filled fields
    const step1Complete = data.first_name && data.last_name && data.id_number && data.email && data.phone;
    const step2Complete = data.street_address && data.employer_name;
    const step3Complete = data.kin_name && data.kin_contact;
    const step4Complete = data.bank_name && data.account_number && data.gross_salary;
    
    if (step4Complete) setCurrentStep(5);
    else if (step3Complete) setCurrentStep(4);
    else if (step2Complete) setCurrentStep(3);
    else if (step1Complete) setCurrentStep(2);
    else setCurrentStep(1);

    toast.success("Draft loaded. Continue your application.");
  };

  const fetchProfile = async () => {
    if (!user) return;
    // Don't overwrite with profile data if resuming a draft
    if (resumeId) return;
    
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();

    if (data) {
      setFormData((prev) => ({
        ...prev,
        email: data.email || user.email || "",
        phone: data.phone || "",
        first_name: data.full_name?.split(" ")[0] || "",
        last_name: data.full_name?.split(" ").slice(1).join(" ") || "",
      }));
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Track which fields have errors for visual feedback
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  const validateStep = (step: number): boolean => {
    const newFieldErrors: Record<string, boolean> = {};
    
    try {
      switch (step) {
        case 1:
          financeApplicationStep1Schema.parse({
            first_name: formData.first_name,
            last_name: formData.last_name,
            id_number: formData.id_number,
            marital_status: formData.marital_status,
            gender: formData.gender,
            qualification: formData.qualification,
            email: formData.email,
            phone: formData.phone,
          });
          break;
        case 2:
          financeApplicationStep2Schema.parse({
            street_address: formData.street_address,
            area_code: formData.area_code,
            employer_name: formData.employer_name,
            job_title: formData.job_title,
            employment_period: getEmploymentPeriod(),
          });
          break;
        case 3:
          financeApplicationStep3Schema.parse({
            kin_name: formData.kin_name,
            kin_contact: formData.kin_contact,
          });
          break;
        case 4:
          // Calculate total gross from income sources
          const totalGross = formData.income_sources.reduce((sum, src) => 
            sum + (parseFloat(src.amount) || 0), 0);
          financeApplicationStep4Schema.parse({
            bank_name: formData.bank_name,
            account_type: formData.account_type,
            account_number: formData.account_number,
            gross_salary: String(totalGross),
            net_salary: formData.net_salary,
            expenses_summary: formData.expenses_summary,
          });
          break;
        case 5:
          financeApplicationStep5Schema.parse({
            preferred_vehicle_text: formData.preferred_vehicle_text,
            popia_consent: formData.popia_consent,
          });
          break;
      }
      setFieldErrors({});
      return true;
    } catch (error: any) {
      // Extract field-specific errors for visual feedback
      if (error?.errors) {
        for (const err of error.errors) {
          if (err.path && err.path.length > 0) {
            newFieldErrors[err.path[0]] = true;
          }
        }
      }
      setFieldErrors(newFieldErrors);
      
      if (error instanceof Error && "errors" in error) {
        toast.error(getFirstZodError(error as any));
      } else {
        toast.error("Please check your input and try again");
      }
      return false;
    }
  };
  
  // Helper to get error class for inputs
  const getErrorClass = (fieldName: string) => {
    return fieldErrors[fieldName] ? 'border-red-500 ring-1 ring-red-500' : '';
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!user) return;

    // 1. Validation
    try {
      financeApplicationFullSchema.parse(formData);
    } catch (error) {
      if (error instanceof Error && "errors" in error) {
        toast.error(getFirstZodError(error as any));
      } else {
        toast.error("Please check your input and try again");
      }
      return;
    }

    setIsSubmitting(true);

    // Calculate total gross from income sources
    const totalGross = formData.income_sources.reduce((sum, src) => 
      sum + (parseFloat(src.amount) || 0), 0);
    
    // Combine income source names
    const incomeSourceNames = formData.income_sources
      .filter(src => src.source && src.amount)
      .map(src => src.source)
      .join(" + ");

    // 2. Prepare Data
    const sanitizedData = {
      user_id: user.id,
      vehicle_id: vehicleId || null,
      full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      id_number: formData.id_number?.trim() || null,
      marital_status: formData.marital_status || null,
      gender: formData.gender || null,
      qualification: formData.qualification || null,
      street_address: formData.street_address.trim(),
      area_code: formData.area_code?.trim() || null,
      employer_name: incomeSourceNames || formData.employer_name.trim(),
      job_title: formData.job_title?.trim() || null,
      employment_period: getEmploymentPeriod() || null,
      kin_name: formData.kin_name.trim(),
      kin_contact: formData.kin_contact.trim(),
      bank_name: formData.bank_name,
      account_type: formData.account_type || null,
      account_number: formData.account_number?.trim() || null,
      gross_salary: totalGross || null,
      net_salary: formData.net_salary ? parseFloat(formData.net_salary) : null,
      expenses_summary: formData.expenses_summary?.trim() || null,
      popia_consent: formData.popia_consent,
      preferred_vehicle_text: formData.preferred_vehicle_text?.trim() || null,
      has_drivers_license: formData.has_drivers_license === "yes",
      credit_score_status: formData.credit_score_status || "unsure",
      status: "pending",
    };

    // 3. Save to Database - Update if resuming a draft, otherwise insert
    let insertedApp: { id: string } | null = null;
    let error: any = null;

    if (resumedApplicationId) {
      // Update existing draft application
      const { data, error: updateError } = await supabase
        .from("finance_applications")
        .update(sanitizedData as any)
        .eq("id", resumedApplicationId)
        .select("id")
        .single();
      insertedApp = data;
      error = updateError;
    } else {
      // Insert new application
      const { data, error: insertError } = await supabase
        .from("finance_applications")
        .insert(sanitizedData as any)
        .select("id")
        .single();
      insertedApp = data;
      error = insertError;
    }

    if (error) {
      toast.error("Failed to submit application. Please try again.");
      console.error("Submission error:", error);
    } else {
      // 4. Auto-create Lead via secure edge function
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        
        if (accessToken) {
          await supabase.functions.invoke("create-lead", {
            body: {
              client_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
              client_email: formData.email.trim().toLowerCase(),
              client_phone: formData.phone.trim(),
              source: "Finance Form",
              notes: `Finance application submitted. Vehicle preference: ${formData.preferred_vehicle_text || "None specified"}`,
              vehicle_id: vehicleId || null,
            },
          });
        }
      } catch (leadError) {
        console.error("Lead creation failed:", leadError);
        // Non-blocking - application was already saved
      }

      // 5. Send confirmation email via edge function
      try {
        await supabase.functions.invoke("send-finance-alert", {
          body: {
            applicationId: insertedApp?.id,
            clientName: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
            clientEmail: formData.email.trim().toLowerCase(),
            netSalary: formData.net_salary ? parseFloat(formData.net_salary) : null,
          },
        });
      } catch (emailError) {
        console.error("Email notification failed:", emailError);
        // Non-blocking - application was already saved
      }

      setIsSubmitted(true);
      toast.success("Application submitted successfully!");
    }

    setIsSubmitting(false);
  };

  // Save Progress handler - bypasses validation, saves as draft
  const handleSaveProgress = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    
    // Calculate total gross from income sources
    const totalGross = formData.income_sources.reduce((sum, src) => 
      sum + (parseFloat(src.amount) || 0), 0);
    
    const draftData = {
      user_id: user.id,
      vehicle_id: vehicleId || null,
      full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim() || 'Draft Application',
      first_name: formData.first_name.trim() || null,
      last_name: formData.last_name.trim() || null,
      email: formData.email.trim().toLowerCase() || user.email || '',
      phone: formData.phone.trim() || '',
      id_number: formData.id_number?.trim() || null,
      marital_status: formData.marital_status || null,
      gender: formData.gender || null,
      qualification: formData.qualification || null,
      street_address: formData.street_address.trim() || null,
      area_code: formData.area_code?.trim() || null,
      employer_name: formData.employer_name.trim() || null,
      job_title: formData.job_title?.trim() || null,
      employment_period: getEmploymentPeriod() || null,
      kin_name: formData.kin_name.trim() || null,
      kin_contact: formData.kin_contact.trim() || null,
      bank_name: formData.bank_name || null,
      account_type: formData.account_type || null,
      account_number: formData.account_number?.trim() || null,
      gross_salary: totalGross || null,
      net_salary: formData.net_salary ? parseFloat(formData.net_salary) : null,
      expenses_summary: formData.expenses_summary?.trim() || null,
      popia_consent: formData.popia_consent,
      preferred_vehicle_text: formData.preferred_vehicle_text?.trim() || null,
      has_drivers_license: formData.has_drivers_license === "yes",
      credit_score_status: formData.credit_score_status || "unsure",
      status: "draft", // Keep as draft
    };
    
    let saveError: any = null;
    
    if (resumedApplicationId) {
      // Update existing draft
      const { error } = await supabase
        .from("finance_applications")
        .update(draftData as any)
        .eq("id", resumedApplicationId);
      saveError = error;
    } else {
      // Insert new draft
      const { data, error } = await supabase
        .from("finance_applications")
        .insert(draftData as any)
        .select("id")
        .single();
      saveError = error;
      
      // Store the new draft ID so subsequent saves update instead of insert
      if (data && !error) {
        setResumedApplicationId(data.id);
      }
    }
    
    if (saveError) {
      console.error("Save progress error:", saveError);
      toast.error("Failed to save progress. Please try again.");
    } else {
      toast.success("Progress saved! You can return to finish later from your dashboard.");
      navigate("/dashboard");
    }
    
    setIsSubmitting(false);
  };

  const openWhatsApp = () => {
    const message = `Hi, I have just submitted my finance application (ID: ${formData.id_number || "Not Provided"}).`;
    window.open(`https://wa.me/27686017462?text=${encodeURIComponent(message)}`, "_blank");
  };

  if (loading || !user) return null;

  if (isSubmitted) {
    return (
      <>
        <Helmet>
          <title>Application Submitted | Lumina Auto</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-lg"
          >
            <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-8">
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Application Received!</h1>
            <p className="text-xl text-muted-foreground mb-8">
              We are analyzing your profile and will confirm your budget shortly. Check your dashboard for updates.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={openWhatsApp} className="bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="mr-2 w-5 h-5" />
                Finalize on WhatsApp
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                View My Applications
              </Button>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Finance Application | Lumina Auto</title>
      </Helmet>

      {/* Trust Modal */}
      <Dialog open={showTrustModal} onOpenChange={setShowTrustModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              How Our Finance Process Works
            </DialogTitle>
            <DialogDescription className="text-left pt-4 space-y-3">
              <p className="text-foreground font-medium">We secure your verified budget first.</p>
              <p className="text-muted-foreground">
                Once your buying power is confirmed, we unlock exclusive vehicle options matched to your profile.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground mt-4">
                <li>Submit this form (No documents needed yet)</li>
                <li>We analyze and verify your budget</li>
                <li>View your curated vehicle options in your dashboard</li>
              </ol>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowTrustModal(false)} className="w-full">
              Understood - Let's Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-3xl">
          <div className="text-center mb-8">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block"
            >
              Check Your Buying Power
            </motion.span>
            <h1 className="text-4xl font-bold mb-4">
              <KineticText>Finance Application</KineticText>
            </h1>
          </div>

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
                        ? "bg-green-500 text-white"
                        : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isComplete ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span
                    className={`text-xs mt-2 hidden sm:block ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                  >
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
              {/* Step 1: Personal Details */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
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
                        onChange={(e) => handleInputChange("first_name", e.target.value)}
                        required
                        className={getErrorClass("first_name")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Surname *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => handleInputChange("last_name", e.target.value)}
                        required
                        className={getErrorClass("last_name")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="id_number">ID Number</Label>
                      <Input
                        id="id_number"
                        value={formData.id_number}
                        onChange={(e) => handleInputChange("id_number", e.target.value)}
                        placeholder="e.g., 9001015009087"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="marital_status">Marital Status</Label>
                      <Select
                        value={formData.marital_status}
                        onValueChange={(v) => handleInputChange("marital_status", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="married">Married</SelectItem>
                          <SelectItem value="divorced">Divorced</SelectItem>
                          <SelectItem value="widowed">Widowed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Anti-Time Wasting Fields */}
                    <div className="space-y-2 md:col-span-2">
                      <Label>Do you have a valid Driver's License? *</Label>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="has_drivers_license"
                            value="yes"
                            checked={formData.has_drivers_license === "yes"}
                            onChange={(e) => handleInputChange("has_drivers_license", e.target.value)}
                            className="w-4 h-4 accent-primary"
                          />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="has_drivers_license"
                            value="no"
                            checked={formData.has_drivers_license === "no"}
                            onChange={(e) => handleInputChange("has_drivers_license", e.target.value)}
                            className="w-4 h-4 accent-primary"
                          />
                          <span>No</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="credit_score_status">What is your credit status?</Label>
                      <Select
                        value={formData.credit_score_status}
                        onValueChange={(v) => handleInputChange("credit_score_status", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your credit status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Good (No defaults)</SelectItem>
                          <SelectItem value="unsure">Not Sure</SelectItem>
                          <SelectItem value="bad">Bad (Have defaults/judgments)</SelectItem>
                          <SelectItem value="blacklisted">Blacklisted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Select value={formData.gender} onValueChange={(v) => handleInputChange("gender", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qualification">Highest Qualification</Label>
                      <Select
                        value={formData.qualification}
                        onValueChange={(v) => handleInputChange("qualification", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="matric">Matric</SelectItem>
                          <SelectItem value="diploma">Diploma</SelectItem>
                          <SelectItem value="degree">Degree</SelectItem>
                          <SelectItem value="postgraduate">Postgraduate</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        required
                        className={getErrorClass("email")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => {
                          // Only allow digits, strip everything else
                          const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                          handleInputChange("phone", cleaned);
                        }}
                        required
                        placeholder="0721234567"
                        maxLength={10}
                        className={getErrorClass("phone")}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Address & Employment */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                <h2 className="text-xl font-semibold mb-4">Address & Employment</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="street_address">Physical Address *</Label>
                      <AddressAutocomplete
                        value={formData.street_address}
                        onChange={(value) => handleInputChange("street_address", value)}
                        onPostalCodeChange={(postalCode) => handleInputChange("area_code", postalCode)}
                        placeholder="Start typing your address..."
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="area_code">Area/Postal Code</Label>
                      <Input
                        id="area_code"
                        value={formData.area_code}
                        onChange={(e) => handleInputChange("area_code", e.target.value)}
                        placeholder="Auto-filled or enter manually"
                      />
                    </div>
                  </div>
                  <div className="border-t border-border pt-6">
                    <h3 className="font-medium mb-4">Employment Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="employer_name">Workplace/Employer Name *</Label>
                        <Input
                          id="employer_name"
                          value={formData.employer_name}
                          onChange={(e) => handleInputChange("employer_name", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="job_title">Job Title</Label>
                        <Input
                          id="job_title"
                          value={formData.job_title}
                          onChange={(e) => handleInputChange("job_title", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="employment_period">Period at Employer</Label>
                        <div className="flex gap-3">
                          <Input
                            id="employment_period_value"
                            type="number"
                            value={formData.employment_period_value}
                            onChange={(e) => handleInputChange("employment_period_value", e.target.value)}
                            placeholder="Time"
                            className="flex-1"
                            min={0}
                          />
                          <Select
                            value={formData.employment_period_unit}
                            onValueChange={(v) => handleInputChange("employment_period_unit", v)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="months">Months</SelectItem>
                              <SelectItem value="years">Years</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Next of Kin */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-semibold mb-4">Next of Kin</h2>
                  <p className="text-muted-foreground text-sm mb-4">Someone not living with you</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="kin_name">Name & Surname *</Label>
                      <Input
                        id="kin_name"
                        value={formData.kin_name}
                        onChange={(e) => handleInputChange("kin_name", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kin_contact">Contact Number *</Label>
                      <Input
                        id="kin_contact"
                        type="tel"
                        value={formData.kin_contact}
                        onChange={(e) => handleInputChange("kin_contact", e.target.value)}
                        required
                        placeholder="+27 00 000 0000"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Financials */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-semibold mb-4">Banking & Financial Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bank_name">Bank Name *</Label>
                      <Select value={formData.bank_name} onValueChange={(v) => handleInputChange("bank_name", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bank" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="absa">ABSA</SelectItem>
                          <SelectItem value="african_bank">African Bank</SelectItem>
                          <SelectItem value="bidvest_bank">Bidvest Bank</SelectItem>
                          <SelectItem value="capitec">Capitec</SelectItem>
                          <SelectItem value="discovery_bank">Discovery Bank</SelectItem>
                          <SelectItem value="fnb">FNB</SelectItem>
                          <SelectItem value="grindrod_bank">Grindrod Bank</SelectItem>
                          <SelectItem value="investec">Investec</SelectItem>
                          <SelectItem value="nedbank">Nedbank</SelectItem>
                          <SelectItem value="sasfin">Sasfin</SelectItem>
                          <SelectItem value="standard_bank">Standard Bank</SelectItem>
                          <SelectItem value="tymebank">TymeBank</SelectItem>
                          <SelectItem value="wesbank">WesBank</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account_type">Account Type</Label>
                      <Select value={formData.account_type} onValueChange={(v) => handleInputChange("account_type", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="savings">Savings</SelectItem>
                          <SelectItem value="cheque">Cheque/Current</SelectItem>
                          <SelectItem value="transmission">Transmission</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="account_number">Account Number</Label>
                      <Input
                        id="account_number"
                        value={formData.account_number}
                        onChange={(e) => handleInputChange("account_number", e.target.value.replace(/\D/g, ""))}
                        placeholder="Enter account number"
                      />
                    </div>
                  </div>
                  <div className="border-t border-border pt-6">
                    <h3 className="font-medium mb-4">Income Sources</h3>
                    <p className="text-sm text-muted-foreground mb-4">Add all your income sources (employment, rental, side business, etc.)</p>
                    
                    <div className="space-y-4">
                      {formData.income_sources.map((source, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                          <div className="space-y-2 md:col-span-2">
                            <Label>Income Source {index + 1}</Label>
                            <Input
                              value={source.source}
                              onChange={(e) => {
                                const newSources = [...formData.income_sources];
                                newSources[index].source = e.target.value;
                                setFormData(prev => ({ ...prev, income_sources: newSources }));
                              }}
                              placeholder="e.g., Main Job, Rental Income, Side Business"
                            />
                          </div>
                          <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-2">
                              <Label>Amount (R)</Label>
                              <Input
                                type="number"
                                value={source.amount}
                                onChange={(e) => {
                                  const newSources = [...formData.income_sources];
                                  newSources[index].amount = e.target.value;
                                  setFormData(prev => ({ ...prev, income_sources: newSources }));
                                }}
                                placeholder="e.g., 35000"
                              />
                            </div>
                            {formData.income_sources.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => {
                                  const newSources = formData.income_sources.filter((_, i) => i !== index);
                                  setFormData(prev => ({ ...prev, income_sources: newSources }));
                                }}
                              >
                                ✕
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            income_sources: [...prev.income_sources, { source: "", amount: "" }]
                          }));
                        }}
                      >
                        + Add Income Source
                      </Button>
                      
                      {/* Total Gross Income Display */}
                      <div className="bg-muted/50 rounded-lg p-4 mt-4">
                        <p className="text-sm text-muted-foreground">Total Gross Income</p>
                        <p className="text-2xl font-bold text-primary">
                          R{formData.income_sources.reduce((sum, src) => sum + (parseFloat(src.amount) || 0), 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <div className="space-y-2">
                        <Label htmlFor="net_salary">Net Salary (After deductions) *</Label>
                        <Input
                          id="net_salary"
                          type="number"
                          value={formData.net_salary}
                          onChange={(e) => handleInputChange("net_salary", e.target.value)}
                          placeholder="e.g., 38000"
                          required
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="expenses_summary">Monthly Expenses Summary *</Label>
                        <Textarea
                          id="expenses_summary"
                          value={formData.expenses_summary}
                          onChange={(e) => handleInputChange("expenses_summary", e.target.value)}
                          placeholder="e.g., Rent R5000, Phone R500, Insurance R1200"
                          rows={3}
                          required
                          className={!formData.expenses_summary ? 'border-destructive/50' : ''}
                        />
                        {!formData.expenses_summary && (
                          <p className="text-xs text-destructive">Expenses breakdown is required</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 5: Permission */}
              {currentStep === 5 && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-semibold mb-4">Consent & Preferences</h2>

                  {/* Preferred Vehicle Section */}
                  <div className="glass-card rounded-lg p-6 border border-border mb-6">
                    <h3 className="font-medium mb-3">Do you have a specific car in mind? (Optional)</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Tell us what you're looking for and we'll try to match it to your budget.
                    </p>
                    <Textarea
                      id="preferred_vehicle_text"
                      value={formData.preferred_vehicle_text}
                      onChange={(e) => handleInputChange("preferred_vehicle_text", e.target.value)}
                      placeholder="e.g., BMW 320d, 2020 or newer, white or black, M Sport preferred..."
                      rows={3}
                    />
                  </div>

                  {/* POPIA Consent */}
                  <div className="glass-card rounded-lg p-6 border border-border space-y-4">
                    <div className="flex items-start space-x-4">
                      <Checkbox
                        id="popia_consent"
                        checked={formData.popia_consent}
                        onCheckedChange={(checked) => handleInputChange("popia_consent", checked as boolean)}
                        className="mt-1"
                      />
                      <Label htmlFor="popia_consent" className="text-sm leading-relaxed cursor-pointer">
                        I give permission to Lumina Auto to process my finance application on my behalf in line with
                        POPIA (Protection of Personal Information Act). I understand that my personal information will
                        be shared with financial institutions for the purpose of obtaining vehicle finance.
                      </Label>
                    </div>
                    
                    {/* Signature Pad */}
                    {formData.popia_consent && (
                      <div className="pt-4 border-t border-border">
                        <Label className="text-sm font-medium mb-3 block">Digital Signature</Label>
                        <SignaturePad 
                          onSave={(dataUrl) => handleInputChange("signature_url", dataUrl)}
                          existingSignature={formData.signature_url}
                        />
                      </div>
                    )}
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                    <p>
                      By submitting this application, you confirm that all information provided is accurate and
                      complete.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 mt-8 pt-6 border-t border-border">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="min-w-[120px]"
                >
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  Back
                </Button>
                
                {/* Save Progress Button */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSaveProgress}
                  disabled={isSubmitting}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Save & Finish Later
                </Button>
              </div>

              {currentStep < 5 ? (
                <Button type="button" onClick={nextStep} className="min-w-[120px] bg-accent text-accent-foreground">
                  Next
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.popia_consent}
                  className="min-w-[160px] bg-accent text-accent-foreground"
                >
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                  <CheckCircle className="ml-2 w-4 h-4" />
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default FinanceApplication;
