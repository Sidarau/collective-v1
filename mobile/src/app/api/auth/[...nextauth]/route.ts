import NextAuth from "next-auth";
import { buildAuthOptions } from "@core/auth-options";

/**
 * Session endpoint. The shared auth options give us the credentials provider
 * (password + one-time magic tokens), the JWT shape (`sub`, `email`, `role`,
 * `leadId`) and the cookie settings that `middleware.ts` and `guard.ts` read.
 */
const handler = NextAuth(buildAuthOptions());

export { handler as GET, handler as POST };
