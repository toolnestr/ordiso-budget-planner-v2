// Augment NextAuth session/JWT types with our custom fields.
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: 'user' | 'admin'
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    role: 'user' | 'admin'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'user' | 'admin'
  }
}
