import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Heart, Search } from 'lucide-react';
import { useWishlist } from '@/hooks/useWishlist';
const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const {
    wishlist
  } = useWishlist();
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
  const navLinks = [{
    path: '/',
    label: 'Home'
  }, {
    path: '/inventory',
    label: 'Inventory'
  }, {
    path: '/sell-your-car',
    label: 'Sell Your Car'
  }, {
    path: '/about',
    label: 'About'
  }, {
    path: '/contact',
    label: 'Contact'
  }];
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
            <Link to="/" className="flex items-center gap-3" data-cursor-hover>
              <div className="w-10 h-10 rounded-full bg-gradient-gold flex items-center justify-center">
                <span className="font-display font-bold text-background text-lg">L</span>
              </div>
              <span className="font-display text-xl font-semibold tracking-wide text-secondary-foreground">
                LUMINA<span className="text-secondary-foreground"> AUTO</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map(link => <Link key={link.path} to={link.path} className={`relative text-sm font-medium tracking-wide uppercase transition-colors hover:text-primary ${location.pathname === link.path ? 'text-primary' : 'text-muted-foreground'}`} data-cursor-hover>
                  {link.label}
                  {location.pathname === link.path && <motion.div layoutId="activeNav" className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary" />}
                </Link>)}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              <Link to="/inventory" className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors" data-cursor-hover>
                <Search className="w-5 h-5" />
              </Link>

              <Link to="/wishlist" className="relative flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors" data-cursor-hover>
                <Heart className="w-5 h-5" />
                {wishlist.length > 0 && <motion.span initial={{
                scale: 0
              }} animate={{
                scale: 1
              }} className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-semibold">
                    {wishlist.length}
                  </motion.span>}
              </Link>

              {/* Mobile Menu Toggle */}
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2 text-foreground" data-cursor-hover>
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
              </div>
            </div>
          </motion.div>}
      </AnimatePresence>
    </>;
};
export default Navbar;