import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ChevronDown, Shield, Award, Clock, Car } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import KineticText from '@/components/KineticText';
import GolfGTIAnimation from '@/components/GolfGTIAnimation';
import FacebookFeed from '@/components/FacebookFeed';
import VehicleCard from '@/components/VehicleCard';
import SkeletonCard from '@/components/SkeletonCard';
import { useVehicles } from '@/hooks/useVehicles';
import { useSiteSettings } from '@/hooks/useSiteSettings';
const Index = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const {
    data: settings
  } = useSiteSettings();
  const {
    scrollYProgress: heroScrollProgress
  } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start']
  });
  const {
    scrollYProgress: contentScrollProgress
  } = useScroll({
    target: contentRef,
    offset: ['start end', 'start center']
  });
  const heroOpacity = useTransform(heroScrollProgress, [0, 0.8], [1, 0]);
  const heroScale = useTransform(heroScrollProgress, [0, 1], [1, 1.1]);
  const overlayOpacity = useTransform(heroScrollProgress, [0.3, 0.8], [0, 1]);
  const contentY = useTransform(contentScrollProgress, [0, 1], [100, 0]);
  const contentOpacity = useTransform(contentScrollProgress, [0, 1], [0, 1]);
  const {
    data: vehicles = [],
    isLoading
  } = useVehicles();
  const featuredVehicles = vehicles.filter(v => v.status === 'available').slice(0, 4);

  // Dynamic headline from settings - updated for sourcing emphasis
  const heroHeadline = settings?.hero_headline || 'Premium Stock & Bespoke Sourcing';
  const heroSubheadline = settings?.hero_subheadline || 'The New Era of Vehicle Sourcing';
  const whatsappNumber = settings?.whatsapp_number || '27686017462';

  // Split headline for styling (assumes format "Word Word Word")
  const headlineParts = heroHeadline.split(' ');
  const lastWord = headlineParts.pop() || '';
  const firstWords = headlineParts.join(' ');
  const stats = [{
    value: '120+',
    label: 'Brands Sourced'
  }, {
    value: '6',
    label: 'Major Banks Approved'
  }, {
    value: 'Zero',
    label: 'Return Record'
  }, {
    value: '101',
    label: 'Point Inspection'
  }];
  const features = [{
    icon: Shield,
    title: 'Quality Assured',
    description: 'Every vehicle undergoes a rigorous 101-point inspection.'
  }, {
    icon: Award,
    title: 'Premium Selection',
    description: 'Curated collection of the finest pre-owned luxury vehicles.'
  }, {
    icon: Clock,
    title: 'Fast Financing',
    description: 'Approval in minutes, not days. Competitive rates guaranteed.'
  }, {
    icon: Car,
    title: 'Trade-In Experts',
    description: 'Get the best value for your current vehicle.'
  }];
  const containerVariants = {
    hidden: {
      opacity: 0
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };
  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 60,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: "easeOut" as const
      }
    }
  };
  return <>
      <Helmet>
        <title>Lumina Auto | Premium Pre-Owned Luxury Vehicles</title>
        <meta name="description" content="Discover South Africa's finest collection of pre-owned luxury vehicles. BMW, Mercedes, Porsche, Lamborghini & more. Premium quality, competitive financing." />
      </Helmet>

      {/* Fullscreen Hero Video Section - Standalone */}
      <section ref={heroRef} className="relative h-[42vh] sm:h-[50vh] md:h-screen overflow-hidden">
        <motion.div style={{
        opacity: heroOpacity,
        scale: heroScale
      }} className="absolute inset-0 overflow-hidden">
          {/* Video Background - Optimized positioning */}
          <video autoPlay muted loop playsInline preload="metadata" style={{
          objectPosition: 'center 10%'
        }} className="w-full h-full object-contain md:object-cover shadow-inner rounded-none">
            <source src="/videos/hero-video-new.mp4" type="video/mp4" />
          </video>
        </motion.div>

        {/* Fade to black overlay on scroll */}
        <motion.div style={{
        opacity: overlayOpacity
      }} className="absolute inset-0 bg-background z-10 pointer-events-none" />

        {/* Minimal scroll indicator */}
        <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} transition={{
        delay: 2
      }} className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
          <motion.div animate={{
          y: [0, 10, 0]
        }} transition={{
          duration: 2,
          repeat: Infinity
        }} className="flex flex-col items-center gap-2 text-foreground/80">
            <ChevronDown className="w-6 h-6 drop-shadow-lg" />
          </motion.div>
        </motion.div>
      </section>

      {/* Content Reveal Section */}
      <motion.div ref={contentRef} style={{
      y: contentY,
      opacity: contentOpacity
    }}>
        {/* Hero Text Section - Reveals on Scroll */}
        <motion.section className="py-24 md:py-32 text-center" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{
        once: true,
        margin: "-50px"
      }}>
          <div className="container mx-auto px-6">
            <motion.span variants={itemVariants} className="text-primary text-sm font-semibold uppercase tracking-[0.3em] mb-6 block">
              {heroSubheadline}
            </motion.span>

            <motion.h1 variants={itemVariants} className="font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-6 max-w-5xl mx-auto">
              <span>{firstWords}</span>
              <br />
              <span className="gradient-text">{lastWord}</span>
            </motion.h1>

            <motion.p variants={itemVariants} className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10">
              Curated excellence. Every vehicle in our collection has been selected for those who
              refuse to compromise.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/sourcing">
                <Button size="lg" className="bg-foreground text-background hover:bg-foreground/90 group shadow-xl">
                  Start Sourcing
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/inventory">
                <Button size="lg" variant="outline" className="border-foreground/30 text-foreground hover:bg-foreground/10">
                  View Stock
                </Button>
              </Link>
            </motion.div>
          </div>
        </motion.section>

        {/* How We Work Section */}
        <motion.section className="py-20 bg-card border-y border-border" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{
        once: true,
        margin: "-100px"
      }}>
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
              {[{
              step: 1,
              title: 'Application',
              description: 'Secure your finance budget first.'
            }, {
              step: 2,
              title: 'Selection',
              description: 'We source vehicles that match your exact specs from 120+ partners.'
            }, {
              step: 3,
              title: 'Delivery',
              description: 'Verified, tested, and delivered to your door.'
            }].map(item => <motion.div key={item.step} variants={itemVariants} className="relative text-center p-8 bg-background rounded-xl border border-border">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    {item.step}
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-3 mt-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </motion.div>)}
            </div>
          </div>
        </motion.section>

        {/* Golf GTI Animation - replaces ParallaxCar */}
        <GolfGTIAnimation />

        {/* Stats Section */}
        <motion.section className="py-20 bg-card border-y border-border" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{
        once: true,
        margin: "-100px"
      }}>
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map(stat => <motion.div key={stat.label} variants={itemVariants} className="text-center">
                  <div className="font-display text-4xl md:text-5xl font-bold gradient-text mb-2">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground text-sm uppercase tracking-wider">
                    {stat.label}
                  </div>
                </motion.div>)}
            </div>
          </div>
        </motion.section>

        {/* Featured Vehicles */}
        <motion.section className="py-24" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{
        once: true,
        margin: "-100px"
      }}>
          <div className="container mx-auto px-6">
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <span className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block">
                  Featured Collection
                </span>
                <h2 className="font-display text-4xl md:text-5xl font-bold">
                  <KineticText>Exceptional Vehicles</KineticText>
                </h2>
              </div>
              <Link to="/inventory">
                <Button variant="outline" className="group">
                  View All
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>

            {isLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SkeletonCard count={4} />
              </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredVehicles.map((vehicle, index) => <motion.div key={vehicle.id} variants={itemVariants} custom={index}>
                    <VehicleCard vehicle={vehicle} />
                  </motion.div>)}
              </div>}
          </div>
        </motion.section>

        {/* Features */}
        <motion.section className="py-24 bg-card" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{
        once: true,
        margin: "-100px"
      }}>
          <div className="container mx-auto px-6">
            <motion.div variants={itemVariants} className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block">
                Why Lumina
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
                <KineticText>The Lumina Difference</KineticText>
              </h2>
              <p className="text-muted-foreground text-lg">
                We don't just sell cars. We curate experiences for those who appreciate the finer
                things in life.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => <motion.div key={feature.title} variants={itemVariants} custom={index} className="group p-8 rounded-lg bg-background border border-border hover:border-primary/50 transition-all duration-300">
                  <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </motion.div>)}
            </div>
          </div>
        </motion.section>

        {/* CTA Section */}

        {/* CTA Section */}
        <motion.section className="py-24 relative overflow-hidden" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{
        once: true,
        margin: "-100px"
      }}>
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
          <div className="container mx-auto px-6 relative z-10">
            <motion.div variants={itemVariants} className="max-w-4xl mx-auto text-center">
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
                <KineticText>Ready to Find Your Next Car?</KineticText>
              </h2>
              <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">
                Whether you're buying or selling, our team of experts is here to guide you every step
                of the way.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/inventory">
                  <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                    Browse Inventory
                  </Button>
                </Link>
                <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline">
                    WhatsApp Us
                  </Button>
                </a>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Facebook Feed Section */}
        <FacebookFeed />
      </motion.div>
    </>;
};
export default Index;