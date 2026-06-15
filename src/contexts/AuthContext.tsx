import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type StaffRole = 'super_admin' | 'sales_agent' | 'f_and_i' | 'senior_f_and_i' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True for super admins (legacy 'admin' role). Sales agents are NOT admins. */
  isAdmin: boolean;
  /** True for super admins only. Alias of isAdmin for clarity in new code. */
  isSuperAdmin: boolean;
  /** True for sales_agent role. */
  isSalesAgent: boolean;
  /** True for f_and_i role (standard or senior). */
  isFAndI: boolean;
  /** True specifically for senior_f_and_i role. */
  isSeniorFAndI: boolean;
  /** True for accountant role — inherits Senior F&I permissions plus access to the Accounting ledger. */
  isAccountant: boolean;
  /** True if the user is any staff member. */
  isStaff: boolean;
  /** Normalized role label, or null if not staff. */
  role: StaffRole;
  signUp: (email: string, password: string, fullName?: string, phone?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<StaffRole>(null);
  const [isAccountant, setIsAccountant] = useState(false);


  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST (before getSession)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        // Handle PASSWORD_RECOVERY event - redirect to update password page
        if (event === 'PASSWORD_RECOVERY') {
          window.location.href = '/update-password';
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);

        // Check role after auth state change. Keep `loading` TRUE until the role
        // is resolved (fetchRole flips it off) so route guards don't bounce
        // admins to the homepage before their roles have loaded.
        if (session?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase client
          setTimeout(() => {
            if (mounted) {
              fetchRole(session.user.id);
            }
          }, 0);
        } else {
          setRole(null);
          setIsAccountant(false);
          setLoading(false);
        }
      }
    );

    // Get initial session (important for mobile refresh persistence)
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            // fetchRole flips `loading` off once the role is known.
            fetchRole(session.user.id);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchRole = async (userId: string) => {
    try {
      // Fetch all roles for this user; pick highest privilege
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const roles = (data || []).map((r: any) => r.role as string);
      setIsAccountant(roles.includes('accountant'));
      if (roles.includes('admin')) {
        setRole('super_admin');
      } else if (roles.includes('sales_agent')) {
        setRole('sales_agent');
      } else if (roles.includes('senior_f_and_i') || roles.includes('accountant')) {
        // Accountants inherit Senior F&I operational permissions
        setRole('senior_f_and_i');
      } else if (roles.includes('f_and_i')) {
        setRole('f_and_i');
      } else {
        setRole(null);
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
      setRole(null);
    } finally {
      // Auth is only fully resolved once the role is known — release route guards now.
      setLoading(false);
    }
  };


  const signUp = async (email: string, password: string, fullName?: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setIsAccountant(false);
  };

  const isSuperAdmin = role === 'super_admin';
  const isSalesAgent = role === 'sales_agent';
  const isSeniorFAndI = role === 'senior_f_and_i';
  const isFAndI = role === 'f_and_i' || isSeniorFAndI;
  const isStaff = isSuperAdmin || isSalesAgent || isFAndI || isAccountant;
  // Backwards-compat: existing code uses isAdmin to mean "full access".
  // Sales agents are NOT admins.
  const isAdmin = isSuperAdmin;

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isSuperAdmin, isSalesAgent, isFAndI, isSeniorFAndI, isAccountant, isStaff, role, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};