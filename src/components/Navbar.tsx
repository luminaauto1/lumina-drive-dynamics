import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Heart, Search, User, Settings, CreditCard } from 'lucide-react';
import moneyMakerIcon from '@/assets/money-maker.png.asset.json';
import { Button } from '@/components/ui/button';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import luminaLogo from '@/assets/lumina-logo.png';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { wishlist } = useWishlist();
  const { user, isStaff, isSuperAdmin } = useAuth();
  const { data: settings } = useSiteSettings();

  const showFinanceTab = settings?.show_finance_tab ?? true;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/inventory', label: 'Inventory' },
    { path: '/calculator', label: 'Calculator' },
    { path: '/sell-your-car', label: 'Sell Your Car' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' },
    ...(showFinanceTab ? [{ path: '/finance-application', label: 'Apply for Finance' }] : []),
  ];
  return <>
      <motion.nav initial={{
      y: -100
    }} animate={{
      y: 0
    }} transition={{
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1]
    }} className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'bg-background/90 backdrop-blur-xl border-b border-border' : 'bg-transparent'}`}>
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center ml-2 md:ml-8">
              <img alt="Lumina Auto" className="h-14 md:h-20 w-auto object-contain" src={luminaLogo} />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map(link => <Link key={link.path} to={link.path} className={`relative text-sm font-medium tracking-wide uppercase transition-colors hover:text-primary ${location.pathname === link.path ? 'text-primary' : 'text-muted-foreground'}`}>
                  {link.label}
                  {location.pathname === link.path && <motion.div layoutId="activeNav" className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary" />}
                </Link>)}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3 md:gap-4">
              {/* Money Maker CTA — always visible */}
              <Link
                to="/refer"
                className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-700/80 hover:border-zinc-400 bg-zinc-950/70 hover:bg-zinc-900 px-2.5 py-1 sm:px-3 sm:py-1.5 md:px-4 text-[10px] md:text-xs font-medium uppercase tracking-wider text-zinc-100 transition-colors shadow-[0_0_28px_-10px_rgba(255,255,255,0.25)]"
                aria-label="Refer and earn — Lumina Money Maker"
              >
                <img src={moneyMakerIcon.url} alt="" className="h-3 w-3 md:h-3.5 md:w-3.5 object-contain invert opacity-90 group-hover:opacity-100 transition-opacity" />
                <span>Money Maker</span>
              </Link>

              <Link to="/inventory" className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Search className="w-5 h-5" />
              </Link>


              <Link to="/wishlist" className="relative flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Heart className="w-5 h-5" />
                {wishlist.length > 0 && <motion.span initial={{
                scale: 0
              }} animate={{
                scale: 1
              }} className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-semibold">
                    {wishlist.length}
                  </motion.span>}
              </Link>

              {/* Auth Button */}
              {user ? <div className="hidden md:flex items-center gap-2">
                  {isStaff && <Link to={isSuperAdmin ? "/admin" : "/admin/leads"}>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Settings className="w-4 h-4 mr-1" />
                        Admin
                      </Button>
                    </Link>}
                  <Link to="/dashboard">
                    <Button variant="outline" size="sm">
                      <User className="w-4 h-4 mr-1" />
                      Account
                    </Button>
                  </Link>
                </div> : <Link to="/auth" className="hidden md:block">
                  <Button variant="outline" size="sm">
                    Login / Sign Up
                  </Button>
                </Link>}

              {/* Mobile Menu Toggle */}
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2 text-foreground">
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && <motion.div initial={{
        opacity: 0,
        y: -20
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        y: -20
      }} transition={{
        duration: 0.3
      }} className="fixed inset-0 z-40 bg-background pt-24 lg:hidden">
            <div className="container px-6">
              <div className="flex flex-col gap-6">
                {navLinks.map((link, index) => <motion.div key={link.path} initial={{
              opacity: 0,
              x: -20
            }} animate={{
              opacity: 1,
              x: 0
            }} transition={{
              delay: index * 0.1
            }}>
                    <Link to={link.path} className={`block text-3xl font-display font-semibold ${location.pathname === link.path ? 'text-primary' : 'text-foreground'}`}>
                      {link.label}
                    </Link>
                  </motion.div>)}

                <motion.div initial={{
              opacity: 0,
              x: -20
            }} animate={{
              opacity: 1,
              x: 0
            }} transition={{
              delay: navLinks.length * 0.1
            }} className="pt-6 border-t border-border">
                  {user ? <div className="flex flex-col gap-4">
                      {isStaff && <Link to={isSuperAdmin ? "/admin" : "/admin/leads"}>
                          <Button variant="outline" className="w-full justify-start">
                            <Settings className="w-4 h-4 mr-2" />
                            Admin Dashboard
                          </Button>
                        </Link>}
                      <Link to="/dashboard">
                        <Button className="w-full bg-accent text-accent-foreground">
                          <User className="w-4 h-4 mr-2" />
                          My Account
                        </Button>
                      </Link>
                    </div> : <Link to="/auth">
                      <Button className="w-full bg-accent text-accent-foreground">
                        Login / Sign Up
                      </Button>
                    </Link>}
                </motion.div>
              </div>
            </div>
          </motion.div>}
      </AnimatePresence>
    </>;
};
export default Navbar;