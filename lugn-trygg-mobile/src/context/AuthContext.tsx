import React, { createContext, useState, useEffect, ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { apiService } from '../services/api';
import type { User, AuthContextType } from '../types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // User logged in
        const userData: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || undefined,
        };
        setUser(userData);

        // Sync with backend
        try {
          await apiService.updateProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
          });
        } catch (error) {
          console.error('Error syncing user to backend:', error);
        }
      } else {
        // User logged out
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userData: User = {
        uid: result.user.uid,
        email: result.user.email || '',
      };
      setUser(userData);
    } catch (error: any) {
      console.error('Login error:', error);
      // Re-throw with code for better error handling in UI
      const enhancedError = new Error(error.message);
      (enhancedError as any).code = error.code;
      throw enhancedError;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<void> => {
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);

      // Create user document in Firestore
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email,
        name,
        createdAt: new Date().toISOString(),
      });

      // Sync with backend
      await apiService.updateProfile({
        uid: result.user.uid,
        email,
        name,
      });

      const userData: User = {
        uid: result.user.uid,
        email: result.user.email || '',
        name,
      };
      setUser(userData);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth login
  const loginWithGoogle = async (googleUserInfo: any): Promise<void> => {
    setLoading(true);
    try {
      // If you have an ID token from Google Sign-In:
      if (googleUserInfo.idToken) {
        const credential = GoogleAuthProvider.credential(googleUserInfo.idToken);
        const result = await signInWithCredential(auth, credential);
        
        const userData: User = {
          uid: result.user.uid,
          email: result.user.email || '',
          photoURL: result.user.photoURL || undefined,
          name: result.user.displayName || undefined,
        };
        setUser(userData);

        // Sync with backend
        await apiService.updateProfile({
          uid: result.user.uid,
          email: result.user.email,
          photoURL: result.user.photoURL,
          name: result.user.displayName,
        });
      }
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    signup,
    logout,
    loginWithGoogle,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
