import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { sessionCookieName } from "@/lib/auth-cookies";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const role = token?.role as string | undefined;

    // Diagnostic logging — names/booleans only, never cookie or token values.
    if (process.env.NODE_ENV !== "production" || process.env.AUTH_DEBUG === "1") {
      const cookieNames = req.cookies.getAll().map((c) => c.name);
      console.log("[mw]", {
        path: pathname,
        sessionCookiePresent: cookieNames.includes(sessionCookieName),
        cookieNames,
        tokenResolved: !!token,
        role: role ?? null,
      });
    }

    // Admin/operator routes
    if (pathname.startsWith("/admin")) {
      if (!["admin", "operator"].includes(role || "")) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // Portal routes (lead/member/admin/operator)
    if (pathname.startsWith("/portal")) {
      if (!["lead", "member", "admin", "operator"].includes(role || "")) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    // CRITICAL: tell getToken which cookie name to read. Without this, withAuth
    // falls back to getToken's default (__Secure-next-auth.session-token on
    // Vercel), which previously mismatched the cookie the handler wrote.
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
  matcher: ["/portal/:path*", "/admin/:path*"],
};
