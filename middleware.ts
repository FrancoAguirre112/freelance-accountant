import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { isE2E } from "@/lib/test-auth";

// In E2E we short-circuit BEFORE importing "@/auth" (which pulls "@/db").
// That keeps the Node libsql client out of the edge middleware bundle while
// leaving the production NextAuth path byte-for-byte unchanged.
export default async function middleware(
  req: NextRequest,
  ev: NextFetchEvent,
) {
  if (isE2E()) {
    const { nextUrl } = req;
    if (nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    if (nextUrl.pathname === "/onboarding") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  const { auth } = await import("@/auth");
  const handler = auth((authReq) => {
    const { nextUrl } = authReq;
    const isAuthenticated = !!authReq.auth;

    const isLoginPage = nextUrl.pathname === "/login";
    const isAuthApi = nextUrl.pathname.startsWith("/api/auth");

    if (isAuthApi) return NextResponse.next();

    if (isLoginPage) {
      if (isAuthenticated) {
        return NextResponse.redirect(new URL("/", nextUrl));
      }
      return NextResponse.next();
    }

    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }

    const isOnboardingPage = nextUrl.pathname === "/onboarding";
    const profileType = authReq.auth?.user?.profileType;

    if (!profileType && !isOnboardingPage) {
      return NextResponse.redirect(new URL("/onboarding", nextUrl));
    }

    if (profileType && isOnboardingPage) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }

    return NextResponse.next();
  });

  // NextAuth's auth() wrapper is itself a (req, ev) middleware handler;
  // its public type targets route handlers, so invoke via a narrowed cast.
  const run = handler as unknown as (
    req: NextRequest,
    ev: NextFetchEvent,
  ) => Promise<Response | undefined>;
  return run(req, ev);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.webp$).*)"],
};
