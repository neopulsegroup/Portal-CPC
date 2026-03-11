import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/integrations/firebase/client';
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  UserProfile,
} from '@/integrations/firebase/auth';
import { getDocument } from '@/integrations/firebase/firestore';

export type UserRole = 'migrant' | 'company' | 'admin' | 'mediator' | 'lawyer' | 'psychologist' | 'manager' | 'coordinator' | 'trainer';

export interface Profile {
  name: string;
  email: string;
  phone?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  currentLocation?: string | null;
  arrivalDate?: string | null;
}

export interface TriageData {
  userId: string;
  completed: boolean;
  answers?: Record<string, unknown>;
  location?: string | null;
  arrivalDate?: string | null;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  profileData: Profile | null;
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
  nif?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [triage, setTriage] = useState<TriageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = useCallback(async (firebaseUser: FirebaseUser) => {
    try {
      // Fetch user profile
      const userProfile = await getUserProfile(firebaseUser.uid);
      if (userProfile) {
        setProfile(userProfile);
      }

      // Fetch profile data
      const profileDoc = await getDocument<Profile>('profiles', firebaseUser.uid);
      if (profileDoc) {
        setProfileData(profileDoc);
      }

      // Fetch triage data
      const triageDoc = await getDocument<TriageData>('triage', firebaseUser.uid);
      if (triageDoc) {
        setTriage(triageDoc);
      } else {
        // If no triage doc exists, set default/empty triage state
        // This ensures triage.completed is false, forcing redirection to /triagem
        setTriage({
          userId: firebaseUser.uid,
          completed: false
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchUserData(user);
    }
  }, [user, fetchUserData]);

  useEffect(() => {
    let mounted = true;

    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      try {
        setIsLoading(true);
        setUser(firebaseUser);

        if (firebaseUser) {
          await fetchUserData(firebaseUser);
        } else {
          setProfile(null);
          setProfileData(null);
          setTriage(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [fetchUserData]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      await loginUser(email, password);
      // onAuthStateChanged will handle the rest
    } catch (error: unknown) {
      console.error('Login error:', error);
      throw new Error(getErrorMessage(error, 'Failed to login'));
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    try {
      await registerUser(data.email, data.password, data.name, data.role, { nif: data.nif });
      // onAuthStateChanged will handle the rest
    } catch (error: unknown) {
      console.error('Registration error:', error);
      throw new Error(getErrorMessage(error, 'Failed to register'));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
      setUser(null);
      setProfile(null);
      setProfileData(null);
      setTriage(null);
    } catch (error: unknown) {
      console.error('Logout error:', error);
      throw new Error(getErrorMessage(error, 'Failed to logout'));
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        profileData,
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
