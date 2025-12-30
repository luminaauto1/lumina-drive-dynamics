import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import KineticText from '@/components/KineticText';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const FinanceApplication = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vehicleId = searchParams.get('vehicle');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    id_number: '',
    monthly_income: '',
    employment_status: '',
    employer_name: '',
    deposit_amount: '',
    loan_term_months: '72',
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth?redirect=/finance-application' + (vehicleId ? `?vehicle=${vehicleId}` : ''));
      return;
    }

    // Pre-fill from profile
    fetchProfile();
  }, [user, navigate, vehicleId]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setFormData((prev) => ({
        ...prev,
        full_name: data.full_name || '',
        email: data.email || user.email || '',
        phone: data.phone || '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    const { error } = await supabase.from('finance_applications').insert({
      user_id: user.id,
      vehicle_id: vehicleId || null,
      full_name: formData.full_name,
      email: formData.email,
      phone: formData.phone,
      id_number: formData.id_number,
      monthly_income: formData.monthly_income ? parseFloat(formData.monthly_income) : null,
      employment_status: formData.employment_status,
      employer_name: formData.employer_name,
      deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : null,
      loan_term_months: parseInt(formData.loan_term_months),
    });

    if (error) {
      toast.error('Failed to submit application. Please try again.');
    } else {
      setIsSubmitted(true);
      toast.success('Application submitted successfully!');
    }

    setIsSubmitting(false);
  };

  if (!user) return null;

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
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Application Submitted!</h1>
            <p className="text-muted-foreground mb-8">
              Thank you for your finance application. Our team will review your details and contact
              you within 24-48 hours.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                View My Applications
              </Button>
              <Button
                className="bg-accent text-accent-foreground"
                onClick={() => navigate('/inventory')}
              >
                Continue Browsing
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

      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-2xl">
          <div className="text-center mb-12">
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
            <p className="text-muted-foreground">
              Complete the form below to get pre-approved for vehicle financing
            </p>
          </div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="glass-card rounded-2xl p-8 space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="glass-card border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="id_number">ID Number</Label>
                <Input
                  id="id_number"
                  value={formData.id_number}
                  onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                  placeholder="e.g., 9001015009087"
                  className="glass-card border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="glass-card border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  placeholder="+27 00 000 0000"
                  className="glass-card border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthly_income">Gross Monthly Income (R)</Label>
                <Input
                  id="monthly_income"
                  type="number"
                  value={formData.monthly_income}
                  onChange={(e) => setFormData({ ...formData, monthly_income: e.target.value })}
                  placeholder="e.g., 50000"
                  className="glass-card border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employment_status">Employment Status</Label>
                <Select
                  value={formData.employment_status}
                  onValueChange={(value) => setFormData({ ...formData, employment_status: value })}
                >
                  <SelectTrigger className="glass-card border-border">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="employed">Employed</SelectItem>
                    <SelectItem value="self-employed">Self-Employed</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employer_name">Employer Name</Label>
                <Input
                  id="employer_name"
                  value={formData.employer_name}
                  onChange={(e) => setFormData({ ...formData, employer_name: e.target.value })}
                  className="glass-card border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deposit_amount">Available Deposit (R)</Label>
                <Input
                  id="deposit_amount"
                  type="number"
                  value={formData.deposit_amount}
                  onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                  placeholder="e.g., 100000"
                  className="glass-card border-border"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="loan_term">Preferred Loan Term</Label>
                <Select
                  value={formData.loan_term_months}
                  onValueChange={(value) => setFormData({ ...formData, loan_term_months: value })}
                >
                  <SelectTrigger className="glass-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="24">24 months</SelectItem>
                    <SelectItem value="36">36 months</SelectItem>
                    <SelectItem value="48">48 months</SelectItem>
                    <SelectItem value="60">60 months</SelectItem>
                    <SelectItem value="72">72 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              By submitting this form, you agree to our terms and conditions. Your information will
              be securely processed.
            </p>
          </motion.form>
        </div>
      </div>
    </>
  );
};

export default FinanceApplication;