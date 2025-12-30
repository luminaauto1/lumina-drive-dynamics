import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Search, CheckCircle, Truck, Send, ArrowRight, CreditCard, Wallet, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import KineticText from '@/components/KineticText';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicles, formatPrice } from '@/hooks/useVehicles';
const Sourcing = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: settings } = useSiteSettings();
  const { data: allVehicles = [] } = useVehicles();
  const whatsappNumber = settings?.whatsapp_number || '27686017462';

  // Filter for generic/sourcing example vehicles only
  const sourcingExamples = useMemo(() => {
    return allVehicles.filter(v => v.is_generic_listing === true);
  }, [allVehicles]);

  const [paymentMethod, setPaymentMethod] = useState<'finance' | 'cash' | null>(null);
  const [budgetRange, setBudgetRange] = useState([300000]);
  const [budgetUnlocked, setBudgetUnlocked] = useState(false);

  // Mini finance form for quick check
  const [miniFinanceData, setMiniFinanceData] = useState({
    name: '',
    id_number: '',
    net_income: '',
  });

  // Vehicle request form
  const [vehicleData, setVehicleData] = useState({
    make: '',
    model: '',
    year: '',
    color: '',
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

  const handleMiniFinanceSubmit = () => {
    if (!miniFinanceData.name || !miniFinanceData.id_number || !miniFinanceData.net_income) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all fields to unlock vehicle selection.',
        variant: 'destructive',
      });
      return;
    }
    setBudgetUnlocked(true);
    toast({
      title: 'Budget Check Complete',
      description: 'You can now specify the vehicle you\'re looking for.',
    });
  };

  const handleCashBudgetSet = () => {
    if (budgetRange[0] < 50000) {
      toast({
        title: 'Budget Too Low',
        description: 'Please select a budget of at least R50,000.',
        variant: 'destructive',
      });
      return;
    }
    setBudgetUnlocked(true);
    toast({
      title: 'Budget Confirmed',
      description: 'You can now specify the vehicle you\'re looking for.',
    });
  };

  const handleVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleData.make || !vehicleData.model) {
      toast({
        title: 'Missing Vehicle Details',
        description: 'Please specify at least the make and model.',
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);

    const budgetText = paymentMethod === 'cash' 
      ? `R${budgetRange[0].toLocaleString()}` 
      : `Net Income: R${miniFinanceData.net_income}`;

    const message = `🔍 *New Sourcing Request*\n\n*Buyer Type:* ${paymentMethod === 'cash' ? 'Cash Buyer' : 'Finance Buyer'}\n*Budget:* ${budgetText}\n${paymentMethod === 'finance' ? `*Name:* ${miniFinanceData.name}\n*ID:* ${miniFinanceData.id_number}` : ''}\n\n🚗 *Vehicle Details*\nMake: ${vehicleData.make}\nModel: ${vehicleData.model}\nYear: ${vehicleData.year || 'Any'}\nColor: ${vehicleData.color || 'Any'}\n\n📝 Additional Info:\n${vehicleData.additionalDetails || 'N/A'}`;

    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');

    toast({
      title: 'Request Submitted!',
      description: 'Our team will begin sourcing your vehicle immediately.',
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
      transition: { staggerChildren: 0.15 },
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
        {/* Hero Section */}
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

        {/* STEP 1: Payment Method & Budget Check */}
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
                  Step 1: The Budget Check
                </span>
                <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                  How Are You Buying?
                </h2>
                <p className="text-muted-foreground">
                  Select your payment method to proceed.
                </p>
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-6">
                <RadioGroup
                  value={paymentMethod || ''}
                  onValueChange={(value) => {
                    setPaymentMethod(value as 'finance' | 'cash');
                    setBudgetUnlocked(false);
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

                {/* Finance Path - Mini Form */}
                {paymentMethod === 'finance' && !budgetUnlocked && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-6 bg-card rounded-xl border border-border space-y-4"
                  >
                    <h3 className="font-semibold text-lg mb-4">Quick Budget Check</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Provide basic details to unlock vehicle selection. For a full application, click below.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="mini_name">Full Name *</Label>
                        <Input
                          id="mini_name"
                          value={miniFinanceData.name}
                          onChange={(e) => setMiniFinanceData({ ...miniFinanceData, name: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mini_id">ID Number *</Label>
                        <Input
                          id="mini_id"
                          value={miniFinanceData.id_number}
                          onChange={(e) => setMiniFinanceData({ ...miniFinanceData, id_number: e.target.value })}
                          placeholder="9001015009087"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mini_income">Net Monthly Income (R) *</Label>
                      <Input
                        id="mini_income"
                        type="number"
                        value={miniFinanceData.net_income}
                        onChange={(e) => setMiniFinanceData({ ...miniFinanceData, net_income: e.target.value })}
                        placeholder="e.g. 35000"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button onClick={handleMiniFinanceSubmit} className="flex-1">
                        <Unlock className="w-4 h-4 mr-2" />
                        Unlock Vehicle Selection
                      </Button>
                      <Button variant="outline" onClick={handleCheckBuyingPower}>
                        Full Finance Application
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Cash Path - Budget Slider */}
                {paymentMethod === 'cash' && !budgetUnlocked && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-6 bg-card rounded-xl border border-border space-y-6"
                  >
                    <h3 className="font-semibold text-lg">Set Your Budget</h3>
                    <p className="text-sm text-muted-foreground">
                      Drag the slider to set your maximum budget.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="text-center">
                        <span className="text-4xl font-bold text-primary">
                          R{budgetRange[0].toLocaleString()}
                        </span>
                      </div>
                      <Slider
                        value={budgetRange}
                        onValueChange={setBudgetRange}
                        min={50000}
                        max={2000000}
                        step={25000}
                        className="py-4"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>R50,000</span>
                        <span>R2,000,000</span>
                      </div>
                    </div>

                    <Button onClick={handleCashBudgetSet} className="w-full">
                      <Unlock className="w-4 h-4 mr-2" />
                      Confirm Budget & Continue
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* STEP 2: Vehicle Request (Locked until budget set) */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="py-20 bg-muted/30"
        >
          <div className="container mx-auto px-6">
            <div className="max-w-2xl mx-auto">
              <motion.div variants={itemVariants} className="text-center mb-12">
                <span className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block">
                  Step 2: Vehicle Request
                </span>
                <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                  What Are You Looking For?
                </h2>
              </motion.div>

              <motion.div 
                variants={itemVariants}
                className={`relative ${!budgetUnlocked ? 'pointer-events-none' : ''}`}
              >
                {/* Locked overlay */}
                {!budgetUnlocked && (
                  <div className="absolute inset-0 z-10 backdrop-blur-sm bg-background/60 rounded-xl flex flex-col items-center justify-center">
                    <Lock className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold text-muted-foreground">Complete Step 1 to Unlock</p>
                    <p className="text-sm text-muted-foreground">Set your budget first</p>
                  </div>
                )}

                <form onSubmit={handleVehicleSubmit} className="bg-card rounded-xl border border-border p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="make">Make *</Label>
                      <Input
                        id="make"
                        value={vehicleData.make}
                        onChange={(e) => setVehicleData({ ...vehicleData, make: e.target.value })}
                        placeholder="e.g. BMW"
                        disabled={!budgetUnlocked}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Model *</Label>
                      <Input
                        id="model"
                        value={vehicleData.model}
                        onChange={(e) => setVehicleData({ ...vehicleData, model: e.target.value })}
                        placeholder="e.g. 320d M Sport"
                        disabled={!budgetUnlocked}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year">Year (Optional)</Label>
                      <Input
                        id="year"
                        value={vehicleData.year}
                        onChange={(e) => setVehicleData({ ...vehicleData, year: e.target.value })}
                        placeholder="e.g. 2020-2023"
                        disabled={!budgetUnlocked}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="color">Color Preference</Label>
                      <Input
                        id="color"
                        value={vehicleData.color}
                        onChange={(e) => setVehicleData({ ...vehicleData, color: e.target.value })}
                        placeholder="e.g. Black, White"
                        disabled={!budgetUnlocked}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="additionalDetails">Additional Requirements</Label>
                    <Textarea
                      id="additionalDetails"
                      value={vehicleData.additionalDetails}
                      onChange={(e) => setVehicleData({ ...vehicleData, additionalDetails: e.target.value })}
                      placeholder="Features, mileage limit, sunroof, leather seats, etc."
                      rows={4}
                      disabled={!budgetUnlocked}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg" 
                    disabled={isSubmitting || !budgetUnlocked}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Submit Sourcing Request
                  </Button>
                </form>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Sourcing Examples Grid */}
        {sourcingExamples.length > 0 && (
          <motion.section
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="py-16 bg-muted/30"
          >
            <div className="container mx-auto px-6">
              <motion.div variants={itemVariants} className="text-center mb-12">
                <span className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block">
                  Past Sourcing Wins
                </span>
                <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                  Examples of What We Source
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Here are some examples of vehicles we've successfully sourced for clients. We can find something similar for you.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sourcingExamples.map((vehicle) => (
                  <motion.div
                    key={vehicle.id}
                    variants={itemVariants}
                    className="group relative overflow-hidden rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300"
                  >
                    {/* Vehicle Image */}
                    <div className="aspect-[16/10] overflow-hidden bg-muted">
                      {vehicle.images?.[0] ? (
                        <img
                          src={vehicle.images[0]}
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Search className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Vehicle Info */}
                    <div className="p-4 space-y-2">
                      <h3 className="font-semibold text-lg">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h3>
                      {vehicle.variant && (
                        <p className="text-sm text-muted-foreground">{vehicle.variant}</p>
                      )}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-primary font-bold">{formatPrice(vehicle.price)}</span>
                        <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                          Sourced
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

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
                <Link to="/inventory">
                  View Inventory
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </motion.section>
      </div>
    </>
  );
};

export default Sourcing;