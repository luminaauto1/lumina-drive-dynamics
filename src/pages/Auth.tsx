import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string })?.returnTo || '/';

  useEffect(() => {
    if (user) {
      navigate(returnTo);
    }
  }, [user, navigate, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          setFailedAttempts(prev => prev + 1);
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            toast.error(error.message);
          }
        } else {
          setFailedAttempts(0);
          toast.success('Welcome back!');
          navigate(returnTo);
        }
      } else {
        if (password.length < 6) {
          toast.error('Password must be at least 6 characters');
          setIsLoading(false);
          return;
        }

        const fullName = `${firstName.trim()} ${surname.trim()}`.trim();
        const { error } = await signUp(email, password, fullName, mobileNumber);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Please sign in.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Account created successfully!');
          navigate(returnTo);
        }
      }
    } catch (error: any) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Please enter your email address');
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password reset link sent! Check your email.');
        setShowResetPassword(false);
        setResetEmail('');
      }
    } catch (error: any) {
      toast.error('Failed to send reset link');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{isLogin ? 'Sign In' : 'Sign Up'} | Lumina Auto</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="glass-card rounded-2xl p-8">
            <AnimatePresence mode="wait">
              {showResetPassword ? (
                <motion.div
                  key="reset"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <button
                    onClick={() => setShowResetPassword(false)}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to login
                  </button>

                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
                    <p className="text-muted-foreground">
                      Enter your email and we'll send you a recovery link
                    </p>
                  </div>

                  <form onSubmit={handleResetPassword} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="resetEmail">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="resetEmail"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          className="pl-10 glass-card border-border"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isResetting}
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {isResetting ? 'Sending...' : 'Send Reset Link'}
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">
                      {isLogin ? 'Welcome Back' : 'Create Account'}
                    </h1>
                    <p className="text-muted-foreground">
                      {isLogin
                        ? 'Sign in to access your saved cars and account'
                        : 'Join Lumina Auto for exclusive access'}
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {!isLogin && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">First Name</Label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                              <Input
                                id="firstName"
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="John"
                                className="pl-10 glass-card border-border"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="surname">Surname</Label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                              <Input
                                id="surname"
                                type="text"
                                value={surname}
                                onChange={(e) => setSurname(e.target.value)}
                                placeholder="Doe"
                                className="pl-10 glass-card border-border"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mobileNumber">Mobile Number</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                              id="mobileNumber"
                              type="tel"
                              value={mobileNumber}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                                setMobileNumber(cleaned);
                              }}
                              placeholder="0721234567"
                              maxLength={10}
                              className="pl-10 glass-card border-border"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          className="pl-10 glass-card border-border"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="pl-10 pr-10 glass-card border-border"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      
                      {/* Forgot Password - appears after 1+ failed attempts */}
                      {isLogin && failedAttempts >= 1 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-1"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShowResetPassword(true);
                              setResetEmail(email);
                            }}
                            className="text-sm text-primary hover:text-primary/80 transition-colors"
                          >
                            Forgot your password?
                          </button>
                        </motion.div>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
                    </Button>
                  </form>

                  <div className="mt-6 text-center">
                    <button
                      onClick={() => {
                        setIsLogin(!isLogin);
                        setFailedAttempts(0);
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isLogin
                        ? "Don't have an account? Sign up"
                        : 'Already have an account? Sign in'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Auth;
