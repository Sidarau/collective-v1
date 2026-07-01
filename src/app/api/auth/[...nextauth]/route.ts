import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AuthOptions, User as NextAuthUser } from "next-auth";
import { config } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";
import type { UserRole } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { sessionCookieName, sessionCookieOptions, SESSION_MAX_AGE } from "@/lib/auth-cookies";

type DbUser = Database["public"]["Tables"]["users"]["Row"];
type DbMagicToken = Database["public"]["Tables"]["magic_tokens"]["Row"];

interface AppUser extends NextAuthUser {
  id: string;
  email: string;
  role: UserRole;
  leadId: string | null;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: UserRole;
      leadId: string | null;
    };
  }
  interface JWT {
    id?: string;
    email?: string;
    name?: string | null;
    role?: UserRole;
    leadId?: string | null;
  }
}

export const authOptions: AuthOptions = {
  secret: config.nextAuthSecret,
  // Only enable verbose NextAuth logs outside production (never leak in prod).
  debug: config.nodeEnv !== "production",
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  // Session cookie name + options come from a single shared source (see
  // src/lib/auth-cookies.ts) so the writer here and the reader in middleware /
  // getServerSession always agree, and so we use SameSite=Lax (not None), which
  // is correct for this same-origin flow and survives Safari ITP / iOS WebViews.
  cookies: {
    sessionToken: {
      name: sessionCookieName,
      options: sessionCookieOptions,
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        token: { label: "Token", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<AppUser | null> {
        if (!credentials?.email) return null;

        const email = credentials.email.toLowerCase().trim();
        const token = credentials.token?.trim();
        const password = credentials.password;

        // 1. Try magic token login
        if (token) {
          const { data: magicToken, error: tokenError } = await supabaseAdmin
            .from("magic_tokens")
            .select<string, DbMagicToken & { users: DbUser }>("*, users(*)")
            .eq("token", token)
            .eq("used", false)
            .gte("expires_at", new Date().toISOString())
            .single();

          if (!tokenError && magicToken) {
            const user = magicToken.users;
            if (user && user.email === email) {
              // Store magic token ID in the user object for signIn callback
              (user as unknown as Record<string, string>).magicTokenId = magicToken.id;

              return {
                id: user.id,
                email: user.email,
                name: email.split("@")[0],
                role: user.role as UserRole,
                leadId: user.lead_id,
              };
            }
          }
        }

        // 2. Try password login
        if (password) {
          const { data: user, error: userError } = await supabaseAdmin
            .from("users")
            .select<string, DbUser>("*")
            .eq("email", email)
            .single();

          if (!userError && user && user.password_hash) {
            const valid = await verifyPassword(password, user.password_hash);
            if (valid) {
              return {
                id: user.id,
                email: user.email,
                name: email.split("@")[0],
                role: user.role as UserRole,
                leadId: user.lead_id,
              };
            }
          }
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Mark magic token as used only after successful sign-in
      if (account?.provider === "credentials" && user) {
        const appUser = user as AppUser & { magicTokenId?: string };
        if (appUser.magicTokenId) {
          await supabaseAdmin
            .from("magic_tokens")
            .update({ used: true } as DbMagicToken)
            .eq("id", appUser.magicTokenId);
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.leadId = token.leadId as string | null;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        const appUser = user as AppUser;
        token.id = appUser.id;
        token.email = appUser.email;
        token.name = appUser.name;
        token.role = appUser.role;
        token.leadId = appUser.leadId;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

/**
 * Builds the JWT claim object for a signed-in user, identical to what the `jwt`
 * callback above produces. The server-side magic-link route encodes this with
 * `next-auth/jwt`'s `encode()` so the resulting cookie decodes the same way
 * `getToken()` / `getServerSession()` expect (id, role, leadId on the token).
 */
export function buildSessionTokenClaims(user: {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  leadId: string | null;
}): Record<string, unknown> {
  return {
    sub: user.id,
    id: user.id,
    email: user.email,
    name: user.name ?? user.email.split("@")[0],
    role: user.role,
    leadId: user.leadId,
  };
}
