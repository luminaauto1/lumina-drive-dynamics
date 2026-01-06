import { Link } from 'react-router-dom';
import { Instagram, Facebook, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

// TikTok icon component (not in lucide-react)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { data: settings } = useSiteSettings();

  // Dynamic settings
  const primaryPhone = settings?.primary_phone || '+27 68 601 7462';
  const secondaryPhone = settings?.secondary_phone;
  const primaryEmail = settings?.primary_email || 'lumina.auto1@gmail.com';
  const financeEmail = settings?.finance_email;
  const showLocation = settings?.show_physical_location ?? true;
  const physicalAddress = settings?.physical_address || '123 Automotive Drive, Sandton, Johannesburg, South Africa';
  const facebookUrl = settings?.facebook_url || 'https://www.facebook.com/profile.php?id=61573796805868';
  const instagramUrl = settings?.instagram_url || 'https://www.instagram.com/lumina.auto/';
  const tiktokUrl = (settings as any)?.tiktok_url || '';

  // Parse address into lines for display
  const addressLines = physicalAddress?.split(',').map(line => line.trim()) || [];

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                <span className="font-display font-bold text-accent-foreground text-lg">L</span>
              </div>
              <span className="font-display text-xl font-semibold tracking-wide">
                LUMINA<span className="text-primary"> AUTO</span>
              </span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The New Era of Vehicle Sourcing. Premium pre-owned vehicles curated for the discerning driver.
            </p>
            <div className="flex items-center gap-4">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Youtube className="w-5 h-5" />
              </a>
              {tiktokUrl && (
                <a
                  href={tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <TikTokIcon className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-6">Explore</h4>
            <ul className="space-y-3">
              {[
                { label: 'Inventory', path: '/inventory' },
                { label: 'Calculator', path: '/calculator' },
                { label: 'Sell Your Car', path: '/sell-your-car' },
                { label: 'About Us', path: '/about' },
                { label: 'Contact', path: '/contact' },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.path}
                    className="text-muted-foreground hover:text-primary transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-6">Contact</h4>
            <ul className="space-y-4">
              {showLocation && (
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-muted-foreground text-sm">
                    {addressLines.map((line, i) => (
                      <span key={i}>
                        {line}
                        {i < addressLines.length - 1 && <br />}
                      </span>
                    ))}
                  </span>
                </li>
              )}
              <li className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex flex-col">
                  <a
                    href={`tel:${primaryPhone.replace(/\s/g, '')}`}
                    className="text-muted-foreground hover:text-primary transition-colors text-sm"
                  >
                    {primaryPhone}
                  </a>
                  {secondaryPhone && (
                    <a
                      href={`tel:${secondaryPhone.replace(/\s/g, '')}`}
                      className="text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                      {secondaryPhone}
                    </a>
                  )}
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex flex-col">
                  <a
                    href={`mailto:${primaryEmail}`}
                    className="text-muted-foreground hover:text-primary transition-colors text-sm"
                  >
                    {primaryEmail}
                  </a>
                  {financeEmail && financeEmail !== primaryEmail && (
                    <a
                      href={`mailto:${financeEmail}`}
                      className="text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                      {financeEmail}
                    </a>
                  )}
                </div>
              </li>
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-6">Trading Hours</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex justify-between">
                <span>Monday - Friday</span>
                <span>08:00 - 18:00</span>
              </li>
              <li className="flex justify-between">
                <span>Saturday</span>
                <span>09:00 - 15:00</span>
              </li>
              <li className="flex justify-between">
                <span>Sunday</span>
                <span>By Appointment</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} Lumina Auto. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-primary transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
