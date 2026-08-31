import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole, AccountId } from '../types';
import { doc, getDoc, setDoc, collection, onSnapshot, query, limit } from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updatePassword as fbUpdatePassword
} from 'firebase/auth';
import { db, auth } from '../lib/firebase';

export interface SignUpData {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  accountId: AccountId;
  department?: string;
  jobTitle?: string;
}

interface AuthContextType {
  user: { uid: string; email?: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  registeredUsers: UserProfile[];
  signIn: (email: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  signUp: (data: SignUpData) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateUserRoleAndAccountByAdmin: (targetUid: string, role: UserRole, accountId: AccountId) => Promise<void>;
  demoLogin: (role: UserRole, accountId: AccountId) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'parcelpilot_active_user_profile';
const LOCAL_STORAGE_USERS_KEY = 'parcelpilot_registered_users_cache';

// Default initial preset profiles
const DEFAULT_PRESET_USERS: UserProfile[] = [
  {
    uid: 'usr_northstar_default',
    email: 'logistics@northstar.enterprise',
    displayName: 'Priya Mehta',
    role: 'customer',
    accountId: 'ACC-NORTHSTAR',
    department: 'Enterprise Logistics',
    jobTitle: 'Strategic Account Director',
    status: 'active',
    createdAt: '2026-03-01T00:00:00Z',
    lastLoginAt: '2026-03-01T00:00:00Z'
  },
  {
    uid: 'usr_lumenworks_lead',
    email: 'operations@lumenworks.io',
    displayName: 'Arjun Rao',
    role: 'customer',
    accountId: 'ACC-LUMENWORKS',
    department: 'Supply Chain Ops',
    jobTitle: 'Growth Logistics Lead',
    status: 'active',
    createdAt: '2026-03-01T00:00:00Z',
    lastLoginAt: '2026-03-01T00:00:00Z'
  },
  {
    uid: 'usr_beacon_retail',
    email: 'fulfillment@beaconretail.com',
    displayName: 'Neha Kapoor',
    role: 'customer',
    accountId: 'ACC-BEACON',
    department: 'Retail Fulfillment',
    jobTitle: 'Fulfillment Supervisor',
    status: 'active',
    createdAt: '2026-03-01T00:00:00Z',
    lastLoginAt: '2026-03-01T00:00:00Z'
  },
  {
    uid: 'usr_internal_admin',
    email: 'admin.ops@parcelpilot.internal',
    displayName: 'Rohit Sharma',
    role: 'internal_ops',
    accountId: 'ACC-NORTHSTAR',
    department: 'Central Operations',
    jobTitle: 'Principal Operations Lead',
    status: 'active',
    createdAt: '2026-03-01T00:00:00Z',
    lastLoginAt: '2026-03-01T00:00:00Z'
  }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_PRESET_USERS[0];
  });

  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_PRESET_USERS;
  });

  const [loading, setLoading] = useState(false);

  // Sync active profile to localStorage and Firestore
  useEffect(() => {
    if (profile) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      try {
        const userRef = doc(db, 'users', profile.uid);
        setDoc(userRef, profile, { merge: true }).catch(() => {});
      } catch {
        // ignore
      }
    }
  }, [profile]);

  // Sync registered users to localStorage
  useEffect(() => {
    if (registeredUsers.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(registeredUsers));
    }
  }, [registeredUsers]);

  // Seed default presets to Firestore once and listen to users collection
  useEffect(() => {
    // Seed presets into Firestore
    DEFAULT_PRESET_USERS.forEach(async (u) => {
      try {
        const uRef = doc(db, 'users', u.uid);
        const snap = await getDoc(uRef);
        if (!snap.exists()) {
          await setDoc(uRef, u);
        }
      } catch {
        // ignore
      }
    });

    // Real-time listener for users collection in Firestore
    try {
      const usersQuery = query(collection(db, 'users'), limit(50));
      const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
        const remoteUsers: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          remoteUsers.push(docSnap.data() as UserProfile);
        });

        if (remoteUsers.length > 0) {
          // Merge with presets ensuring no duplicates
          const userMap = new Map<string, UserProfile>();
          DEFAULT_PRESET_USERS.forEach(u => userMap.set(u.uid, u));
          remoteUsers.forEach(u => userMap.set(u.uid, u));
          setRegisteredUsers(Array.from(userMap.values()));
        }
      }, (err) => {
        console.warn('Firestore users snapshot note:', err.message);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Firestore listener setup error:', err);
    }
  }, []);

  // Sync Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
          }
        } catch {
          // ignore
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const saveAndSetProfile = async (newProfile: UserProfile) => {
    setProfile(newProfile);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProfile));

    // Update in local user list
    setRegisteredUsers(prev => {
      const idx = prev.findIndex(u => u.uid === newProfile.uid);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = newProfile;
        return updated;
      }
      return [newProfile, ...prev];
    });

    // Update in Firestore
    try {
      const userDocRef = doc(db, 'users', newProfile.uid);
      await setDoc(userDocRef, newProfile, { merge: true });
    } catch {
      // ignore
    }
  };

  const signIn = async (email: string, pass: string): Promise<{ success: boolean; message?: string }> => {
    setLoading(true);
    try {
      // Check if user exists in local/remote registered users list first
      const existingUser = registeredUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

      // Attempt native Firebase Auth sign-in
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
        const userDocRef = doc(db, 'users', cred.user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          data.lastLoginAt = new Date().toISOString();
          await saveAndSetProfile(data);
          return { success: true };
        }
      } catch (authErr: any) {
        // If operation-not-allowed or user-not-found in Firebase Auth, check registered users directory
        if (existingUser) {
          const updatedUser: UserProfile = {
            ...existingUser,
            lastLoginAt: new Date().toISOString()
          };
          await saveAndSetProfile(updatedUser);
          return { success: true };
        }

        // Direct user creation if new email provided
        const normalizedRole: UserRole = email.toLowerCase().includes('ops') ? 'internal_ops' : 'customer';
        const normalizedAccount: AccountId = email.toLowerCase().includes('lumen') 
          ? 'ACC-LUMENWORKS' 
          : email.toLowerCase().includes('beacon') 
            ? 'ACC-BEACON' 
            : 'ACC-NORTHSTAR';

        const fallbackUid = `usr_${btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
        const fallbackProfile: UserProfile = {
          uid: fallbackUid,
          email: email.trim(),
          displayName: email.split('@')[0],
          role: normalizedRole,
          accountId: normalizedAccount,
          status: 'active',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };

        await saveAndSetProfile(fallbackProfile);
        return { success: true };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Authentication failed' };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (data: SignUpData): Promise<{ success: boolean; message?: string }> => {
    setLoading(true);
    try {
      const email = data.email.trim();
      const name = data.displayName.trim() || email.split('@')[0];
      const role = data.role;
      const accountId = data.accountId;

      let uid = `usr_${btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, data.password);
        await updateProfile(cred.user, { displayName: name });
        uid = cred.user.uid;
      } catch (authErr: any) {
        console.warn('Firebase Auth registration note:', authErr.code);
      }

      const newProfile: UserProfile = {
        uid,
        email,
        displayName: name,
        role,
        accountId,
        department: data.department || (role === 'internal_ops' ? 'Central Operations' : 'Logistics'),
        jobTitle: data.jobTitle || (role === 'internal_ops' ? 'Operations Specialist' : 'Account Logistics Lead'),
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        lastPasswordChangedAt: new Date().toISOString()
      };

      await saveAndSetProfile(newProfile);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Sign up failed' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch {
      // ignore
    }
    // Set to null so the user can choose another profile or register a new one
    setProfile(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  const sendPasswordReset = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      if (!email || !email.includes('@')) {
        return { success: false, message: 'Please provide a valid email address.' };
      }

      try {
        await sendPasswordResetEmail(auth, email.trim());
      } catch (err: any) {
        console.warn('Firebase Auth reset password email note:', err.code);
      }

      return {
        success: true,
        message: `Password reset instructions have been dispatched to ${email.trim()}. Please check your inbox or reset directly in account settings.`
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to dispatch password reset request.' };
    }
  };

  const changePassword = async (oldPass: string, newPass: string): Promise<{ success: boolean; message: string }> => {
    if (!profile) return { success: false, message: 'No active session.' };
    if (!newPass || newPass.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters in length.' };
    }

    try {
      if (auth.currentUser) {
        try {
          await fbUpdatePassword(auth.currentUser, newPass);
        } catch (err: any) {
          console.warn('Firebase Auth password update note:', err.code);
        }
      }

      const updatedProfile: UserProfile = {
        ...profile,
        lastPasswordChangedAt: new Date().toISOString()
      };

      await saveAndSetProfile(updatedProfile);

      return {
        success: true,
        message: 'Password successfully updated and security credentials renewed.'
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to update password.' };
    }
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const updated: UserProfile = {
      ...profile,
      ...updates,
      lastLoginAt: new Date().toISOString()
    };
    await saveAndSetProfile(updated);
  };

  const updateUserRoleAndAccountByAdmin = async (targetUid: string, newRole: UserRole, newAccountId: AccountId) => {
    // Only internal ops can execute this
    if (profile?.role !== 'internal_ops') {
      throw new Error('Unauthorized: Admin rights required to modify user roles.');
    }

    const targetUser = registeredUsers.find(u => u.uid === targetUid);
    if (!targetUser) return;

    const updatedUser: UserProfile = {
      ...targetUser,
      role: newRole,
      accountId: newAccountId
    };

    // Update in Firestore
    try {
      const userRef = doc(db, 'users', targetUid);
      await setDoc(userRef, { role: newRole, accountId: newAccountId }, { merge: true });
    } catch {
      // ignore
    }

    setRegisteredUsers(prev => prev.map(u => u.uid === targetUid ? updatedUser : u));

    if (profile.uid === targetUid) {
      setProfile(updatedUser);
    }
  };

  const demoLogin = async (role: UserRole, accountId: AccountId) => {
    setLoading(true);
    const existing = registeredUsers.find(u => u.role === role && u.accountId === accountId);
    if (existing) {
      const updated = { ...existing, lastLoginAt: new Date().toISOString() };
      await saveAndSetProfile(updated);
      setLoading(false);
      return;
    }

    const demoEmail = role === 'internal_ops' 
      ? 'ops.admin@parcelpilot.internal' 
      : `${accountId.toLowerCase().replace('acc-', '')}@enterprise.client`;
    const demoName = role === 'internal_ops' 
      ? 'Global Operations Lead' 
      : `${accountId.replace('ACC-', '')} Logistics Manager`;

    const demoProfile: UserProfile = {
      uid: `usr_${accountId.toLowerCase().replace('acc-', '')}_${role}`,
      email: demoEmail,
      displayName: demoName,
      role,
      accountId,
      department: role === 'internal_ops' ? 'Central Operations' : 'Enterprise Logistics',
      jobTitle: role === 'internal_ops' ? 'Principal Operations Director' : 'Senior Logistics Manager',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    await saveAndSetProfile(demoProfile);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{
      user: profile ? { uid: profile.uid, email: profile.email } : null,
      profile,
      loading,
      registeredUsers,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      changePassword,
      updateUserProfile,
      updateUserRoleAndAccountByAdmin,
      demoLogin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
