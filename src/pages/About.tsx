import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Shield, Award, Clock, Users, CheckCircle } from 'lucide-react';
import KineticText from '@/components/KineticText';

const About = () => {
  const values = [
    {
      icon: Shield,
      title: 'Integrity',
      description: 'Transparency and honesty in every transaction.',
    },
    {
      icon: Award,
      title: 'Excellence',
      description: 'Only the finest vehicles make it to our showroom.',
    },
    {
      icon: Clock,
      title: 'Efficiency',
      description: 'Streamlined processes for a hassle-free experience.',
    },
    {
      icon: Users,
      title: 'Customer First',
      description: 'Your satisfaction is our ultimate goal.',
    },
  ];

  const milestones = [
    { year: '2010', event: 'Lumina Auto founded in Johannesburg' },
    { year: '2015', event: 'Expanded to 120+ brand partnerships' },
    { year: '2018', event: 'Approved by 6 major South African banks' },
    { year: '2020', event: 'Achieved zero return record' },
    { year: '2023', event: 'Introduced 101-point certified inspection' },
  ];

  return (
    <>
      <Helmet>
        <title>About Us | Lumina Auto</title>
        <meta
          name="description"
          content="Learn about Lumina Auto's commitment to excellence in pre-owned luxury vehicles."
        />
      </Helmet>

      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-6">
          {/* Hero */}
          <div className="text-center max-w-4xl mx-auto mb-20">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block"
            >
              About Lumina Auto
            </motion.span>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <KineticText>Driven by Passion</KineticText>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Since 2010, Lumina Auto has been South Africa's trusted destination for premium
              pre-owned luxury vehicles. We believe that owning an exceptional car should be an
              exceptional experience.
            </p>
          </div>

          {/* Values */}
          <section className="mb-20">
            <h2 className="text-3xl font-bold text-center mb-12">
              <KineticText>Our Values</KineticText>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value, index) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card rounded-xl p-6 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <value.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                  <p className="text-muted-foreground text-sm">{value.description}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Timeline */}
          <section className="mb-20">
            <h2 className="text-3xl font-bold text-center mb-12">
              <KineticText>Our Journey</KineticText>
            </h2>
            <div className="max-w-3xl mx-auto">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={milestone.year}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="flex items-start gap-6 mb-8"
                >
                  <div className="w-20 flex-shrink-0 text-right">
                    <span className="text-2xl font-bold gradient-text">{milestone.year}</span>
                  </div>
                  <div className="flex-shrink-0 mt-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 glass-card rounded-lg p-4">
                    <p className="text-foreground">{milestone.event}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Stats */}
          <section className="glass-card rounded-2xl p-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold gradient-text mb-2">120+</div>
                <div className="text-muted-foreground text-sm uppercase tracking-wider">
                  Brands Sourced
                </div>
              </div>
              <div>
                <div className="text-4xl font-bold gradient-text mb-2">6</div>
                <div className="text-muted-foreground text-sm uppercase tracking-wider">
                  Major Banks
                </div>
              </div>
              <div>
                <div className="text-4xl font-bold gradient-text mb-2">Zero</div>
                <div className="text-muted-foreground text-sm uppercase tracking-wider">
                  Return Record
                </div>
              </div>
              <div>
                <div className="text-4xl font-bold gradient-text mb-2">101</div>
                <div className="text-muted-foreground text-sm uppercase tracking-wider">
                  Point Inspection
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default About;