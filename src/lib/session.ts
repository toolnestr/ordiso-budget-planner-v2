import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth'

export interface SessionUser {
  userId: string
  role: 'user' | 'admin'
  email: string
  name: string
}

/** Returns the authenticated user or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  return {
    userId: session.user.id,
    role: session.user.role,
    email: session.user.email,
    name: session.user.name ?? session.user.email,
  }
}

/** Throws-style helper that returns the user or null (caller returns 401). */
export async function requireUser(): Promise<SessionUser | null> {
  return getSessionUser()
}

/** Returns the admin user or null (caller returns 403). */
export async function requireAdmin(): Promise<SessionUser | null> {
  const u = await getSessionUser()
  if (!u || u.role !== 'admin') return null
  return u
}
