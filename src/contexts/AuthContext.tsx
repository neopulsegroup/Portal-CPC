import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'migrant' | 'company' | 'mediator' | 'lawyer' | 'psychologist' | 'manager' | 'coordinator' | 'admin';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface TriageData {
  id: string;
  user_id: string;
  completed: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  triage: TriageData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [triage, setTriage] = useState<TriageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

<<<<<<< HEAD
  const fetchProfile = useCallback(async (userId: string, retries = 3, delay = 1000) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        console.log('Profile loaded:', data);
        setProfile(data as Profile);
      } else if (retries > 0) {
        console.log(`Profile not found, retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchProfile(userId, retries - 1, delay);
      } else {
        console.warn('Profile not found after retries. Attempting self-healing...');

        // Attempt to create profile if it doesn't exist (Self-healing)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const newProfile = {
            user_id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            role: (user.user_metadata?.role || 'migrant') as UserRole,
          };

          const { error: insertError } = await supabase.from('profiles').insert(newProfile);

          if (!insertError) {
            console.log('Self-healing successful: Profile created.');
            setProfile(newProfile as Profile);
            // Also ensure triage exists if migrant
            if (newProfile.role === 'migrant') {
              await supabase.from('triage').insert({ user_id: user.id });
              setTriage({ user_id: user.id, completed: false } as TriageData);
            }
            return;
          } else {
            console.error('Self-healing failed:', insertError);
          }
        }

        setProfile(null);
      }
    } catch (err) {
      console.error('Unexpected error in fetchProfile:', err);
=======
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data && !error) {
      setProfile(data as Profile);
>>>>>>> 351b2651eac9566321ff5dbe0b8a97e288420ce0
    }
  }, []);

  const fetchTriage = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('triage')
      .select('id, user_id, completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (data && !error) {
      setTriage(data);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchTriage(user.id);
    }
  }, [user, fetchProfile, fetchTriage]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
<<<<<<< HEAD
      const timeout = 10000; // Increased timeout to 10s
=======
      const timeout = 3000; // 3 seconds timeout
>>>>>>> 351b2651eac9566321ff5dbe0b8a97e288420ce0
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout')), timeout)
      );

      try {
        setIsLoading(true);

        // Race getSession against a timeout to prevent infinite loading if Supabase is down
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]) as { data: { session: Session | null } };

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            // Using Settled to prevent a single failing query from hanging the entire auth flow
            const results = await Promise.allSettled([
              fetchProfile(session.user.id),
              fetchTriage(session.user.id)
            ]);

            // Log any errors for visibility
            results.forEach(res => {
              if (res.status === 'rejected') console.error('Auth init fetch error:', res.reason);
            });
          } else {
            setProfile(null);
            setTriage(null);
          }
        }
      } catch (err) {
        console.error('Auth initialization failed or timed out:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        try {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
              setIsLoading(true);
              await Promise.allSettled([
                fetchProfile(session.user.id),
                fetchTriage(session.user.id)
              ]);
            } else {
              if (!profile) fetchProfile(session.user.id);
              if (!triage) fetchTriage(session.user.id);
            }
          } else {
            setProfile(null);
            setTriage(null);
          }
        } catch (err) {
          console.error('Auth state change handler failed:', err);
        } finally {
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchTriage]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
<<<<<<< HEAD
        emailRedirectTo: `${window.location.origin}/auth/callback`, // Better practice for Supabase Auth
=======
        emailRedirectTo: redirectUrl,
>>>>>>> 351b2651eac9566321ff5dbe0b8a97e288420ce0
        data: {
          name: data.name,
          role: data.role,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setTriage(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        triage,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
