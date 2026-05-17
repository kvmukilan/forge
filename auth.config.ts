import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = (user as { id: string }).id
      }
      return token
    },
    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}
