import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getWhere } from '@/lib/firestore'

// NextAuth configuration — Credentials provider backed by the Firestore
// `users` collection. Sessions are JWT-based (no server session store needed).
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    // We render our own auth screen at `/`, but NextAuth still needs these
    // path aliases for internal redirects. They won't be shown.
    signIn: '/',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password
        if (!email || !password) return null

        const found = await getWhere<{ email: string; hashedPassword: string; name: string; role: string; bannedAt?: string }>(
          'users',
          'email',
          '==',
          email
        )
        if (!found.length) return null
        const u = found[0]
        if (u.bannedAt) return null // banned user cannot sign in

        const valid = await bcrypt.compare(password, u.hashedPassword)
        if (!valid) return null

        return { id: u.id, email: u.email, name: u.name, role: u.role as 'user' | 'admin' }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
      }
      return session
    },
  },
}
