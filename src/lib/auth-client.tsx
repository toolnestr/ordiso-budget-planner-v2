'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User as FbUser,
} from 'firebase/auth'
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from './firebase'

export interface AppUser {
  uid: string
  email: string
  name: string
  role: 'user' | 'admin'
  isDemo: boolean
}

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Module-level mirror of the current user so non-React modules (db.ts) can
// check the demo flag to enforce read-only demo data.
let currentAppUser: AppUser | null = null
export function getCurrentUser(): AppUser | null {
  return currentAppUser
}
/** True when the signed-in user is the read-only demo account. */
export function isDemoUser(): boolean {
  return currentAppUser?.isDemo === true
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser: FbUser | null) => {
      if (!fbUser) {
        currentAppUser = null
        setUser(null)
        setLoading(false)
        return
      }
      // Fetch the user profile from Firestore (role, name, isDemo)
      const userDoc = await getDoc(doc(db, 'users', fbUser.uid))
      const data = userDoc.data() as { name?: string; email?: string; role?: string; isDemo?: boolean } | undefined
      const appUser: AppUser = {
        uid: fbUser.uid,
        email: fbUser.email ?? data?.email ?? '',
        name: data?.name ?? fbUser.displayName ?? fbUser.email ?? '',
        role: (data?.role as 'user' | 'admin') ?? 'user',
        isDemo: data?.isDemo ?? false,
      }
      currentAppUser = appUser
      setUser(appUser)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }

  async function signUp(name: string, email: string, password: string) {
    // Public signup is disabled — but this function is kept for admin-created
    // accounts via the admin console. It's not exposed on the login screen.
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await updateProfile(cred.user, { displayName: name })
    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      email: email.trim().toLowerCase(),
      role: 'user',
      isDemo: false,
      createdAt: new Date().toISOString(),
    })
  }

  async function signOut() {
    await fbSignOut(auth)
  }

  /** Change the current user's password (requires recent login). */
  async function changePassword(currentPassword: string, newPassword: string) {
    const { reauthenticateWithCredential, EmailAuthProvider, updatePassword } = await import('firebase/auth')
    const fbUser = auth.currentUser
    if (!fbUser || !fbUser.email) throw new Error('Not signed in')
    const cred = EmailAuthProvider.credential(fbUser.email, currentPassword)
    await reauthenticateWithCredential(fbUser, cred)
    if (newPassword.length < 6) throw new Error('New password must be at least 6 characters')
    await updatePassword(fbUser, newPassword)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Admin-only: create a user account (client-side, enforced by Firestore rules). */
export async function adminCreateUser(name: string, email: string, password: string, isAdmin: boolean, adminUid: string) {
  // Store a "pending user" request that a Cloudflare Function would process...
  // BUT since we're going fully client-side, we use a secondary Firebase app
  // instance to create the user without logging out the admin.
  const { initializeApp } = await import('firebase/app')
  const { getAuth: getAuth2 } = await import('firebase/auth')
  const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth')
  const secondary = initializeApp({
    apiKey: 'AIzaSyCTMx6EP7bsffX8JeoR01v9WwKsswUq89w',
    authDomain: 'etsy-229e5.firebaseapp.com',
    projectId: 'etsy-229e5',
    storageBucket: 'etsy-229e5.firebasestorage.app',
    messagingSenderId: '183867097387',
    appId: '1:183867097387:web:c92b6f85d7697dfd98456e',
  }, 'secondary')
  const cred = await createUserWithEmailAndPassword(getAuth2(secondary), email.trim(), password)
  await updateProfile(cred.user, { displayName: name })
  await setDoc(doc(db, 'users', cred.user.uid), {
    name,
    email: email.trim().toLowerCase(),
    role: isAdmin ? 'admin' : 'user',
    isDemo: false,
    createdAt: new Date().toISOString(),
    createdBy: adminUid,
  }, { merge: true })
  await fbSignOut(getAuth2(secondary))
  return cred.user.uid
}
