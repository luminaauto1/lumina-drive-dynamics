import { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import KineticText from '@/components/KineticText';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Contact = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCashBuyer, setIsCashBuyer] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    employer: '',
    salary: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Send email via edge function
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: ['lumina.auto1@gmail.com'],
          subject: `New Contact Enquiry from ${formData.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #1a1a1a; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">New Contact Enquiry</h1>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Name:</strong> ${formData.name}</p>
                <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${formData.email}</p>
                <p style="margin: 0 0 10px 0;"><strong>Phone:</strong> ${formData.phone || 'Not provided'}</p>
                <p style="margin: 0 0 10px 0;"><strong>Buyer Type:</strong> ${isCashBuyer ? 'Cash Buyer' : 'Finance Buyer'}</p>
                ${!isCashBuyer ? `
                  <p style="margin: 0 0 10px 0;"><strong>Employer:</strong> ${formData.employer || 'Not provided'}</p>
                  <p style="margin: 0 0 10px 0;"><strong>Monthly Salary:</strong> R${formData.salary || 'Not provided'}</p>
                ` : ''}
              </div>
              
              <div style="background: #fff; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                <h3 style="margin: 0 0 10px 0; color: #333;">Message:</h3>
                <p style="margin: 0; color: #666; white-space: pre-wrap;">${formData.message}</p>
              </div>
              
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                This enquiry was submitted via the Lumina Auto website.
              </p>
            </div>
          `,
        },
      });

      if (error) {
        console.error('Email send error:', error);
        toast.error('Failed to send message. Please try again.');
      } else {
        toast.success('Message sent successfully! We will get back to you soon.');
        setFormData({ name: '', email: '', phone: '', employer: '', salary: '', message: '' });
        setIsCashBuyer(false);
      }
    } catch (error) {
      console.error('Contact form error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: MapPin,
      title: 'Visit Us',
      details: ['123 Automotive Drive', 'Sandton, Johannesburg', 'South Africa'],
    },
    {
      icon: Phone,
      title: 'Call Us',
      details: ['+27 68 601 7462', '+27 11 000 1234'],
    },
    {
      icon: Mail,
      title: 'Email Us',
      details: ['hello@luminaauto.co.za', 'sales@luminaauto.co.za'],
    },
    {
      icon: Clock,
      title: 'Trading Hours',
      details: ['Mon-Fri: 08:00 - 18:00', 'Sat: 09:00 - 15:00', 'Sun: By Appointment'],
    },
  ];

  return (
    <>
      <Helmet>
        <title>Contact Us | Lumina Auto</title>
        <meta
          name="description"
          content="Get in touch with Lumina Auto. Visit our showroom or contact us for inquiries about our premium pre-owned vehicles."
        />
      </Helmet>

      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-6">
          {/* Hero */}
          <div className="text-center max-w-4xl mx-auto mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block"
            >
              Get In Touch
            </motion.span>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <KineticText>Contact Us</KineticText>
            </h1>
            <p className="text-muted-foreground text-lg">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon
              as possible.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-6">
              {contactInfo.map((info, index) => (
                <motion.div
                  key={info.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card rounded-xl p-6 flex gap-4"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <info.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">{info.title}</h3>
                    {info.details.map((detail, i) => (
                      <p key={i} className="text-muted-foreground text-sm">
                        {detail}
                      </p>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass-card rounded-xl p-8"
            >
              <h2 className="text-2xl font-bold mb-6">Send a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    required
                    className="glass-card border-border"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@example.com"
                      required
                      className="glass-card border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+27 00 000 0000"
                      className="glass-card border-border"
                    />
                  </div>
                </div>

                {/* Cash Buyer Toggle */}
                <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="cashBuyer"
                    checked={isCashBuyer}
                    onCheckedChange={(checked) => setIsCashBuyer(checked as boolean)}
                  />
                  <Label htmlFor="cashBuyer" className="text-sm cursor-pointer">
                    I am a Cash Buyer (no finance required)
                  </Label>
                </div>

                {/* Employment fields - only show for finance buyers */}
                {!isCashBuyer && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="employer">Employer (Optional)</Label>
                      <Input
                        id="employer"
                        value={formData.employer}
                        onChange={(e) => setFormData({ ...formData, employer: e.target.value })}
                        placeholder="Company name"
                        className="glass-card border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salary">Monthly Salary (Optional)</Label>
                      <Input
                        id="salary"
                        type="number"
                        value={formData.salary}
                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                        placeholder="e.g. 25000"
                        className="glass-card border-border"
                      />
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="How can we help you?"
                    rows={5}
                    required
                    className="glass-card border-border resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {isSubmitting ? (
                    'Sending...'
                  ) : (
                    <>
                      Send Message
                      <Send className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Contact;