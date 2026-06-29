import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AuthOptions, User as NextAuthUser } from "next-auth";
import { config } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";
import type { UserRole } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

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
  providers: [
    CredentialsProvider({
      name: "Magic Link",
      credentials: {
        email: { label: "Email", type: "email" },
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials): Promise<AppUser | null> {
        if (!credentials?.email || !credentials?.token) return null;

        const email = credentials.email.toLowerCase().trim();
        const token = credentials.token.trim();

        const { data: magicToken, error: tokenError } = await supabaseAdmin
          .from("magic_tokens")
          .select<string, DbMagicToken & { users: DbUser }>("*, users(*)")
          .eq("token", token)
          .eq("used", false)
          .gte("expires_at", new Date().toISOString())
          .single();

        if (tokenError || !magicToken) {
          return null;
        }

        const user = magicToken.users;
        if (!user || user.email !== email) {
          return null;
        }

        await supabaseAdmin
          .from("magic_tokens")
          .update({ used: true } as DbMagicToken)
          .eq("id", magicToken.id);

        return {
          id: user.id,
          email: user.email,
          name: email.split("@")[0],
          role: user.role as UserRole,
          leadId: user.lead_id,
        };
      },
    }),
  ],
  callbacks: {
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
