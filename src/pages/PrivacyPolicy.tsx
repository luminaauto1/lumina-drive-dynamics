import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import KineticText from '@/components/KineticText';

const PrivacyPolicy = () => {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | Lumina Auto</title>
        <meta name="description" content="Lumina Auto Privacy Policy - How we collect, use, and protect your personal information in compliance with POPIA." />
      </Helmet>

      <div className="min-h-screen pt-24 pb-20">
        <div className="container mx-auto px-6 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              <KineticText>Privacy Policy</KineticText>
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
              <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Lumina Auto ("we", "us", or "our") is committed to protecting your privacy and ensuring that your personal information is handled in a safe and responsible manner. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our services, in compliance with the Protection of Personal Information Act (POPIA) of South Africa.
              </p>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may collect the following types of personal information:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li><strong>Identity Information:</strong> First name, surname, ID number, gender, marital status</li>
                <li><strong>Contact Information:</strong> Email address, phone number, physical address</li>
                <li><strong>Financial Information:</strong> Employment details, salary information, bank account details (for finance applications only)</li>
                <li><strong>Vehicle Preferences:</strong> Vehicle interests, wishlist items, search history</li>
                <li><strong>Technical Data:</strong> IP address, browser type, device information, cookies</li>
              </ul>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">3. Purpose of Collection</h2>
              <p className="text-muted-foreground leading-relaxed">
                We collect and process your personal information for the following purposes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>To facilitate vehicle purchases and finance applications</li>
                <li>To submit your information to financial institutions for credit assessments</li>
                <li>To communicate with you regarding your enquiries, applications, and vehicle updates</li>
                <li>To provide after-sales services and reminders</li>
                <li>To improve our website and services</li>
                <li>To comply with legal and regulatory requirements</li>
              </ul>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">4. Finance Application Data</h2>
              <p className="text-muted-foreground leading-relaxed">
                When you apply for vehicle finance through our platform, we collect additional sensitive information including your ID number, employment details, income information, and banking details. This information is:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Collected only with your explicit consent</li>
                <li>Shared with registered financial institutions and credit bureaus for the purpose of assessing your finance application</li>
                <li>Stored securely using industry-standard encryption</li>
                <li>Retained for the minimum period required by law and for legitimate business purposes</li>
              </ul>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">5. Your Rights Under POPIA</h2>
              <p className="text-muted-foreground leading-relaxed">
                As a data subject, you have the following rights:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li><strong>Right to Access:</strong> Request confirmation of whether we hold your personal information and access to such information</li>
                <li><strong>Right to Correction:</strong> Request correction or deletion of inaccurate, irrelevant, or outdated personal information</li>
                <li><strong>Right to Object:</strong> Object to the processing of your personal information in certain circumstances</li>
                <li><strong>Right to Withdraw Consent:</strong> Withdraw your consent to the processing of your personal information at any time</li>
                <li><strong>Right to Complain:</strong> Lodge a complaint with the Information Regulator</li>
              </ul>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">6. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes SSL encryption, secure data storage, access controls, and regular security assessments.
              </p>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">7. Third-Party Disclosure</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may share your personal information with:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Financial institutions and credit bureaus (for finance applications)</li>
                <li>Service providers who assist in our operations</li>
                <li>Legal authorities when required by law</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">8. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your personal information only for as long as necessary to fulfill the purposes for which it was collected, or as required by applicable laws. Finance application data is retained for a minimum of 5 years as required by financial regulations.
              </p>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">9. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at:
              </p>
              <div className="text-muted-foreground">
                <p><strong>Email:</strong> lumina.auto1@gmail.com</p>
                <p><strong>Phone:</strong> +27 68 601 7462</p>
              </div>
            </section>

            <section className="glass-card rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">10. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date. We encourage you to review this policy periodically.
              </p>
            </section>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;
