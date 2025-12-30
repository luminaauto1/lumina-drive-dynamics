import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Heart, Search, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { wishlist } = useWishlist();
  const { user, isAdmin } = useAuth();

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
    { path: '/sell-your-car', label: 'Sell Your Car' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled ? 'bg-background/90 backdrop-blur-xl border-b border-border' : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                <span className="font-display font-bold text-accent-foreground text-lg">L</span>
              </div>
              <span className="font-display text-xl font-semibold tracking-wide text-foreground">
                LUMINA<span className="text-primary"> AUTO</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative text-sm font-medium tracking-wide uppercase transition-colors hover:text-primary ${
                    location.pathname === link.path ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {link.label}
                  {location.pathname === link.path && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary"
                    />
                  )}
                </Link>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              <Link
                to="/inventory"
                className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Search className="w-5 h-5" />
              </Link>

              <Link
                to="/wishlist"
                className="relative flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Heart className="w-5 h-5" />
                {wishlist.length > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-semibold"
                  >
                    {wishlist.length}
                  </motion.span>
                )}
              </Link>

              {/* Auth Button */}
              {user ? (
                <div className="hidden md:flex items-center gap-2">
                  {isAdmin && (
                    <Link to="/admin">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Settings className="w-4 h-4 mr-1" />
                        Admin
                      </Button>
                    </Link>
                  )}
                  <Link to="/dashboard">
                    <Button variant="outline" size="sm">
                      <User className="w-4 h-4 mr-1" />
                      Account
                    </Button>
                  </Link>
                </div>
              ) : (
                <Link to="/auth" className="hidden md:block">
                  <Button variant="outline" size="sm">
                    Login / Sign Up
                  </Button>
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-foreground"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-background pt-24 lg:hidden"
          >
            <div className="container px-6">
              <div className="flex flex-col gap-6">
                {navLinks.map((link, index) => (
                  <motion.div
                    key={link.path}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      to={link.path}
                      className={`block text-3xl font-display font-semibold ${
                        location.pathname === link.path ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: navLinks.length * 0.1 }}
                  className="pt-6 border-t border-border"
                >
                  {user ? (
                    <div className="flex flex-col gap-4">
                      {isAdmin && (
                        <Link to="/admin">
                          <Button variant="outline" className="w-full justify-start">
                            <Settings className="w-4 h-4 mr-2" />
                            Admin Dashboard
                          </Button>
                        </Link>
                      )}
                      <Link to="/dashboard">
                        <Button className="w-full bg-accent text-accent-foreground">
                          <User className="w-4 h-4 mr-2" />
                          My Account
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <Link to="/auth">
                      <Button className="w-full bg-accent text-accent-foreground">
                        Login / Sign Up
                      </Button>
                    </Link>
                  )}
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;