import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Search, CheckCircle, Truck, Send, ArrowRight, CreditCard, Wallet, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import KineticText from '@/components/KineticText';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAuth } from '@/contexts/AuthContext';

const Sourcing = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: settings } = useSiteSettings();
  const whatsappNumber = settings?.whatsapp_number || '27686017462';

  const [paymentMethod, setPaymentMethod] = useState<'finance' | 'cash' | null>(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    make: '',
    model: '',
    year: '',
    maxBudget: '',
    additionalDetails: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckBuyingPower = () => {
    if (user) {
      navigate('/finance-application');
    } else {
      navigate('/auth', { state: { returnTo: '/finance-application' } });
    }
  };

  const handleCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const message = `🔍 *New Sourcing Request (Cash Buyer)*\n\n👤 Name: ${formData.name}\n📞 Phone: ${formData.phone}\n📧 Email: ${formData.email}\n\n🚗 *Vehicle Details*\nMake: ${formData.make}\nModel: ${formData.model}\nYear: ${formData.year || 'Any'}\nMax Budget: R${formData.maxBudget}\n\n📝 Additional Info:\n${formData.additionalDetails || 'N/A'}`;

    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');

    toast({
      title: 'Request Submitted!',
      description: 'Our team will begin sourcing your vehicle immediately.',
    });

    setFormData({
      name: '',
      phone: '',
      email: '',
      make: '',
      model: '',
      year: '',
      maxBudget: '',
      additionalDetails: '',
    });
    setIsSubmitting(false);
  };

  const steps = [
    {
      icon: CheckCircle,
      title: 'Secure Budget',
      description: 'Get your finance pre-verified so you know exactly what you can spend.',
    },
    {
      icon: Search,
      title: 'We Source',
      description: 'Tell us what you want. We search 120+ dealer partners to find it.',
    },
    {
      icon: Truck,
      title: 'Delivery',
      description: 'Verified, inspected, and delivered directly to your door.',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' as const },
    },
  };

  return (
    <>
      <Helmet>
        <title>Vehicle Sourcing | Lumina Auto - Find Any Car</title>
        <meta
          name="description"
          content="Can't find the car you want? Let Lumina Auto source it for you. We have access to 120+ dealer partners and 6 major banks for financing."
        />
      </Helmet>

      <div className="min-h-screen pt-24 pb-32">
        {/* Hero Section - Budget First */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="py-20 text-center"
        >
          <div className="container mx-auto px-6">
            <motion.span
              variants={itemVariants}
              className="text-primary text-sm font-semibold uppercase tracking-[0.3em] mb-6 block"
            >
              Bespoke Vehicle Procurement
            </motion.span>
            <motion.h1
              variants={itemVariants}
              className="font-display text-5xl md:text-7xl font-bold mb-6 max-w-4xl mx-auto"
            >
              <KineticText>Before We Find Your Car</KineticText>
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-8"
            >
              Let's secure your budget first. Know exactly what you can spend before we source your perfect vehicle.
            </motion.p>
            <motion.div variants={itemVariants}>
              <Button 
                size="lg" 
                onClick={handleCheckBuyingPower}
                className="text-lg px-8 py-6"
              >
                Check Buying Power
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </motion.section>

        {/* How It Works Section */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="py-16 bg-card border-y border-border"
        >
          <div className="container mx-auto px-6">
            <motion.div variants={itemVariants} className="text-center mb-12">
              <span className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block">
                How It Works
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold">
                Don't Settle. We Find It.
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step, index) => (
                <motion.div
                  key={step.title}
                  variants={itemVariants}
                  className="relative text-center p-8 bg-background rounded-xl border border-border"
                >
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Payment Method Selection */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="py-20"
        >
          <div className="container mx-auto px-6">
            <div className="max-w-2xl mx-auto">
              <motion.div variants={itemVariants} className="text-center mb-12">
                <span className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block">
                  Step 1
                </span>
                <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                  How Are You Buying?
                </h2>
                <p className="text-muted-foreground">
                  Select your payment method to proceed with your vehicle search.
                </p>
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-4">
                <RadioGroup
                  value={paymentMethod || ''}
                  onValueChange={(value) => {
                    setPaymentMethod(value as 'finance' | 'cash');
                    setShowVehicleForm(value === 'cash');
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem value="finance" id="finance" className="peer sr-only" />
                    <Label
                      htmlFor="finance"
                      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-8 cursor-pointer transition-all peer-checked:border-primary peer-checked:bg-primary/5 hover:bg-muted/50"
                    >
                      <CreditCard className="w-10 h-10 text-primary" />
                      <span className="font-semibold text-lg">Finance (Bank)</span>
                      <span className="text-sm text-muted-foreground text-center">
                        Get pre-approved and know your budget
                      </span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="cash" id="cash" className="peer sr-only" />
                    <Label
                      htmlFor="cash"
                      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-8 cursor-pointer transition-all peer-checked:border-primary peer-checked:bg-primary/5 hover:bg-muted/50"
                    >
                      <Wallet className="w-10 h-10 text-primary" />
                      <span className="font-semibold text-lg">Cash / EFT</span>
                      <span className="text-sm text-muted-foreground text-center">
                        Ready to buy with available funds
                      </span>
                    </Label>
                  </div>
                </RadioGroup>

                {/* Finance Path - CTA */}
                {paymentMethod === 'finance' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-6 bg-primary/10 rounded-xl border border-primary/30 text-center"
                  >
                    <p className="text-lg mb-4">
                      Great choice! Let's check your buying power first.
                    </p>
                    <Button size="lg" onClick={handleCheckBuyingPower}>
                      Start Finance Application
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <p className="text-sm text-muted-foreground mt-4">
                      Once your budget is confirmed, we'll source vehicles that match your profile.
                    </p>
                  </motion.div>
                )}

                {/* Cash Path - Vehicle Wishlist Form */}
                {showVehicleForm && paymentMethod === 'cash' && (
                  <motion.form
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={handleCashSubmit}
                    className="mt-8 space-y-6 bg-card border border-border rounded-xl p-8"
                  >
                    <div className="text-center mb-6">
                      <h3 className="font-display text-xl font-semibold mb-2">Vehicle Wishlist</h3>
                      <p className="text-sm text-muted-foreground">
                        Tell us what you're looking for and your budget.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="John Doe"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="083 123 4567"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john@email.com"
                      />
                    </div>

                    <div className="border-t border-border pt-6">
                      <h4 className="font-semibold mb-4">Vehicle Requirements</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="make">Make *</Label>
                          <Input
                            id="make"
                            value={formData.make}
                            onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                            placeholder="e.g. BMW"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="model">Model *</Label>
                          <Input
                            id="model"
                            value={formData.model}
                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                            placeholder="e.g. 320d"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="year">Year (Optional)</Label>
                          <Input
                            id="year"
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                            placeholder="e.g. 2020"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 mt-4">
                        <Label htmlFor="maxBudget">Maximum Budget (R) *</Label>
                        <Input
                          id="maxBudget"
                          type="number"
                          value={formData.maxBudget}
                          onChange={(e) => setFormData({ ...formData, maxBudget: e.target.value })}
                          placeholder="e.g. 450000"
                          required
                        />
                      </div>

                      <div className="space-y-2 mt-4">
                        <Label htmlFor="additionalDetails">Additional Details</Label>
                        <Textarea
                          id="additionalDetails"
                          value={formData.additionalDetails}
                          onChange={(e) => setFormData({ ...formData, additionalDetails: e.target.value })}
                          placeholder="Color preferences, features, mileage limit, etc."
                          rows={4}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Sourcing Request
                    </Button>
                  </motion.form>
                )}
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="py-16"
        >
          <div className="container mx-auto px-6">
            <motion.div
              variants={itemVariants}
              className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl p-12 text-center"
            >
              <h2 className="font-display text-3xl font-bold mb-4">
                Prefer to Browse Our Current Stock?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Check out our hand-picked selection of premium vehicles available for immediate purchase.
              </p>
              <Button asChild size="lg" variant="outline">
                <a href="/inventory">
                  View Inventory
                  <ArrowRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </motion.div>
          </div>
        </motion.section>
      </div>
    </>
  );
};

export default Sourcing;