import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { sessionCookieName } from "@core/auth-cookies";

/**
 * Auth gate only: any signed-in user passes; the portal layout and funnel
 * pages route by role/application state server-side. Role *enforcement* for
 * mutations lives in the API routes.
 */
export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    // CRITICAL (ZEUG-414): tell getToken which cookie to read, or withAuth
    // falls back to a name the handler never wrote and every request bounces.
    cookies: {
      sessionToken: { name: sessionCookieName },
    },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/app/:path*",
    "/enter",
    "/onboarding",
    "/join",
    "/pending",
  ],
};
