import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role as string | undefined;

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
