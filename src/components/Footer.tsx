import { Link } from 'react-router-dom';
import { Instagram, Facebook, Youtube, Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

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
              Premium pre-owned vehicles curated for the discerning driver. Every car tells a story
              of excellence.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://www.instagram.com/lumina.auto/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61573796805868"
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
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-6">Explore</h4>
            <ul className="space-y-3">
              {[
                { label: 'Inventory', path: '/inventory' },
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
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <span className="text-muted-foreground text-sm">
                  123 Automotive Drive
                  <br />
                  Sandton, Johannesburg
                  <br />
                  South Africa
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-primary" />
                <a
                  href="tel:+27686017462"
                  className="text-muted-foreground hover:text-primary transition-colors text-sm"
                >
                  +27 68 601 7462
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary" />
                <a
                  href="mailto:hello@luminaauto.co.za"
                  className="text-muted-foreground hover:text-primary transition-colors text-sm"
                >
                  hello@luminaauto.co.za
                </a>
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