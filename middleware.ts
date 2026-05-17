import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isVerifyPage = req.nextUrl.pathname.startsWith("/verify");

    // If the user is authenticated but 2FA is enabled and NOT yet verified
    if (isAuth && token.twoFactorEnabled && !token.is2FAVerified && !isVerifyPage) {
      return NextResponse.redirect(new URL("/verify", req.url));
    }

    // Prevent access to verify page if already verified or 2FA not enabled
    if (isVerifyPage && (!isAuth || !token.twoFactorEnabled || token.is2FAVerified)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/verify/:path*", "/api/watchlist/:path*", "/api/settings/:path*"],
};
