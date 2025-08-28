


import React, { createContext, useState, useEffect, ReactNode } from 'react';
// Fix: Import firebase for user type, remove v9 modular imports.
// Fix: Use Firebase v9 compat/app to get User type.
import firebase from 'firebase/compat/app';
import { auth, db } from '../services/firebase';
import { User, UserRole } from '../types';
import Spinner from '../components/ui/Spinner';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fix: Use v8 onAuthStateChanged syntax.
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: firebase.User | null) => {
      if (firebaseUser) {
        // User is signed in, get their custom role from Firestore.
        // Fix: Use v8 syntax to get a document from Firestore.
        const userDocRef = db.collection('users').doc(firebaseUser.uid);
        const userDoc = await userDocRef.get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          setCurrentUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: userData?.role || UserRole.VIEWER, // Default to viewer if role is not set
          });
        } else {
          // Handle case where user exists in Auth but not in Firestore
          // For this app, we assume this shouldn't happen in a real scenario
          // as user doc is created on sign up.
          setCurrentUser(null);
        }
      } else {
        // User is signed out
        setCurrentUser(null);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <Spinner />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};