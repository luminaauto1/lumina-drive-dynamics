import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ChevronDown, Shield, Award, Clock, Car } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import KineticText, { RevealText } from '@/components/KineticText';
import ParallaxCar from '@/components/ParallaxCar';
import VehicleCard from '@/components/VehicleCard';
import { vehicles } from '@/data/vehicles';
const Index = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const {
    scrollYProgress
  } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start']
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const featuredVehicles = vehicles.filter(v => v.status === 'available').slice(0, 4);
  const stats = [{
    value: '500+',
    label: 'Vehicles Sold'
  }, {
    value: '98%',
    label: 'Client Satisfaction'
  }, {
    value: '15+',
    label: 'Years Experience'
  }, {
    value: '24/7',
    label: 'Support'
  }];
  const features = [{
    icon: Shield,
    title: 'Quality Assured',
    description: 'Every vehicle undergoes a rigorous 150-point inspection.'
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
  return <>
      <Helmet>
        <title>Lumina Auto | Premium Pre-Owned Luxury Vehicles</title>
        <meta name="description" content="Discover South Africa's finest collection of pre-owned luxury vehicles. BMW, Mercedes, Porsche, Lamborghini & more. Premium quality, competitive financing." />
        <script type="application/ld+json">
          {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'AutoDealer',
          name: 'Lumina Auto',
          description: 'Premium Pre-Owned Luxury Vehicles',
          url: 'https://luminaauto.co.za'
        })}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section ref={heroRef} className="relative h-screen overflow-hidden">
        <motion.div style={{
        opacity: heroOpacity,
        scale: heroScale,
        y: heroY
      }} className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/30 to-background z-10" />
          <img src="https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1920&q=80" alt="Luxury Car" className="w-full h-full object-cover" />
        </motion.div>

        <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-6">
          <motion.div initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          duration: 1,
          delay: 0.5
        }} className="mb-6">
            <span className="text-primary text-sm font-semibold uppercase tracking-[0.3em]">CAR FINANCING LIKE YOU WANT IT</span>
          </motion.div>

          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-6 max-w-5xl">
            <KineticText delay={0.3}>
              Drive Your
            </KineticText>
            <br />
            <span className="gradient-text">
              <KineticText delay={0.6}>
                Aspirations
              </KineticText>
            </span>
          </h1>

          <RevealText delay={0.9} className="text-muted-foreground text-lg md:text-xl max-w-2xl mb-10">
            Curated excellence. Every vehicle in our collection has been selected 
            for those who refuse to compromise.
          </RevealText>

          <motion.div initial={{
          opacity: 0,
          y: 30
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.6,
          delay: 1.2
        }} className="flex flex-col sm:flex-row items-center gap-4">
            <Link to="/inventory">
              <Button size="lg" className="bg-gradient-gold text-primary-foreground hover:opacity-90 group">
                Explore Inventory
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/sell-your-car">
              <Button size="lg" variant="outline" className="border-border hover:bg-secondary">
                Sell Your Car
              </Button>
            </Link>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          delay: 2
        }} className="absolute bottom-10 left-1/2 -translate-x-1/2">
            <motion.div animate={{
            y: [0, 10, 0]
          }} transition={{
            duration: 2,
            repeat: Infinity
          }} className="flex flex-col items-center gap-2 text-muted-foreground">
              <span className="text-xs uppercase tracking-widest">Scroll</span>
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Parallax Car Section */}
      <ParallaxCar />

      {/* Stats Section */}
      <section className="py-20 bg-card border-y border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => <motion.div key={stat.label} initial={{
            opacity: 0,
            y: 20
          }} whileInView={{
            opacity: 1,
            y: 0
          }} viewport={{
            once: true
          }} transition={{
            delay: index * 0.1
          }} className="text-center">
                <div className="font-display text-4xl md:text-5xl font-bold gradient-text mb-2">
                  {stat.value}
                </div>
                <div className="text-muted-foreground text-sm uppercase tracking-wider">
                  {stat.label}
                </div>
              </motion.div>)}
          </div>
        </div>
      </section>

      {/* Featured Vehicles */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <motion.span initial={{
              opacity: 0
            }} whileInView={{
              opacity: 1
            }} viewport={{
              once: true
            }} className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block">
                Featured Collection
              </motion.span>
              <h2 className="font-display text-4xl md:text-5xl font-bold">
                <KineticText>Exceptional Vehicles</KineticText>
              </h2>
            </div>
            <Link to="/inventory" data-cursor-hover>
              <Button variant="outline" className="group">
                View All
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredVehicles.map(vehicle => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-card">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.span initial={{
            opacity: 0
          }} whileInView={{
            opacity: 1
          }} viewport={{
            once: true
          }} className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block">
              Why Lumina
            </motion.span>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
              <KineticText>The Lumina Difference</KineticText>
            </h2>
            <p className="text-muted-foreground text-lg">
              We don&apos;t just sell cars. We curate experiences for those who 
              appreciate the finer things in life.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => <motion.div key={feature.title} initial={{
            opacity: 0,
            y: 30
          }} whileInView={{
            opacity: 1,
            y: 0
          }} viewport={{
            once: true
          }} transition={{
            delay: index * 0.1
          }} className="group p-8 rounded-lg bg-background border border-border hover:border-primary/50 transition-all duration-300">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>)}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
              <KineticText>Ready to Find Your Next Car?</KineticText>
            </h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">
              Whether you&apos;re buying or selling, our team of experts is here 
              to guide you every step of the way.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/inventory">
                <Button size="lg" className="bg-gradient-gold text-primary-foreground hover:opacity-90">
                  Browse Inventory
                </Button>
              </Link>
              <a href="https://wa.me/27110001234" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline">
                  WhatsApp Us
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>
    </>;
};
export default Index;