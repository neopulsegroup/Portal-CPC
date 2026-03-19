import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile,
    User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './client';

export interface UserProfile {
    email: string;
    name: string;
    role: 'migrant' | 'company' | 'admin' | 'mediator' | 'lawyer' | 'psychologist' | 'manager' | 'coordinator' | 'trainer';
    nif?: string;
    active?: boolean | null;
    disabledAt?: unknown | null;
    blocked?: boolean | null;
    blockedAt?: unknown | null;
    blockedBy?: string | null;
    createdAt: unknown;
    updatedAt: unknown;
}

function normalizeRole(role: unknown): UserProfile['role'] {
    if (typeof role !== 'string') return role as UserProfile['role'];
    const v = role.toLowerCase();
    const allowed: Array<UserProfile['role']> = ['migrant', 'company', 'admin', 'mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'trainer'];
    return (allowed.includes(v as UserProfile['role']) ? v : role) as UserProfile['role'];
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message.length > 0) {
            return message;
        }
    }
    return fallback;
}

/**
 * Register a new user with email and password
 */
export async function registerUser(
    email: string,
    password: string,
    name: string,
    role: 'migrant' | 'company' | 'admin' | 'mediator' | 'lawyer' | 'psychologist' | 'manager' | 'coordinator' | 'trainer' = 'migrant',
    additionalData?: { nif?: string }
) {
    try {
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update display name
        await updateProfile(user, { displayName: name });

        // Create user profile in Firestore
        const userProfile: UserProfile = {
            email,
            name,
            role,
            active: true,
            disabledAt: null,
            blocked: false,
            blockedAt: null,
            blockedBy: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...(additionalData?.nif && { nif: additionalData.nif }),
        };

        await setDoc(doc(db, 'users', user.uid), userProfile);

        // Create empty profile document
        await setDoc(doc(db, 'profiles', user.uid), {
            name,
            email,
            phone: null,
            birthDate: null,
            nationality: null,
            photoUrl: null,
            currentLocation: null,
            arrivalDate: null,
            updatedAt: serverTimestamp(),
        });

        if (role === 'company') {
            await setDoc(
                doc(db, 'companies', user.uid),
                {
                    user_id: user.uid,
                    company_name: name,
                    verified: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
        }

        return { user, profile: userProfile };
    } catch (error: unknown) {
        console.error('Error registering user:', error);
        throw new Error(getErrorMessage(error, 'Error registering user'));
    }
}

/**
 * Sign in user with email and password
 */
export async function loginUser(email: string, password: string) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error: unknown) {
        console.error('Error logging in:', error);
        throw new Error(getErrorMessage(error, 'Error logging in'));
    }
}

/**
 * Sign out current user
 */
export async function logoutUser() {
    try {
        await signOut(auth);
    } catch (error: unknown) {
        console.error('Error logging out:', error);
        throw new Error(getErrorMessage(error, 'Error logging out'));
    }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error: unknown) {
        console.error('Error sending password reset email:', error);
        throw new Error(getErrorMessage(error, 'Error sending password reset email'));
    }
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const data = userDoc.data() as Record<string, unknown>;
            return { ...(data as UserProfile), role: normalizeRole(data.role) };
        }
        return null;
    } catch (error: unknown) {
        console.error('Error getting user profile:', error);
        throw new Error(getErrorMessage(error, 'Error getting user profile'));
    }
}

/**
 * Update user profile in Firestore
 */
export async function updateUserProfile(userId: string, data: Partial<UserProfile>) {
    try {
        await updateDoc(doc(db, 'users', userId), {
            ...data,
            updatedAt: serverTimestamp(),
        });
    } catch (error: unknown) {
        console.error('Error updating user profile:', error);
        throw new Error(getErrorMessage(error, 'Error updating user profile'));
    }
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): User | null {
    return auth.currentUser;
}
