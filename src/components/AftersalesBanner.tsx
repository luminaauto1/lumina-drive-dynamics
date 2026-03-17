import { motion } from 'framer-motion';
import { ShieldCheck, Wrench, Handshake } from 'lucide-react';

const items = [
  {
    icon: ShieldCheck,
    text: 'Lumina Certified Multi-Point Quality Check on Every Vehicle.',
  },
  {
    icon: Wrench,
    text: 'Comprehensive Extended Warranties Available.',
  },
  {
    icon: Handshake,
    text: 'Dedicated Post-Delivery Support Team.',
  },
];

const AftersalesBanner = () => {
  return (
    <section className="py-12 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="flex items-start gap-4 text-center md:text-left md:items-center"
            >
              <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AftersalesBanner;
