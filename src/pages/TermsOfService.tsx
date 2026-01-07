import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import KineticText from '@/components/KineticText';

const TermsOfService = () => {
  return (
    <>
      <Helmet>
        <title>Terms of Service | Lumina Auto</title>
        <meta name="description" content="Lumina Auto Terms of Service - Terms and conditions for using our vehicle sales and finance services." />
      </Helmet>

      <div className="min-h-screen pt-24 pb-20">
        <div className="container mx-auto px-6 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              <KineticText>Terms of Service</KineticText>
            </h1>
            <p className="text-muted-foreground">
              Last updated: January 2026
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="prose prose-invert max-w-none space-y-8"
          >
            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using the Lumina Auto website and services, you accept and agree to be bound by the terms and conditions of this agreement. If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">2. Services Offered</h2>
              <p className="text-muted-foreground leading-relaxed">
                Lumina Auto provides the following services:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Sale of pre-owned motor vehicles</li>
                <li>Vehicle sourcing services</li>
                <li>Finance application facilitation</li>
                <li>Trade-in evaluations</li>
                <li>After-sales support</li>
              </ul>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">3. Vehicle Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                While we endeavor to provide accurate information about all vehicles listed on our platform:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Vehicle specifications, features, and pricing are subject to change without notice</li>
                <li>Images are for illustration purposes and may not reflect the exact vehicle</li>
                <li>Mileage readings are accurate at the time of listing but may change</li>
                <li>All vehicles are subject to prior sale</li>
                <li>A full inspection is recommended before purchase</li>
              </ul>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">4. Finance Applications</h2>
              <p className="text-muted-foreground leading-relaxed">
                Regarding finance applications submitted through our platform:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Lumina Auto acts as an intermediary between you and financial institutions</li>
                <li>Finance approval is subject to credit assessment by the relevant financial institution</li>
                <li>We do not guarantee finance approval</li>
                <li>Interest rates and terms are determined by the financing institution</li>
                <li>All information provided must be accurate and truthful</li>
                <li>Providing false information may result in criminal prosecution</li>
              </ul>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">5. Pricing and Payment</h2>
              <p className="text-muted-foreground leading-relaxed">
                All prices displayed are in South African Rand (ZAR) and:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Include VAT unless otherwise stated</li>
                <li>Are subject to change without prior notice</li>
                <li>May exclude additional fees such as registration, licensing, and delivery</li>
                <li>Deposits are non-refundable unless otherwise agreed in writing</li>
                <li>Full payment must be received before vehicle delivery</li>
              </ul>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">6. Consumer Rights</h2>
              <p className="text-muted-foreground leading-relaxed">
                In accordance with the Consumer Protection Act (CPA) of South Africa:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>You have the right to fair and honest dealing</li>
                <li>You have the right to disclosure of information</li>
                <li>You have the right to fair value, good quality, and safety</li>
                <li>You have the right to accountability from suppliers</li>
              </ul>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">7. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                To the fullest extent permitted by law, Lumina Auto shall not be liable for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Any indirect, incidental, or consequential damages</li>
                <li>Loss of profit, data, or business opportunities</li>
                <li>Damages arising from the use or inability to use our services</li>
                <li>Third-party claims or actions</li>
              </ul>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">8. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All content on this website, including but not limited to text, graphics, logos, images, and software, is the property of Lumina Auto and is protected by South African and international copyright laws. You may not reproduce, distribute, or use any content without our prior written consent.
              </p>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">9. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These terms shall be governed by and construed in accordance with the laws of the Republic of South Africa. Any disputes shall be subject to the exclusive jurisdiction of the South African courts.
              </p>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">10. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                For any questions regarding these Terms of Service, please contact us:
              </p>
              <div className="text-muted-foreground">
                <p><strong>Email:</strong> lumina.auto1@gmail.com</p>
                <p><strong>Phone:</strong> +27 68 601 7462</p>
              </div>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">11. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                Lumina Auto reserves the right to modify these terms at any time. Changes will be effective immediately upon posting to this website. Your continued use of our services after any changes constitutes acceptance of the new terms.
              </p>
            </section>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default TermsOfService;