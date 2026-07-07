import CredentialsProvider from "next-auth/providers/credentials";
import type { AuthOptions, User as NextAuthUser } from "next-auth";
import { config } from "./config";
import { getSupabaseAdmin } from "./supabase";
import { verifyPassword } from "./password";
import type { UserRole, UserRow, MagicTokenRow } from "./database.types";
import {
  sessionCookieName,
  sessionCookieOptions,
  SESSION_MAX_AGE,
} from "./auth-cookies";

export type { UserRole };

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  leadId?: string | null;
}

export interface AppUser extends NextAuthUser {
  id: string;
  email: string;
  role: UserRole;
  leadId: string | null;
}

/**
 * Shared NextAuth options for both apps (member portal + admin console).
 * Credentials provider supports one-time magic tokens and passwords; the
 * cookie name/options come from auth-cookies so middleware always agrees.
 */
export function buildAuthOptions(): AuthOptions {
  return {
    secret: config.nextAuthSecret,
    debug: config.nodeEnv !== "production",
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
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
          const supabaseAdmin = getSupabaseAdmin();

          // 1. Magic token login
          if (token) {
            const { data: magicToken, error: tokenError } = await supabaseAdmin
              .from("magic_tokens")
              .select<string, MagicTokenRow & { users: UserRow }>("*, users(*)")
              .eq("token", token)
              .eq("used", false)
              .gte("expires_at", new Date().toISOString())
              .single();

            if (!tokenError && magicToken) {
              const user = magicToken.users;
              if (user && user.email === email) {
                (user as unknown as Record<string, string>).magicTokenId = magicToken.id;
                return {
                  id: user.id,
                  email: user.email,
                  name: email.split("@")[0],
                  role: user.role,
                  leadId: user.lead_id,
                  magicTokenId: magicToken.id,
                } as AppUser & { magicTokenId: string };
              }
            }
          }

          // 2. Password login
          if (password) {
            const { data: user, error: userError } = await supabaseAdmin
              .from("users")
              .select<string, UserRow>("*")
              .eq("email", email)
              .single();

            if (!userError && user && user.password_hash) {
              const valid = await verifyPassword(password, user.password_hash);
              if (valid) {
                return {
                  id: user.id,
                  email: user.email,
                  name: email.split("@")[0],
                  role: user.role,
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
        // Consume the magic token only after a successful sign-in.
        if (account?.provider === "credentials" && user) {
          const appUser = user as AppUser & { magicTokenId?: string };
          if (appUser.magicTokenId) {
            await getSupabaseAdmin()
              .from("magic_tokens")
              .update({ used: true })
              .eq("id", appUser.magicTokenId);
          }
        }
        return true;
      },
      async session({ session, token }) {
        if (token && session.user) {
          const u = session.user as SessionUser;
          u.id = token.id as string;
          u.role = token.role as UserRole;
          u.leadId = token.leadId as string | null;
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
}

/**
 * JWT claims identical to what the jwt callback produces — used by the
 * server-side magic-link route to mint a session cookie NextAuth accepts.
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
