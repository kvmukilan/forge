import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { getUser, findOrCreateOAuthUser } from "./app/actions/data"
import { signInSchema } from "./lib/zod"
import { SessionUser } from "./lib/types"

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      authorize: async (credentials) => {
        const { username, password } = await signInSchema.parseAsync(credentials)
        const user = await getUser(username, password)
        if (!user) throw new Error("Invalid credentials.")
        const safeUser: SessionUser = { id: user.id }
        return safeUser
      },
    }),
  ],
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      if (account?.provider === 'google') {
        const oauthUser = await findOrCreateOAuthUser(
          account.providerAccountId,
          'google',
          profile?.email ?? undefined,
          profile?.name ?? undefined,
        )
        if (!oauthUser) return false
        // Map the OAuth identity to our internal user ID
        user.id = oauthUser.id
      }
      return true
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = (user as SessionUser).id
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
})
