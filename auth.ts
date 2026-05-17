import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { getUser, findOrCreateOAuthUser } from "./app/actions/data"
import { signInSchema } from "./lib/zod"
import { SessionUser } from "./lib/types"
import { authConfig } from "./auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
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
    ...authConfig.callbacks,
    signIn: async ({ user, account, profile }) => {
      if (account?.provider === 'google') {
        const oauthUser = await findOrCreateOAuthUser(
          account.providerAccountId,
          'google',
          profile?.email ?? undefined,
          profile?.name ?? undefined,
        )
        if (!oauthUser) return false
        user.id = oauthUser.id
      }
      return true
    },
  },
})
