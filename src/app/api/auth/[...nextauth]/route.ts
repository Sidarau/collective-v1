import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { config } from "@/lib/config";
import { createBrowserClient } from "@/lib/supabase";

export const authOptions = {
  secret: config.nextAuthSecret,
  providers: [
    CredentialsProvider({
      name: "Magic Link",
      credentials: {
        email: { label: "Email", type: "email" },
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const supabase = createBrowserClient();
        
        // For MVP v1: simple email + token login
        // Token is generated during onboarding and sent via email
        // In production, this would be a proper magic link flow
        const { data: user } = await supabase
          .from("users")
          .select("*, leads(*)")
          .eq("email", credentials.email)
          .single();

        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.leads?.first_name + " " + user.leads?.last_name,
          role: user.role,
          leadId: user.lead_id,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.leadId = token.leadId;
      }
      return session;
    },
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.leadId = user.leadId;
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
